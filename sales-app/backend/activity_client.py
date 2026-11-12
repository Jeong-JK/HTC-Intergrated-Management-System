"""활동 로그: 저장/수정/삭제 요청을 재고 서버(활동 로그 보관)에 알림. 실패해도 원래 요청엔 영향 없음
상세('무엇을 무엇으로')는 재고 앱의 audit.py 를 같이 씀 — 이 앱 DB 는 넘겨받은 cursor 로 읽음"""
import importlib.util
import logging
from pathlib import Path
import httpx
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)
TOKEN_FILE = Path.home() / ".config" / "htc" / "activity_token"  # 재고 서버가 만든 서버끼리 키
WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")

_spec = importlib.util.spec_from_file_location("htc_audit", Path.home() / "inventory-app" / "backend" / "audit.py")
audit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(audit)


async def take_snapshot(request, app, cursor_factory):
    """요청 처리 전 대상 행 기억 (실패하면 상세 없이 요약만)"""
    if request.method not in WRITE_METHODS:
        return None
    try:
        return await run_in_threadpool(audit.before, cursor_factory, app, request.method, request.url.path)
    except Exception as e:
        logger.warning(f"활동 로그 상세 준비 실패: {e}")


async def report_activity(request, system, status, snap=None, cursor_factory=None):
    if request.method not in WRITE_METHODS or status >= 400 or not request.url.path.startswith("/api/"):
        return
    detail = ref_table = ref_id = undo_data = None
    if snap:
        try:
            detail, ref_table, ref_id, undo_data = await run_in_threadpool(audit.after, cursor_factory, snap)
        except Exception as e:
            logger.warning(f"활동 로그 상세 실패: {e}")
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "http://localhost:8000/api/activity/record", timeout=1.5,
                headers={"X-Activity-Token": TOKEN_FILE.read_text().strip()},
                json={"session_token": request.cookies.get("session_token"), "system": system,
                      "method": request.method, "path": request.url.path, "status": status, "detail": detail, "ref_table": ref_table, "ref_id": ref_id, "undo_data": undo_data,
                      "ip": request.headers.get("x-real-ip") or (request.client.host if request.client else None)},
            )
    except Exception as e:
        logger.warning(f"활동 로그 전송 실패: {e}")
