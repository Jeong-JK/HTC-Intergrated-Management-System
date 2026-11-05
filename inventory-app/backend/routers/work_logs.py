"""HTC Inventory — 업무일지 캘린더 Router"""
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import db_cursor
from routers.auth import require_perm

router = APIRouter(tags=["work_logs"])

MAX_QUERY_DAYS = 62  # 월간 달력 6주(42일) + 여유
HIDDEN_LOGIN_ID = "admin"  # 이 계정(로그인 아이디)의 존재/업무일지는 본인 외 아무에게도 안 보임

# 권한 (사용자 관리에서 부여, 관리자는 전부 보유)
#  can_access_worklog : 업무일지 캘린더 접근 (없으면 전부 차단)
#  can_write_worklog  : 본인 업무일지 작성
#  can_edit_worklog   : 본인 업무일지 수정
#  can_delete_worklog : 본인 업무일지 삭제
#  can_manage_worklog : 업무일지관리자 — 다른 사용자 업무일지 열람만 (수정/삭제 불가)
# 다른 사용자 대리 작성/수정/삭제는 관리자만


class WorkLogSave(BaseModel):
    start_date: date
    end_date: Optional[date] = None
    items: List[str]
    user_id: Optional[int] = None  # 관리자 대리 작성 시 대상 직원


def has_perm(user, field):
    return bool(user.get("is_admin") or user.get(field))


