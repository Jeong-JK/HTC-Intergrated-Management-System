"""HTC CRM — Companies Router (Sales DB)"""
from fastapi import APIRouter, HTTPException, Query, Request
from permissions import require_perm
from typing import Optional
from pydantic import BaseModel
from database import sales_db_cursor

router = APIRouter(prefix="/crm/companies", tags=["crm-companies"])


class CrmCompanyCreate(BaseModel):
    name: str


class CrmCompanyUpdate(BaseModel):
    name: Optional[str] = None


@router.get("")
def list_crm_companies(request: Request, search: Optional[str] = Query(None)):
    """CRM 회사 목록 조회 (teams, contacts 포함)"""
    # 미팅 조회 권한 확인
    user = getattr(request.state, 'user', None)
    can_view_meetings = user and (user.get('is_admin') or user.get('can_view_meeting'))

    # 권한에 따라 SQL 쿼리 다르게 구성
    if can_view_meetings:
        sql = """
            SELECT
                c.id,
                c.name,
                c.created_at,
                COUNT(DISTINCT t.id) as team_count,
                COUNT(DISTINCT ct.id) as contact_count,
                MAX(m.meeting_date) as last_meeting_date
            FROM companies c
            LEFT JOIN teams t ON c.id = t.company_id
            LEFT JOIN contacts ct ON t.id = ct.team_id
            LEFT JOIN meetings m ON ct.id = m.contact_id
            WHERE 1=1
        """
    else:
        sql = """
            SELECT
                c.id,
                c.name,
                c.created_at,
                COUNT(DISTINCT t.id) as team_count,
                COUNT(DISTINCT ct.id) as contact_count,
                NULL as last_meeting_date
            FROM companies c
            LEFT JOIN teams t ON c.id = t.company_id
            LEFT JOIN contacts ct ON t.id = ct.team_id
            WHERE 1=1
        """
    params = []

    if search:
        sql += " AND c.name LIKE %s"
        params.append(f"%{search}%")

    sql += " GROUP BY c.id, c.name, c.created_at"
    sql += " ORDER BY c.name"

    with sales_db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/{company_id}")
def get_crm_company(company_id: int, request: Request):
    """CRM 회사 상세 조회"""
    # 미팅 조회 권한 확인
    user = getattr(request.state, 'user', None)
    can_view_meetings = user and (user.get('is_admin') or user.get('can_view_meeting'))

    with sales_db_cursor() as cur:
        cur.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
        company = cur.fetchone()
        if not company:
            raise HTTPException(404, "Company not found")

        # 팀 목록 조회
        cur.execute("""
            SELECT t.*, COUNT(c.id) as contact_count
            FROM teams t
            LEFT JOIN contacts c ON t.id = c.team_id
            WHERE t.company_id = %s
            GROUP BY t.id
            ORDER BY t.name
        """, (company_id,))
        teams = cur.fetchall()

        # 미팅 통계 (권한 있을 때만)
        if can_view_meetings:
            cur.execute("""
                SELECT
                    COUNT(*) as total_meetings,
                    MAX(m.meeting_date) as last_meeting_date
                FROM meetings m
                JOIN contacts ct ON m.contact_id = ct.id
                JOIN teams t ON ct.team_id = t.id
                WHERE t.company_id = %s
            """, (company_id,))
            meeting_stats = cur.fetchone()
        else:
            meeting_stats = {
                "total_meetings": 0,
                "last_meeting_date": None
            }

        return {
            **company,
            "teams": teams,
            "meeting_stats": meeting_stats
        }


@router.post("")
def create_crm_company(company: CrmCompanyCreate, request: Request):
    """CRM 회사 생성"""
    require_perm(request, "can_add_company")
    with sales_db_cursor() as cur:
        try:
            cur.execute("INSERT INTO companies (name) VALUES (%s)", (company.name,))
            new_id = cur.lastrowid
            cur.execute("SELECT * FROM companies WHERE id = %s", (new_id,))
            return cur.fetchone()
        except Exception as e:
            if "Duplicate entry" in str(e):
                raise HTTPException(400, f"회사명 '{company.name}'이 이미 존재합니다")
            raise


@router.put("/{company_id}")
def update_crm_company(company_id: int, company: CrmCompanyUpdate, request: Request):
    """CRM 회사 정보 수정"""
    require_perm(request, "can_edit_company")
    with sales_db_cursor() as cur:
        # 존재 확인
        cur.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Company not found")

        if company.name is None:
            raise HTTPException(400, "No fields to update")

        try:
            cur.execute("UPDATE companies SET name = %s WHERE id = %s", (company.name, company_id))
            cur.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
            return cur.fetchone()
        except Exception as e:
            if "Duplicate entry" in str(e):
                raise HTTPException(400, f"회사명 '{company.name}'이 이미 존재합니다")
            raise


@router.delete("/{company_id}")
def delete_crm_company(company_id: int, request: Request):
    """CRM 회사 삭제 (팀/연락처/미팅도 함께 삭제됨 - CASCADE)"""
    require_perm(request, "can_delete_company")
    with sales_db_cursor() as cur:
        cur.execute("DELETE FROM companies WHERE id = %s", (company_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Company not found")

    return {"ok": True}


@router.get("/{company_id}/contacts")
def get_company_contacts(company_id: int):
    """회사의 모든 연락처 조회"""
    sql = """
        SELECT
            c.*,
            t.name as team_name,
            (SELECT MAX(meeting_date) FROM meetings WHERE contact_id = c.id) as last_meeting_date,
            (SELECT COUNT(*) FROM meetings WHERE contact_id = c.id) as meeting_count
        FROM contacts c
        JOIN teams t ON c.team_id = t.id
        WHERE t.company_id = %s
        ORDER BY t.name, c.name
    """

    with sales_db_cursor() as cur:
        cur.execute(sql, (company_id,))
        return cur.fetchall()
