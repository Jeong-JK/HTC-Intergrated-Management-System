"""활동 로그: 누가 언제 어디서 무엇을 추가/수정/삭제했는지(요약) + 로그인. 1년 지난 기록은 로그인 때 정리
재고 서버가 보관하고, Sales/CRM 은 /api/activity/record 로 보냄 (서버끼리만 아는 키 확인)"""
import hmac
import secrets
from datetime import date, timedelta
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import db_cursor
from routers.auth import get_session, require_perm, rank_order

router = APIRouter(tags=["activity"])

KEEP_DAYS = 365
PAGE_SIZE = 100
HIDDEN_LOGIN_ID = "admin"  # 관리자 계정 기록은 관리자에게만 보임 (업무일지와 같은 규칙)
WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")
# 기록 안 함: 로그인(따로 기록), 읽음 표시, 시트 웹훅, 활동 로그 자체
SKIP_PREFIXES = ("/api/auth/login", "/api/activity", "/api/sheets/webhook")
SKIP_SUFFIXES = ("/read", "/read-all")

# Sales/CRM 서버가 같은 계정(ec2-user)으로 읽는 키 파일 — 없으면 재고 서버가 처음 켜질 때 만듦
TOKEN_FILE = Path.home() / ".config" / "htc" / "activity_token"
if not TOKEN_FILE.exists():
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(secrets.token_hex(32))
    TOKEN_FILE.chmod(0o600)
SERVICE_TOKEN = TOKEN_FILE.read_text().strip()

SYSTEM_NAMES = {"hub": "메인허브", "inventory": "재고", "worklog": "업무일지", "sales": "Sales", "crm": "CRM"}
INVENTORY_MENUS = ("items", "rentals", "deliveries", "inbound", "rack", "settings", "companies")
MENUS = {
    "items": "품목", "rentals": "대여", "deliveries": "납품", "inbound": "입고", "rack": "랙", "settings": "설정",
    "companies": "업체", "auth": "계정", "posts": "게시판", "notifications": "알림", "drive": "Drive",
    "work-logs": "업무일지", "maintenance": "점검 모드", "ops": "빌드/재시작",
    "purchases": "매입", "projects": "프로젝트", "weekly": "주간 일정", "sheets": "시트",
    "crm": "업체", "teams": "팀", "contacts": "담당자", "meetings": "미팅", "dashboard": "대시보드",
    "drive-files": "Drive 파일", "google": "Google Drive", "quotations": "견적", "purchase-orders": "발주",
}
SUB_MENUS = (("/auth/users", "사용자"), ("/auth/profile", "내 정보"), ("/comments", "댓글"),
             ("/transfer-history", "이동 이력"), ("/hue", "색 계열"))
ACTIONS = {
    "return": "반납", "extend": "연장", "confirm": "확정", "toggle-check": "체크", "resign": "퇴사 처리",
    "restore": "복구", "to-po": "발주 전환", "status": "상태 변경", "upload": "업로드", "sync": "동기화",
    "rename": "이름 변경", "exchange-rate": "환율 수정", "order": "순서 변경", "bulk-renew-contacts": "일괄 갱신",
    "create-folder": "폴더 생성", "build": "프론트 빌드", "restart": "서버 재시작", "logout": "로그아웃",
}
METHOD_ACTIONS = {"POST": "추가", "PUT": "수정", "PATCH": "수정", "DELETE": "삭제"}


def should_log(method, path, status):
    return (method in WRITE_METHODS and status < 400 and path.startswith("/api/")
            and not path.startswith(SKIP_PREFIXES) and not path.endswith(SKIP_SUFFIXES))


def inventory_system(path):
    """재고 서버로 온 요청이 메인허브/재고/업무일지 중 어디 것인지"""
    part = path.split("/")[2] if path.count("/") >= 2 else ""
    return "worklog" if part == "work-logs" else "inventory" if part in INVENTORY_MENUS else "hub"