def resolve_owner(cur, user, requested_id):
    """작성자 결정: 본인, 또는 관리자만 다른 직원 지정 가능"""
    if not requested_id or requested_id == user["id"]:
        return user["id"]
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="다른 사용자의 업무일지는 작성할 수 없습니다")
    cur.execute("SELECT id FROM users WHERE id = %s", (requested_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="작성자를 찾을 수 없습니다")
    return requested_id


def check_access(cur, user, master_id, perm_field):
    """관리자는 전부, 그 외엔 본인 것 + 해당 권한 보유 시만. 현재 작성자 id 반환"""
    cur.execute("SELECT user_id FROM work_log_masters WHERE id = %s", (master_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="업무일지를 찾을 수 없습니다")
    if user.get("is_admin"):
        return row["user_id"]
    if row["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="다른 사용자의 업무일지는 수정/삭제할 수 없습니다")
    if not user.get(perm_field):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")
    return row["user_id"]


def clean(data: WorkLogSave):
    end = data.end_date or data.start_date
    if end < data.start_date:
        raise HTTPException(status_code=400, detail="종료일이 시작일보다 빠릅니다")
    items = [s.strip() for s in data.items if s and s.strip()]
    if not items:
        raise HTTPException(status_code=400, detail="업무 내용을 1개 이상 입력하세요")
    return data.start_date, end, items


def insert_items(cur, master_id, items):
    cur.executemany(
        "INSERT INTO work_log_items (master_id, item_order, content) VALUES (%s, %s, %s)",
        [(master_id, i + 1, content) for i, content in enumerate(items)]
    )


@router.get("/work-logs/users")
def list_users(request: Request):
    """직원 목록 (관리자/업무일지관리자)"""
    user = require_perm(request, "can_access_worklog")
    if not has_perm(user, "can_manage_worklog"):
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    with db_cursor() as cur:
        # admin 계정은 다른 사용자 목록에서 숨김 (본인은 표시)
        cur.execute("SELECT id, name, position FROM users WHERE user_id <> %s OR id = %s ORDER BY name", (HIDDEN_LOGIN_ID, user["id"]))
        return {"data": cur.fetchall()}


@router.get("/work-logs/missing")
def list_missing(request: Request, day: date):
    """해당 날짜 미작성자 (업무일지 작성 권한 보유자 기준). 이름/직급만이라 모두에게 공개"""
    require_perm(request, "can_access_worklog")
    with db_cursor() as cur:
        cur.execute(
            """SELECT u.id, u.name, u.position FROM users u
               WHERE u.can_write_worklog = 1 AND u.user_id <> %s
                 AND NOT EXISTS (SELECT 1 FROM work_log_masters m
                                 WHERE m.user_id = u.id AND m.start_date <= %s AND m.end_date >= %s)
               ORDER BY u.name""",
            (HIDDEN_LOGIN_ID, day, day)
        )
        return {"data": cur.fetchall()}


@router.get("/work-logs")
def list_work_logs(request: Request, start: date, end: date, user_id: Optional[int] = None):
    """start~end와 겹치는 업무일지 (월간/주간 공용).
    작성 여부(작성자)는 모두에게 보이고, 내용(items)은 본인 것 또는 관리자/업무일지관리자만"""
    user = require_perm(request, "can_access_worklog")
    if end < start or (end - start).days > MAX_QUERY_DAYS:
        raise HTTPException(status_code=400, detail="조회 기간이 올바르지 않습니다")
    can_view_all = has_perm(user, "can_manage_worklog")
    if user_id and user_id != user["id"] and not can_view_all:
        raise HTTPException(status_code=403, detail="업무일지는 작성자 본인 및 관리자만 열람 가능합니다.")

    sql = """SELECT m.id, m.user_id, m.start_date, m.end_date, m.is_multi_day,
                    m.created_at, m.updated_at,
                    u.name AS user_name, u.position AS user_position
             FROM work_log_masters m
             JOIN users u ON m.user_id = u.id
             WHERE m.start_date <= %s AND m.end_date >= %s"""
    params = [end, start]
    # admin 계정의 업무일지는 본인 외 아무에게도 안 보임 (작성 여부 포함)
    sql += " AND (u.user_id <> %s OR m.user_id = %s)"
    params += [HIDDEN_LOGIN_ID, user["id"]]
    if user_id:
        sql += " AND m.user_id = %s"
        params.append(user_id)
    sql += " ORDER BY m.start_date, m.id"

    with db_cursor() as cur:
        cur.execute(sql, params)
        logs = cur.fetchall()
        visible_ids = [log["id"] for log in logs if can_view_all or log["user_id"] == user["id"]]
        items = []
        if visible_ids:
            cur.execute(
                f"""SELECT id, master_id, item_order, content FROM work_log_items
                    WHERE master_id IN ({','.join(['%s'] * len(visible_ids))})
                    ORDER BY master_id, item_order""",
                visible_ids
            )
            items = cur.fetchall()

    by_master = {}
    for item in items:
        by_master.setdefault(item["master_id"], []).append(item)
    for log in logs:
        log["items"] = by_master.get(log["id"], [])
    return {"data": logs}


@router.post("/work-logs")
def create_work_log(data: WorkLogSave, request: Request):
    """작성 — 기간 지정 시 전체 기간에 같은 항목 적용 (마스터 1건으로 묶음)"""
    user = require_perm(request, "can_access_worklog")
    if not has_perm(user, "can_write_worklog"):
        raise HTTPException(status_code=403, detail="업무일지 작성 권한이 없습니다")
    start, end, items = clean(data)
    with db_cursor() as cur:
        owner = resolve_owner(cur, user, data.user_id)
        cur.execute(
            "INSERT INTO work_log_masters (user_id, start_date, end_date, is_multi_day) VALUES (%s, %s, %s, %s)",
            (owner, start, end, start != end)
        )
        master_id = cur.lastrowid
        insert_items(cur, master_id, items)
    return {"id": master_id, "message": "업무일지가 저장되었습니다"}


@router.put("/work-logs/{master_id}")
def update_work_log(master_id: int, data: WorkLogSave, request: Request):
    """수정 — 항목은 통째로 교체"""
    user = require_perm(request, "can_access_worklog")
    start, end, items = clean(data)
    with db_cursor() as cur:
        current_owner = check_access(cur, user, master_id, "can_edit_worklog")
        owner = resolve_owner(cur, user, data.user_id or current_owner)
        cur.execute(
            "UPDATE work_log_masters SET user_id = %s, start_date = %s, end_date = %s, is_multi_day = %s WHERE id = %s",
            (owner, start, end, start != end, master_id)
        )
        cur.execute("DELETE FROM work_log_items WHERE master_id = %s", (master_id,))
        insert_items(cur, master_id, items)
    return {"id": master_id, "message": "업무일지가 수정되었습니다"}


@router.delete("/work-logs/{master_id}")
def delete_work_log(master_id: int, request: Request):
    user = require_perm(request, "can_access_worklog")
    with db_cursor() as cur:
        check_access(cur, user, master_id, "can_delete_worklog")
        cur.execute("DELETE FROM work_log_masters WHERE id = %s", (master_id,))
    return {"message": "업무일지가 삭제되었습니다"}
