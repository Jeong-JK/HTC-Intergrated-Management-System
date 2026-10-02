"""HTC CRM — Meetings Router"""
from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional
from pydantic import BaseModel
from database import sales_db_cursor
from datetime import datetime, timedelta

router = APIRouter(prefix="/meetings", tags=["meetings"])


def check_view_permission(request: Request):
    """미팅 조회 권한 확인"""
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if not user.get('is_admin') and not user.get('can_view_meeting'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")


def check_add_permission(request: Request):
    """미팅 추가 권한 확인"""
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if not user.get('is_admin') and not user.get('can_add_meeting'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")


def check_delete_permission(request: Request):
    """미팅 삭제 권한 확인"""
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if not user.get('is_admin') and not user.get('can_delete_meeting'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")


def check_edit_permission(request: Request):
    """미팅 수정 권한 확인"""
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if not user.get('is_admin') and not user.get('can_add_meeting'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")


class MeetingCreate(BaseModel):
    contact_id: int
    meeting_date: datetime
    attendees: Optional[str] = None
    content: Optional[str] = None


class MeetingUpdate(BaseModel):
    meeting_date: Optional[datetime] = None
    attendees: Optional[str] = None
    content: Optional[str] = None


@router.get("")
def list_meetings(
    request: Request,
    contact_id: Optional[int] = Query(None),
    company_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: Optional[int] = Query(100)
):
    """미팅 목록 조회"""
    check_view_permission(request)
    sql = """
        SELECT
            m.*,
            c.name as contact_name,
            c.position as contact_position,
            c.team_id,
            t.name as team_name,
            t.company_id,
            comp.name as company_name
        FROM meetings m
        LEFT JOIN contacts c ON m.contact_id = c.id
        LEFT JOIN teams t ON c.team_id = t.id
        LEFT JOIN companies comp ON t.company_id = comp.id
        WHERE 1=1
    """
    params = []

    if contact_id:
        sql += " AND m.contact_id = %s"
        params.append(contact_id)

    if company_id:
        sql += " AND t.company_id = %s"
        params.append(company_id)

    if start_date:
        sql += " AND m.meeting_date >= %s"
        params.append(start_date)

    if end_date:
        sql += " AND m.meeting_date <= %s"
        params.append(end_date)

    sql += " ORDER BY m.meeting_date DESC"

    if limit:
        sql += f" LIMIT {limit}"

    with sales_db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/recent")
def get_recent_meetings(request: Request, days: int = Query(7, description="최근 N일"), limit: int = Query(100)):
    """최근 미팅 조회"""
    check_view_permission(request)
    cutoff_date = datetime.now() - timedelta(days=days)

    sql = """
        SELECT
            m.*,
            c.name as contact_name,
            c.position as contact_position,
            c.team_id,
            t.name as team_name,
            t.company_id,
            comp.name as company_name
        FROM meetings m
        LEFT JOIN contacts c ON m.contact_id = c.id
        LEFT JOIN teams t ON c.team_id = t.id
        LEFT JOIN companies comp ON t.company_id = comp.id
        WHERE m.meeting_date >= %s
        ORDER BY m.meeting_date DESC
        LIMIT %s
    """

    with sales_db_cursor() as cur:
        cur.execute(sql, (cutoff_date, limit))
        return cur.fetchall()


@router.get("/timeline/{company_id}")
def get_company_timeline(company_id: int, request: Request):
    """회사 타임라인 조회 (모든 미팅 기록)"""
    check_view_permission(request)
    sql = """
        SELECT
            m.*,
            c.name as contact_name,
            c.position as contact_position,
            c.team_id,
            t.name as team_name
        FROM meetings m
        LEFT JOIN contacts c ON m.contact_id = c.id
        LEFT JOIN teams t ON c.team_id = t.id
        WHERE t.company_id = %s
        ORDER BY m.meeting_date DESC
    """

    with sales_db_cursor() as cur:
        cur.execute(sql, (company_id,))
        return cur.fetchall()


@router.get("/{meeting_id}")
def get_meeting(meeting_id: int, request: Request):
    """미팅 상세 조회"""
    check_view_permission(request)
    with sales_db_cursor() as cur:
        cur.execute("""
            SELECT
                m.*,
                c.name as contact_name,
                c.position as contact_position,
                c.team_id,
                t.name as team_name,
                t.company_id,
                comp.name as company_name
            FROM meetings m
            LEFT JOIN contacts c ON m.contact_id = c.id
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE m.id = %s
        """, (meeting_id,))
        meeting = cur.fetchone()
        if not meeting:
            raise HTTPException(404, "Meeting not found")
        return meeting


@router.post("")
def create_meeting(meeting: MeetingCreate, request: Request):
    """미팅 생성"""
    check_add_permission(request)
    with sales_db_cursor() as cur:
        # 연락처 존재 확인
        cur.execute("SELECT id FROM contacts WHERE id = %s", (meeting.contact_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Contact not found")

        cur.execute(
            """INSERT INTO meetings (contact_id, meeting_date, attendees, content)
               VALUES (%s, %s, %s, %s)""",
            (meeting.contact_id, meeting.meeting_date, meeting.attendees, meeting.content)
        )
        new_id = cur.lastrowid
        cur.execute("""
            SELECT
                m.*,
                c.name as contact_name,
                c.position as contact_position,
                c.team_id,
                t.name as team_name,
                t.company_id,
                comp.name as company_name
            FROM meetings m
            LEFT JOIN contacts c ON m.contact_id = c.id
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE m.id = %s
        """, (new_id,))
        return cur.fetchone()


@router.put("/{meeting_id}")
def update_meeting(meeting_id: int, meeting: MeetingUpdate, request: Request):
    """미팅 정보 수정"""
    check_edit_permission(request)
    with sales_db_cursor() as cur:
        # 존재 확인
        cur.execute("SELECT * FROM meetings WHERE id = %s", (meeting_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Meeting not found")

        # 수정할 필드만 업데이트
        updates = []
        params = []

        if meeting.meeting_date is not None:
            updates.append("meeting_date = %s")
            params.append(meeting.meeting_date)

        if meeting.attendees is not None:
            updates.append("attendees = %s")
            params.append(meeting.attendees)

        if meeting.content is not None:
            updates.append("content = %s")
            params.append(meeting.content)

        if not updates:
            raise HTTPException(400, "No fields to update")

        params.append(meeting_id)
        sql = f"UPDATE meetings SET {', '.join(updates)} WHERE id = %s"

        cur.execute(sql, params)
        cur.execute("""
            SELECT
                m.*,
                c.name as contact_name,
                c.position as contact_position,
                c.team_id,
                t.name as team_name,
                t.company_id,
                comp.name as company_name
            FROM meetings m
            LEFT JOIN contacts c ON m.contact_id = c.id
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE m.id = %s
        """, (meeting_id,))
        return cur.fetchone()


@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: int, request: Request):
    """미팅 삭제"""
    check_delete_permission(request)
    with sales_db_cursor() as cur:
        cur.execute("DELETE FROM meetings WHERE id = %s", (meeting_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Meeting not found")

    return {"ok": True}
