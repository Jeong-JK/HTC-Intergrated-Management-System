"""HTC Inventory — 업무일지 캘린더 Router"""
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from database import db_cursor
from routers.auth import rank_order, require_perm

router = APIRouter(tags=["work_logs"])

MAX_QUERY_DAYS = 62  # 월간 달력 6주(42일) + 여유
SEARCH_LIMIT = 300  # 검색 결과 최대 줄 수
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
    color_shade: Optional[int] = Field(None, ge=0, le=5)  # 작성자 계열 안의 색 단계 (None = 기본)


class HueSave(BaseModel):
    hue: str = ""


# ── 캘린더 색: 사람마다 계열(hue) 하나 고정(서로 겹치지 않게), 일지마다 그 계열 안의 단계(0~5)를 고름
# 일지엔 단계만 저장하므로 다른 계열 색은 저장될 수 없음. 값은 Tailwind 기본 색상 300~800
HUES = ('blue', 'red', 'green', 'orange', 'violet', 'teal', 'pink', 'yellow', 'indigo', 'sky', 'lime', 'amber', 'purple', 'cyan', 'slate', 'stone')  # 자동 배정 순서 (서로 잘 구분되는 순)
HUE_NAMES = {'red': '빨강', 'orange': '주황', 'amber': '호박', 'yellow': '노랑', 'lime': '연두', 'green': '초록', 'teal': '청록', 'cyan': '시안', 'sky': '하늘', 'blue': '파랑', 'indigo': '남색', 'violet': '보라', 'purple': '자주', 'pink': '분홍', 'stone': '갈회색', 'slate': '회색'}
SHADES = {
    'blue': ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
    'red': ['#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
    'green': ['#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534'],
    'orange': ['#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412'],
    'violet': ['#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'],
    'teal': ['#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59'],
    'pink': ['#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d'],
    'yellow': ['#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e'],
    'indigo': ['#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3'],
    'sky': ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985'],
    'lime': ['#bef264', '#a3e635', '#84cc16', '#65a30d', '#4d7c0f', '#3f6212'],
    'amber': ['#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e'],
    'purple': ['#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8'],
    'cyan': ['#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75'],
    'slate': ['#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b'],
    'stone': ['#d6d3d1', '#a8a29e', '#78716c', '#57534e', '#44403c', '#292524'],
}
DEFAULT_SHADE = 2  # 500


def shade_color(hue, shade=None):
    return SHADES[hue][shade if shade is not None and 0 <= shade < 6 else DEFAULT_SHADE]


def _rgb(hex_color):
    n = int(hex_color[1:], 16)
    return (n >> 16, (n >> 8) & 255, n & 255)


def nearest_hue(hex_color, candidates):
    """예전에 지정한 색(worklog_color)과 가장 가까운 계열"""
    target = _rgb(hex_color)
    return min(candidates, key=lambda h: min(sum((a - b) ** 2 for a, b in zip(target, _rgb(c))) for c in SHADES[h]))


# 예전 화면이 색 미지정 사용자에게 쓰던 자동 색 (id % 12) — 기존 일지 색을 유지하려고 배정 때 참고
LEGACY_AUTO = ['#3b82f6', '#ef4444', '#22c55e', '#f97316', '#a855f7', '#14b8a6', '#ec4899', '#eab308', '#6366f1', '#0ea5e9', '#84cc16', '#64748b']


def ensure_hues(cur):
    """계열이 없는(잘못된) 사용자에게 아직 안 쓰인 계열을 배정·저장 → 이후 고정. {user_id: hue}
    예전에 보이던 색(지정색, 없으면 예전 자동색)과 가장 가까운 계열로. 지정색 있는 사람 먼저, 그 안에선 직급순"""
    cur.execute(f"SELECT id, worklog_hue, worklog_color FROM users ORDER BY {rank_order()}")
    rows = cur.fetchall()
    used = {r["worklog_hue"] for r in rows if r["worklog_hue"] in SHADES}
    hue_of = {r["id"]: r["worklog_hue"] for r in rows if r["worklog_hue"] in SHADES}
    need = [r for r in rows if r["id"] not in hue_of]
    for r in sorted(need, key=lambda r: not r["worklog_color"]):  # 지정색 있는 사람 먼저 (그 안에선 직급순 유지)
        free = [h for h in HUES if h not in used]
        if not free:
            hue = HUES[r["id"] % len(HUES)]  # 계열이 다 차면 겹침 허용
        else:
            hue = nearest_hue(r["worklog_color"] or LEGACY_AUTO[r["id"] % len(LEGACY_AUTO)], free)
        used.add(hue)
        hue_of[r["id"]] = hue
        cur.execute("UPDATE users SET worklog_hue = %s WHERE id = %s", (hue, r["id"]))
    return hue_of


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
        hue_of = ensure_hues(cur)
        cur.execute(f"SELECT id, name, position FROM users WHERE user_id <> %s OR id = %s ORDER BY {rank_order()}", (HIDDEN_LOGIN_ID, user["id"]))
        users = cur.fetchall()
    for u in users:
        u["hue"] = hue_of[u["id"]]
        u["user_color"] = shade_color(u["hue"])
    return {"data": users}


@router.get("/work-logs/palette")
def get_palette(request: Request):
    """계열별 색 단계 + 내 계열 (작성 창 색 고르기용)"""
    user = require_perm(request, "can_access_worklog")
    with db_cursor() as cur:
        hue_of = ensure_hues(cur)
    return {
        "hues": [{"key": h, "name": HUE_NAMES[h], "shades": SHADES[h]} for h in HUES],
        "default_shade": DEFAULT_SHADE,
        "my_hue": hue_of.get(user["id"]),
    }


@router.put("/work-logs/users/{user_id}/hue")
def set_user_hue(user_id: int, data: HueSave, request: Request):
    """직원별 색 계열 지정 (관리자/업무일지관리자) — 다른 사람이 쓰는 계열은 불가"""
    user = require_perm(request, "can_access_worklog")
    if not has_perm(user, "can_manage_worklog"):
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    if data.hue not in SHADES:
        raise HTTPException(status_code=400, detail="알 수 없는 색 계열입니다")
    with db_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        cur.execute("SELECT name FROM users WHERE worklog_hue = %s AND id <> %s", (data.hue, user_id))
        taken = cur.fetchone()
        if taken:
            raise HTTPException(status_code=400, detail=f"{HUE_NAMES[data.hue]} 계열은 이미 {taken['name']}님이 쓰고 있습니다")
        cur.execute("UPDATE users SET worklog_hue = %s WHERE id = %s", (data.hue, user_id))
    return {"message": "색 계열이 저장되었습니다"}


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
               ORDER BY """ + rank_order("u.position", "u.name"),
            (HIDDEN_LOGIN_ID, day, day)
        )
        return {"data": cur.fetchall()}


@router.get("/work-logs/search")
def search_work_logs(request: Request, q: str):
    """검색어가 들어간 업무 줄만 (같은 일지의 다른 줄은 제외). 최신 날짜순.
    관리자/업무일지관리자는 전체, 그 외엔 본인 것만"""
    user = require_perm(request, "can_access_worklog")
    q = q.strip()
    if not q or len(q) > 50:
        raise HTTPException(status_code=400, detail="검색어는 1~50자로 입력하세요")
    like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    sql = """SELECT i.id, i.content, i.item_order, m.id AS master_id, m.user_id,
                    m.start_date, m.end_date, m.is_multi_day,
                    u.name AS user_name, u.position AS user_position
             FROM work_log_items i
             JOIN work_log_masters m ON i.master_id = m.id
             JOIN users u ON m.user_id = u.id
             WHERE i.content LIKE %s AND (u.user_id <> %s OR m.user_id = %s)"""
    params = [like, HIDDEN_LOGIN_ID, user["id"]]
    if not has_perm(user, "can_manage_worklog"):
        sql += " AND m.user_id = %s"
        params.append(user["id"])
    sql += f" ORDER BY m.start_date DESC, m.end_date DESC, {rank_order('u.position', 'u.name')}, m.id, i.item_order LIMIT %s"
    params.append(SEARCH_LIMIT + 1)
    with db_cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    return {"data": rows[:SEARCH_LIMIT], "truncated": len(rows) > SEARCH_LIMIT}


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
                    m.created_at, m.updated_at, m.color_shade,
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
    sql += f" ORDER BY {rank_order('u.position', 'u.name')}, m.user_id, m.start_date, m.id"

    with db_cursor() as cur:
        cur.execute(sql, params)
        logs = cur.fetchall()
        hue_of = ensure_hues(cur)
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
        log["user_hue"] = hue_of[log["user_id"]]
        log["color"] = shade_color(log["user_hue"], log["color_shade"])
        log["user_color"] = shade_color(log["user_hue"])
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
            "INSERT INTO work_log_masters (user_id, start_date, end_date, is_multi_day, color_shade) VALUES (%s, %s, %s, %s, %s)",
            (owner, start, end, start != end, data.color_shade)
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
            "UPDATE work_log_masters SET user_id = %s, start_date = %s, end_date = %s, is_multi_day = %s, color_shade = %s WHERE id = %s",
            (owner, start, end, start != end, data.color_shade, master_id)
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
