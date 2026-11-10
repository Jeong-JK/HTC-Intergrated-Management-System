"""HTC Inventory — 점검 모드 Router
관리자가 시스템별로 잠그면 관리자 + 허용한 사용자만 접근 가능. 그 외에는 LOCK_MESSAGE (lock_message, HTTP 423)
막는 곳: main.py maintenance_guard (inv/cal 도메인 API, sales/crm이 부르는 /api/auth/me?app=)"""
import json
from typing import List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import db_cursor
from routers import auth
from routers.auth import require_perm

router = APIRouter(tags=["maintenance"])

SYSTEMS = ("inventory", "sales", "crm", "worklog")  # 메인허브 카드 id와 같음
# 안내 문구용 이름 + 조사 (메인허브 카드 제목과 같게)
NAMES = {"inventory": "재고관리는", "sales": "Sales Pipeline은", "crm": "CRM은", "worklog": "업무일지 캘린더는"}


def lock_message(system):
    return f"현재 {NAMES[system]} 점검중입니다. 관리자에게 문의하세요."


class MaintenanceSave(BaseModel):
    locked: bool
    allowed_user_ids: List[int] = []


def load_rows():
    with db_cursor() as cur:
        cur.execute("SELECT sys_key, locked, allowed_user_ids FROM maintenance")
        rows = cur.fetchall()
    return {r["sys_key"]: {"locked": bool(r["locked"]), "allowed_user_ids": json.loads(r["allowed_user_ids"] or "[]")} for r in rows}


def can_enter(row, user):
    return not row["locked"] or bool(user.get("is_admin")) or user["id"] in row["allowed_user_ids"]


def blocked_message(system, session_token):
    """잠겨 있고 이 사용자가 못 들어가면 안내 문구, 아니면 None (비로그인은 각 API가 401 처리)"""
    row = load_rows().get(system)
    if not row or not row["locked"]:
        return None
    user = auth.get_session(session_token)
    if not user or can_enter(row, user):
        return None
    return lock_message(system)


@router.get("/maintenance")
def get_status(request: Request):
    """시스템별 점검 여부와 내가 들어갈 수 있는지. 허용 사용자 목록은 관리자에게만"""
    user = require_perm(request)
    rows = load_rows()
    out = {}
    for s in SYSTEMS:
        row = rows.get(s, {"locked": False, "allowed_user_ids": []})
        out[s] = {"locked": row["locked"], "can_enter": can_enter(row, user), "message": lock_message(s)}
        if user.get("is_admin"):
            out[s]["allowed_user_ids"] = row["allowed_user_ids"]
    return out


@router.put("/maintenance/{system}")
def save_status(system: str, data: MaintenanceSave, request: Request):
    require_perm(request, "is_admin")
    if system not in SYSTEMS:
        raise HTTPException(status_code=404, detail="알 수 없는 시스템입니다")
    allowed = json.dumps(sorted(set(data.allowed_user_ids)))
    with db_cursor() as cur:
        cur.execute(
            """INSERT INTO maintenance (sys_key, locked, allowed_user_ids) VALUES (%s, %s, %s)
               ON DUPLICATE KEY UPDATE locked = VALUES(locked), allowed_user_ids = VALUES(allowed_user_ids)""",
            (system, data.locked, allowed)
        )
    return {"message": "점검 모드가 " + ("켜졌습니다" if data.locked else "꺼졌습니다")}
