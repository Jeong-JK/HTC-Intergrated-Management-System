"""활동 로그: 누가 언제 어디서 무엇을 추가/수정/삭제했는지 + 로그인. 6개월 지난 기록은 로그인 때 정리
상세('무엇을 무엇으로')는 audit.py
재고 서버가 보관하고, Sales/CRM 은 /api/activity/record 로 보냄 (서버끼리만 아는 키 확인)"""
import hmac
import json
import httpx
from contextlib import contextmanager
import secrets
from datetime import date, timedelta
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode
import pymysql
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import db_cursor, sales_db_cursor
from config import PIPELINE_DB_HOST, PIPELINE_DB_USER, PIPELINE_DB_PASSWORD, PIPELINE_DB_NAME
import audit
from routers.auth import get_session, require_perm, rank_order

router = APIRouter(tags=["activity"])

KEEP_DAYS = 183  # 6개월
UNDO_DAYS = 30   # 되돌리기 원본 보관 (지나면 기록만 남음)
PAGE_SIZE = 100
HIDDEN_LOGIN_ID = "admin"  # 관리자(admin) 계정은 기록하지 않음
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
    if method == "UNDO":
        return menu, "되돌림"
    action = next((ACTIONS[p] for p in reversed(parts) if p in ACTIONS), METHOD_ACTIONS.get(method, method))
    return menu, action


