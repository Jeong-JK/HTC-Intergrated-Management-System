"""HTC Inventory — Companies (CRM) Router"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from models.schemas import CompanyCreate, CompanyUpdate
from database import db_cursor, sales_db_cursor

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("")
def list_companies(search: Optional[str] = Query(None)):
    """업체 목록 조회"""
    sql = "SELECT * FROM companies WHERE 1=1"
    params = []

    if search:
        sql += " AND company_name LIKE %s"
        params.append(f"%{search}%")

    sql += " ORDER BY company_name"

    with db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/{company_id}")
def get_company(company_id: int):
    """업체 상세 조회"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM companies WHERE id=%s", (company_id,))
        company = cur.fetchone()
        if not company:
            raise HTTPException(404, "Company not found")
        return company


@router.post("")
def create_company(company: CompanyCreate):
    """업체 등록"""
    sql = """
        INSERT INTO companies (company_name, contact_person, contact_phone)
        VALUES (%s, %s, %s)
    """
    with db_cursor() as cur:
        try:
            cur.execute(sql, (
                company.company_name,
                company.contact_person,
                company.contact_phone,
            ))
            new_id = cur.lastrowid
            cur.execute("SELECT * FROM companies WHERE id=%s", (new_id,))
            return cur.fetchone()
        except Exception as e:
            if "Duplicate entry" in str(e):
                raise HTTPException(400, f"업체명 '{company.company_name}'이 이미 존재합니다")
            raise


@router.put("/{company_id}")
def update_company(company_id: int, company: CompanyUpdate):
    """업체 정보 수정"""
    with db_cursor() as cur:
        # 존재 확인
        cur.execute("SELECT * FROM companies WHERE id=%s", (company_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Company not found")

        # 수정할 필드만 업데이트
        updates = []
        params = []

        if company.company_name is not None:
            updates.append("company_name=%s")
            params.append(company.company_name)

        if company.contact_person is not None:
            updates.append("contact_person=%s")
            params.append(company.contact_person)

        if company.contact_phone is not None:
            updates.append("contact_phone=%s")
            params.append(company.contact_phone)

        if not updates:
            raise HTTPException(400, "No fields to update")

        params.append(company_id)
        sql = f"UPDATE companies SET {', '.join(updates)} WHERE id=%s"

        try:
            cur.execute(sql, params)
            cur.execute("SELECT * FROM companies WHERE id=%s", (company_id,))
            return cur.fetchone()
        except Exception as e:
            if "Duplicate entry" in str(e):
                raise HTTPException(400, f"업체명 '{company.company_name}'이 이미 존재합니다")
            raise


@router.delete("/{company_id}")
def delete_company(company_id: int):
    """업체 삭제"""
    with db_cursor() as cur:
        # 대여 기록이 있는지 확인
        cur.execute(
            "SELECT COUNT(*) as cnt FROM rental_headers WHERE company_id=%s",
            (company_id,)
        )
        if cur.fetchone()["cnt"] > 0:
            raise HTTPException(400, "대여 기록이 있는 업체는 삭제할 수 없습니다")

        cur.execute("DELETE FROM companies WHERE id=%s", (company_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Company not found")

    return {"ok": True}


@router.get("/sales/list")
def list_sales_companies(search: Optional[str] = Query(None)):
    """htc_sales DB에서 업체 목록 조회 (업체명, 담당자명, 전화번호)"""
    sql = """
        SELECT
            c.id,
            c.name as company_name,
            ct.name as contact_name,
            ct.phone as contact_phone,
            ct.position
        FROM companies c
        LEFT JOIN teams t ON c.id = t.company_id
        LEFT JOIN contacts ct ON t.id = ct.team_id
        WHERE 1=1
    """
    params = []

    if search:
        sql += " AND c.name LIKE %s"
        params.append(f"%{search}%")

    sql += " ORDER BY c.name, ct.name"

    with sales_db_cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

        # 업체별로 그룹화
        companies_dict = {}
        for row in rows:
            company_id = row['id']
            if company_id not in companies_dict:
                companies_dict[company_id] = {
                    'id': company_id,
                    'company_name': row['company_name'],
                    'contacts': []
                }

            if row['contact_name']:
                companies_dict[company_id]['contacts'].append({
                    'name': row['contact_name'],
                    'phone': row['contact_phone'],
                    'position': row['position']
                })

        return list(companies_dict.values())
