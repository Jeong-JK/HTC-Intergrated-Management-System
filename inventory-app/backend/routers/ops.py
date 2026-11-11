"""관리자 전용: 메인허브 버튼으로 프론트 빌드 / 서버 재시작. 메모리 1.9GB라 한 번에 하나만 실행"""
import os
import re
import subprocess
import threading
import time
from fastapi import APIRouter, HTTPException, Request
from routers.auth import require_perm
from config import get_logger

router = APIRouter(tags=["ops"])
logger = get_logger("ops")

HOME = os.path.expanduser("~")
# 메인허브 카드 id → (앱 폴더, systemd 서비스). 업무일지·메인허브는 재고 앱에 들어 있음
APPS = {
    "inventory": ("inventory-app", "htc-inventory"),
    "worklog": ("inventory-app", "htc-inventory"),
    "sales": ("sales-app", "htc-sales"),
    "crm": ("crm-app", "htc-crm"),
}
SELF_SERVICE = "htc-inventory"  # 이 서버 자신: 재시작하면 응답 전에 죽으므로 --no-block 으로 맡기고 화면이 복귀를 확인
BUILD_CMD = ["npm", "run", "build"]
BUILD_TIMEOUT = 600
# vite 출력 단계 → 진행률
BUILD_STEPS = [("modules transformed", 70), ("rendering chunks", 80), ("computing gzip", 90)]
# 처음 예상 시간(초). 성공하면 실제 걸린 시간으로 갱신
# shortcut: 메모리 저장이라 재시작하면 기본값으로, 진행률이 많이 어긋나면 파일에 저장
_estimate = {"build": 60, "restart": 8}

BOOT = time.time()  # 화면이 '재시작 후 다시 올라왔는지' 판단용
_lock = threading.Lock()
_job = None


def _systemctl(*args, timeout=90):
    return subprocess.run(["sudo", "systemctl", *args], capture_output=True, text=True, timeout=timeout)


def _view(job):
    if not job:
        return None
    if job["status"] == "running":
        elapsed = time.time() - job["started"]
        percent = min(95, max(job["step_pct"], int(elapsed / _estimate[job["action"]] * 95)))
    else:
        percent = 100 if job["status"] == "done" else job["step_pct"]
    return {k: job[k] for k in ("app", "action", "status", "error", "by")} | {"percent": percent, "log": job["log"][-12:]}


def _finish(job, error=None):
    job["status"] = "error" if error else "done"
    job["error"] = error
    if not error:
        _estimate[job["action"]] = max(3, time.time() - job["started"])
    logger.warning("관리 작업 %s: %s %s (by %s)%s", job["status"], job["app"], job["action"], job["by"], f" — {error}" if error else "")


def _run_build(job, folder):
    try:
        proc = subprocess.Popen(BUILD_CMD, cwd=f"{HOME}/{folder}/frontend", stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, env={**os.environ, "NO_COLOR": "1", "CI": "1"})
        killer = threading.Timer(BUILD_TIMEOUT, proc.kill)
        killer.start()
        for line in proc.stdout:
            line = re.sub(r"\x1b\[[0-9;]*m", "", line).rstrip()
            if line:
                job["log"] = (job["log"] + [line])[-40:]
            for key, pct in BUILD_STEPS:
                if key in line:
                    job["step_pct"] = max(job["step_pct"], pct)
        rc = proc.wait()
        killer.cancel()
        _finish(job, None if rc == 0 else f"빌드 실패 (종료 코드 {rc})")
    except Exception as e:
        _finish(job, f"빌드 실행 오류: {e}")


def _run_restart(job, service):
    try:
        r = _systemctl("restart", service)
        if r.returncode != 0:
            return _finish(job, f"재시작 실패: {(r.stderr or r.stdout).strip()[:300]}")
        time.sleep(3)  # 올라오자마자 죽는 경우(코드 오류 등)를 잡으려고 잠깐 기다린 뒤 확인
        state = _systemctl("is-active", service, timeout=10).stdout.strip()
        _finish(job, None if state == "active" else f"재시작 후 상태: {state} — SSH로 로그를 확인하세요")
    except Exception as e:
        _finish(job, f"재시작 실행 오류: {e}")


def _admin(request: Request):
    user = require_perm(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")
    return user


@router.get("/ops/status")
def ops_status(request: Request):
    _admin(request)
    return {"job": _view(_job), "boot": BOOT}


@router.post("/ops/{app}/{action}")
def ops_run(app: str, action: str, request: Request):
    global _job
    user = _admin(request)
    if app not in APPS or action not in ("build", "restart"):
        raise HTTPException(status_code=404, detail="알 수 없는 작업입니다")
    folder, service = APPS[app]
    with _lock:
        if _job and _job["status"] == "running":
            raise HTTPException(status_code=409, detail="다른 작업이 진행 중입니다. 끝난 뒤 다시 시도하세요")
        _job = {"app": app, "action": action, "status": "running", "error": None, "by": user.get("name"),
                "started": time.time(), "step_pct": 0, "log": []}
        job = _job
    logger.warning("관리 작업 시작: %s %s (by %s)", app, action, job["by"])

    if action == "restart" and service == SELF_SERVICE:
        now = time.time()
        subprocess.Popen(["sudo", "systemctl", "restart", "--no-block", service], start_new_session=True)
        return {"job": _view(job), "self_restart": True, "now": now}

    target = _run_build if action == "build" else _run_restart
    threading.Thread(target=target, args=(job, folder if action == "build" else service), daemon=True).start()
    return {"job": _view(job), "self_restart": False}