def record(user, system, method, path, ip, detail=None, ref_table=None, ref_id=None, undo_data=None):
    if user.get("user_id") == HIDDEN_LOGIN_ID:
        return
    with db_cursor() as cur:
        cur.execute(
            """INSERT INTO activity_logs (user_id, user_name, sys_key, method, path, ip, detail, ref_table, ref_id, undo_data)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (user["id"], user.get("name"), system, method, path[:255], (ip or "")[:45], detail and detail[:500],
             ref_table, ref_id, undo_data)
        )


def record_session(session_token, system, method, path, ip, detail=None, ref_table=None, ref_id=None, undo_data=None):
    """세션 주인 이름으로 기록 (로그인 안 된 요청은 무시)"""
    user = get_session(session_token) if session_token else None
    if user:
        record(user, system, method, path, ip, detail, ref_table, ref_id, undo_data)


# 목록에서 누르면 새 탭으로 여는 화면
INV_PAGES = {"items": "/stock-detail", "rack": "/stock-detail", "rentals": "/rental-history",
             "deliveries": "/delivery-history", "inbound": "/inbound/detail", "settings": "/settings"}
HUB_PAGES = {"auth": "/users", "posts": "/board", "notifications": "/board", "drive": "/admin-drive"}


def link(system, method, path):
    if method == "LOGIN":
        return None
    part = path.split("/")[2] if path.count("/") >= 2 else ""
    if system == "sales":
        return "https://sales.hltac.com/" + ("board" if part == "posts" else "")
    if system == "crm":
        return "https://crm.hltac.com/"
    if system == "worklog":
        return "https://cal.hltac.com/"
    if system == "inventory":
        return "https://inv.hltac.com" + INV_PAGES.get(part, "/")
    return "https://ims.hltac.com" + HUB_PAGES.get(part, "/")


def record_login(cur, user, ip, master=False):
    """로그인: 마지막 로그인 시각 + 기록(admin 계정 제외), 오래된 기록 정리"""
    cur.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (user["id"],))
    if user["user_id"] == HIDDEN_LOGIN_ID:
        return
    cur.execute(
        "INSERT INTO activity_logs (user_id, user_name, sys_key, method, path, ip) VALUES (%s, %s, 'hub', 'LOGIN', %s, %s)",
        (user["id"], user["name"], "/api/auth/login" + ("/master" if master else ""), (ip or "")[:45])
    )
    cur.execute("DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL %s DAY", (KEEP_DAYS,))
    cur.execute("UPDATE activity_logs SET undo_data = NULL WHERE undo_data IS NOT NULL AND created_at < NOW() - INTERVAL %s DAY",
                (UNDO_DAYS,))


class RecordIn(BaseModel):
    session_token: Optional[str] = None
    system: str
    method: str
    path: str
    status: int = 200
    ip: Optional[str] = None
    detail: Optional[str] = None
    ref_table: Optional[str] = None
    ref_id: Optional[int] = None
    undo_data: Optional[str] = None


@router.post("/activity/record")
def record_from_service(data: RecordIn, request: Request):
    """Sales/CRM 서버 전용 (서버끼리 아는 키가 있어야 함)"""
    if not hmac.compare_digest(request.headers.get("x-activity-token", ""), SERVICE_TOKEN):
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    if data.system not in ("sales", "crm"):
        raise HTTPException(status_code=400, detail="알 수 없는 시스템입니다")
    if should_log(data.method, data.path, data.status):
        record_session(data.session_token, data.system, data.method, data.path, data.ip, data.detail, data.ref_table, data.ref_id,
                       data.undo_data)
    return {"ok": True}


@router.get("/activity-logs")
def list_activity_logs(request: Request, user_id: Optional[int] = None, system: Optional[str] = None,
                       start: Optional[date] = None, end: Optional[date] = None, offset: int = 0):
    """관리자/'활동 로그 조회' 권한은 전체, 그 외엔 본인 기록만(내 활동). 최신순 100개씩 + 사용자별 마지막 로그인"""
    viewer = require_perm(request)
    see_all = can_see_all(viewer)
    if not see_all:
        user_id = viewer["id"]
    hide_admin = not viewer.get("is_admin")
    sql = ("SELECT id, user_id, user_name, sys_key AS system, method, path, ip, detail, created_at, undone_at, "
           "undo_data IS NOT NULL AS undoable FROM activity_logs WHERE 1=1")
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
        if see_all:
            cur.execute(f"SELECT id, name, position, last_login_at FROM users"
                        f"{' WHERE user_id <> %s' if hide_admin else ''} ORDER BY {rank_order()}",
                        [HIDDEN_LOGIN_ID] if hide_admin else [])
            users = cur.fetchall()
        else:
            users = []
    for r in rows:
        r["system_name"] = SYSTEM_NAMES.get(r["system"], r["system"])
        r["menu"], r["action"] = describe(r["method"], r["path"])
        r["link"] = link(r["system"], r["method"], r["path"])
    return {"data": rows[:PAGE_SIZE], "has_more": len(rows) > PAGE_SIZE, "users": users, "see_all": see_all}


def can_see_all(user):
    return bool(user.get("is_admin") or user.get("can_view_activity_log"))


def _load_log(log_id, viewer):
    """기록 1건 — 본인 것 또는 전체 권한일 때만"""
    with db_cursor() as cur:
        cur.execute("SELECT id, user_id, user_name, sys_key AS system, method, path, ip, detail, ref_table, ref_id, created_at, "
                    "undone_at, undo_data FROM activity_logs WHERE id = %s", (log_id,))
        log = cur.fetchone()
    if not log:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다")
    if log["user_id"] != viewer["id"] and not can_see_all(viewer):
        raise HTTPException(status_code=403, detail="본인 기록만 보거나 되돌릴 수 있습니다")
    return log


# ── 상세 창: 기록된 항목의 현재 정보 + 그 항목을 바로 여는 주소
@contextmanager
def pipeline_db_cursor():
    """Sales(htc_pipeline) DB — 읽기만"""
    conn = pymysql.connect(host=PIPELINE_DB_HOST, user=PIPELINE_DB_USER, password=PIPELINE_DB_PASSWORD,
                           database=PIPELINE_DB_NAME, charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor)
    try:
        with conn.cursor() as cur:
            yield cur
    finally:
        conn.close()


AUDIT_APP = {"sales": ("sales", pipeline_db_cursor), "crm": ("crm", sales_db_cursor)}  # 그 외(메인허브/재고/업무일지)는 재고 DB


def _crm_ids(cur, contact_id):
    cur.execute("SELECT c.id AS contact, t.id AS team, t.company_id AS company FROM contacts c JOIN teams t ON c.team_id = t.id WHERE c.id = %s", (contact_id,))
    return cur.fetchone() or {}


def deep_link(cur, system, method, path, table, row):
    """새 탭에서 그 항목이 바로 열리는 주소 (각 앱 화면이 주소의 값을 읽어 이동)"""
    base = link(system, method, path)
    if not row or not base:
        return base
    q = {}
    if table == "items":
        q = {"name": row["item_name"], "q": row["serial"] or ""}
    elif table in ("rental_history", "delivery_history"):
        q = {"q": row["item_name"]}
    elif table == "inbound":
        q = {"q": row["serial"] or row["item_name"], "year": row["inbound_date"].year if row["inbound_date"] else ""}
    elif table == "users":
        q = {"user": row["id"]}
    elif table == "posts" and system == "hub":
        q = {"post": row["id"]}
    elif table == "projects":
        q = {"tab": "projects", "year": row["year"], "project": row["id"]}
    elif table == "weekly_schedule":
        q = {"tab": "weekly", "year": row["year"]}
    elif table == "companies":
        q = {"company": row["id"]}
    elif table == "teams":
        q = {"company": row["company_id"], "team": row["id"]}
    elif table in ("contacts", "meetings"):
        q = _crm_ids(cur, row["id"] if table == "contacts" else row["contact_id"])
    elif table == "quotations":
        q = {"quotation": row["id"]}
    q = {k: v for k, v in q.items() if v not in (None, "")}
    return base + ("?" + urlencode(q) if q else "")


@router.get("/activity-logs/{log_id}/record")
def get_activity_record(log_id: int, request: Request):
    """상세 창: 기록 + 그 항목의 현재 정보(칸 이름/값) + 바로가기 주소. 삭제된 항목은 deleted"""
    viewer = require_perm(request)
    log = _load_log(log_id, viewer)
    can_undo = bool(log.pop("undo_data")) and not log["undone_at"]
    log["system_name"] = SYSTEM_NAMES.get(log["system"], log["system"])
    log["menu"], log["action"] = describe(log["method"], log["path"])
    app, cursor_factory = AUDIT_APP.get(log["system"], ("inventory", db_cursor))
    spec = audit.spec_for(app, log["ref_table"]) if log["ref_id"] else None
    result = {"log": log, "name": None, "fields": [], "deleted": False, "can_undo": can_undo,
              "link": link(log["system"], log["method"], log["path"])}
    if not spec:
        return result
    with cursor_factory() as cur:
        cur.execute(f"SELECT * FROM {spec['table']} WHERE id = %s", (log["ref_id"],))
        row = cur.fetchone()
        if not row:
            result["deleted"] = True
            return result
        result["name"] = audit.display_name(cur, spec, row)
        result["fields"] = [{"label": label, "value": audit.short(row.get(col), 300)} for col, label in spec["fields"].items() if col in row]
        result["link"] = deep_link(cur, log["system"], log["method"], log["path"], spec["table"], row)
    return result



SALES_UNDO_URL = "http://localhost:8001/api/internal/undo"  # Sales 는 구글 시트까지 맞춰야 해서 Sales 서버가 실행


@router.post("/activity-logs/{log_id}/undo")
def undo_activity(log_id: int, request: Request, force: bool = False):
    """되돌리기 — 본인 기록, 또는 관리자/'활동 로그 조회' 권한은 누구 것이든. 그 뒤 다시 바뀌었으면 409 (force 로 진행)"""
    viewer = require_perm(request)
    log = _load_log(log_id, viewer)
    if log["undone_at"]:
        raise HTTPException(status_code=400, detail="이미 되돌린 기록입니다")
    if not log["undo_data"]:
        raise HTTPException(status_code=400, detail=f"되돌릴 수 없는 기록입니다 ({UNDO_DAYS}일이 지났거나 되돌리기를 지원하지 않는 메뉴)")
    with db_cursor() as cur:  # 동시에 두 번 눌러도 한 번만
        cur.execute("UPDATE activity_logs SET undone_at = NOW() WHERE id = %s AND undone_at IS NULL", (log_id,))
        if cur.rowcount != 1:
            raise HTTPException(status_code=400, detail="이미 되돌린 기록입니다")
    data = json.loads(log["undo_data"])
    try:
        inverse = _run_undo(log["system"], data, force)
    except Exception as e:
        with db_cursor() as cur:
            cur.execute("UPDATE activity_logs SET undone_at = NULL WHERE id = %s", (log_id,))
        if isinstance(e, audit.UndoConflict):
            raise HTTPException(status_code=409, detail=_conflict_message(log))
        if isinstance(e, (audit.UndoError, HTTPException)):
            raise HTTPException(status_code=400, detail=getattr(e, "detail", None) or str(e))
        raise
    with db_cursor() as cur:
        cur.execute("UPDATE activity_logs SET undo_data = NULL WHERE id = %s", (log_id,))
    ip = request.headers.get("x-real-ip") or (request.client.host if request.client else None)
    ref_id = inverse.get("id") or (inverse.get("ids") or [log["ref_id"]])[0]
    record(viewer, log["system"], "UNDO", log["path"], ip, f"되돌림 · {log['detail'] or ''}"[:500], log["ref_table"], ref_id,
           json.dumps(inverse, ensure_ascii=False))
    return {"message": "되돌렸습니다"}


def _run_undo(system, data, force):
    if system == "sales":
        r = httpx.post(SALES_UNDO_URL, json={"data": data, "force": force}, headers={"X-Activity-Token": SERVICE_TOKEN}, timeout=30)
        if r.status_code == 409:
            raise audit.UndoConflict()
        if r.status_code != 200:
            raise audit.UndoError(r.json().get("detail", "Sales 서버에서 되돌리지 못했습니다"))
        return r.json()["inverse"]
    app, cursor_factory = AUDIT_APP.get(system, ("inventory", db_cursor))
    inverse, _sheet = audit.undo(cursor_factory, app, data, force)
    return inverse


def _conflict_message(log):
    with db_cursor() as cur:
        cur.execute("SELECT DISTINCT user_name FROM activity_logs WHERE ref_table = %s AND ref_id = %s AND id > %s AND sys_key = %s",
                    (log["ref_table"], log["ref_id"], log["id"], log["system"]))
        names = [r["user_name"] for r in cur.fetchall() if r["user_name"]]
    who = f"{', '.join(names)}님이 " if names else ""
    return f"이 항목은 그 뒤에 {who}다시 바꿨습니다. 그래도 되돌리면 이번 기록에서 바뀐 칸이 이 기록 전 값으로 돌아갑니다."
