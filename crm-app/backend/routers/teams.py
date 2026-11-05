"""HTC CRM — Teams Router"""
from fastapi import APIRouter, HTTPException, Query, Request
from permissions import require_perm
from typing import Optional, List
from pydantic import BaseModel
from database import sales_db_cursor

router = APIRouter(prefix="/teams", tags=["teams"])


class TeamCreate(BaseModel):
    company_id: int
    name: str


class TeamUpdate(BaseModel):
    name: Optional[str] = None


@router.get("")
def list_teams(company_id: Optional[int] = Query(None)):
    """팀 목록 조회"""
    sql = """
        SELECT t.*, c.name as company_name
        FROM teams t
        LEFT JOIN companies c ON t.company_id = c.id
        WHERE 1=1
    """
    params = []

    if company_id:
        sql += " AND t.company_id = %s"
        params.append(company_id)

    sql += " ORDER BY c.name, t.name"

    with sales_db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/{team_id}")
def get_team(team_id: int):
    """팀 상세 조회"""
    with sales_db_cursor() as cur:
        cur.execute("""
            SELECT t.*, c.name as company_name
            FROM teams t
            LEFT JOIN companies c ON t.company_id = c.id
            WHERE t.id = %s
        """, (team_id,))
        team = cur.fetchone()
        if not team:
            raise HTTPException(404, "Team not found")
        return team


@router.post("")
def create_team(team: TeamCreate, request: Request):
    """팀 생성"""
    require_perm(request, "can_edit_company")
    with sales_db_cursor() as cur:
        # 회사 존재 확인
        cur.execute("SELECT id FROM companies WHERE id = %s", (team.company_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Company not found")

        try:
            cur.execute(
                "INSERT INTO teams (company_id, name) VALUES (%s, %s)",
                (team.company_id, team.name)
            )
            new_id = cur.lastrowid
            cur.execute("""
                SELECT t.*, c.name as company_name
                FROM teams t
                LEFT JOIN companies c ON t.company_id = c.id
                WHERE t.id = %s
            """, (new_id,))
            return cur.fetchone()
        except Exception as e:
            if "Duplicate entry" in str(e):
                raise HTTPException(400, f"해당 회사에 '{team.name}' 팀이 이미 존재합니다")
            raise


@router.put("/{team_id}")
def update_team(team_id: int, team: TeamUpdate, request: Request):
    """팀 정보 수정"""
    require_perm(request, "can_edit_company")
    with sales_db_cursor() as cur:
        # 존재 확인
        cur.execute("SELECT * FROM teams WHERE id = %s", (team_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Team not found")

        if team.name is None:
            raise HTTPException(400, "No fields to update")

        try:
            cur.execute("UPDATE teams SET name = %s WHERE id = %s", (team.name, team_id))
            cur.execute("""
                SELECT t.*, c.name as company_name
                FROM teams t
                LEFT JOIN companies c ON t.company_id = c.id
                WHERE t.id = %s
            """, (team_id,))
            return cur.fetchone()
        except Exception as e:
            if "Duplicate entry" in str(e):
                raise HTTPException(400, f"'{team.name}' 팀이 이미 존재합니다")
            raise


@router.delete("/{team_id}")
def delete_team(team_id: int, request: Request):
    """팀 삭제 (연락처가 있으면 삭제 불가)"""
    require_perm(request, "can_delete_company")
    with sales_db_cursor() as cur:
        # 연락처 확인
        cur.execute("SELECT COUNT(*) as cnt FROM contacts WHERE team_id = %s", (team_id,))
        if cur.fetchone()["cnt"] > 0:
            raise HTTPException(400, "연락처가 있는 팀은 삭제할 수 없습니다")

        cur.execute("DELETE FROM teams WHERE id = %s", (team_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Team not found")

    return {"ok": True}