def describe(method, path):
    """(메뉴, 동작) — 화면 표시용"""
    if method == "LOGIN":
        return "계정", "마스터 비밀번호 로그인" if path.endswith("master") else "로그인"
    parts = [p for p in path.split("/") if p][1:]  # 'api' 제외
    menu = next((name for key, name in SUB_MENUS if key in path), MENUS.get(parts[0], parts[0]) if parts else path)
    action = next((ACTIONS[p] for p in reversed(parts) if p in ACTIONS), METHOD_ACTIONS.get(method, method))
    return menu, action


def record(user, system, method, path, ip):
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO activity_logs (user_id, user_name, sys_key, method, path, ip) VALUES (%s, %s, %s, %s, %s, %s)",
            (user["id"], user.get("name"), system, method, path[:255], (ip or "")[:45])
        )


def record_session(session_token, system, method, path, ip):
    """세션 주인 이름으로 기록 (로그인 안 된 요청은 무시)"""
    user = get_session(session_token) if session_token else None
    if user:
        record(user, system, method, path, ip)


def record_login(cur, user, ip, master=False):
    """로그인: 마지막 로그인 시각 + 기록, 오래된 기록 정리"""
    cur.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (user["id"],))
    cur.execute(
        "INSERT INTO activity_logs (user_id, user_name, sys_key, method, path, ip) VALUES (%s, %s, 'hub', 'LOGIN', %s, %s)",
        (user["id"], user["name"], "/api/auth/login" + ("/master" if master else ""), (ip or "")[:45])
    )
    cur.execute("DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL %s DAY", (KEEP_DAYS,))


class RecordIn(BaseModel):
    session_token: Optional[str] = None
    system: str
    method: str
    path: str
    status: int = 200
    ip: Optional[str] = None


@router.post("/activity/record")
def record_from_service(data: RecordIn, request: Request):
    """Sales/CRM 서버 전용 (서버끼리 아는 키가 있어야 함)"""
    if not hmac.compare_digest(request.headers.get("x-activity-token", ""), SERVICE_TOKEN):
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    if data.system not in ("sales", "crm"):
        raise HTTPException(status_code=400, detail="알 수 없는 시스템입니다")
    if should_log(data.method, data.path, data.status):
        record_session(data.session_token, data.system, data.method, data.path, data.ip)
    return {"ok": True}


@router.get("/activity-logs")
def list_activity_logs(request: Request, user_id: Optional[int] = None, system: Optional[str] = None,
                       start: Optional[date] = None, end: Optional[date] = None, offset: int = 0):
    """관리자 또는 '활동 로그 조회' 권한. 최신순 100개씩 + 사용자별 마지막 로그인"""
    viewer = require_perm(request, "can_view_activity_log")
    hide_admin = not viewer.get("is_admin")
    sql = "SELECT id, user_id, user_name, sys_key AS system, method, path, ip, created_at FROM activity_logs WHERE 1=1"
    params = []
    if hide_admin:
        sql += " AND user_id NOT IN (SELECT id FROM users WHERE user_id = %s)"
        params.append(HIDDEN_LOGIN_ID)
    if user_id:
        sql += " AND user_id = %s"
        params.append(user_id)
    if system:
        sql += " AND sys_key = %s"
        params.append(system)
    if start:
        sql += " AND created_at >= %s"
        params.append(start)
    if end:
        sql += " AND created_at < %s"
        params.append(end + timedelta(days=1))
    sql += " ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s"
    params += [PAGE_SIZE + 1, max(0, offset)]
    with db_cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        cur.execute(f"SELECT id, name, position, last_login_at FROM users"
                    f"{' WHERE user_id <> %s' if hide_admin else ''} ORDER BY {rank_order()}",
                    [HIDDEN_LOGIN_ID] if hide_admin else [])
        users = cur.fetchall()
    for r in rows:
        r["system_name"] = SYSTEM_NAMES.get(r["system"], r["system"])
        r["menu"], r["action"] = describe(r["method"], r["path"])
    return {"data": rows[:PAGE_SIZE], "has_more": len(rows) > PAGE_SIZE, "users": users}
