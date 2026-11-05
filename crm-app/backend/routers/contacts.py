"""HTC CRM — Contacts Router"""
from fastapi import APIRouter, HTTPException, Query, Request
from permissions import require_perm
from fastapi.responses import StreamingResponse
from typing import Optional, List
from pydantic import BaseModel
from database import sales_db_cursor
from datetime import datetime, timedelta
from io import BytesIO
from urllib.parse import quote
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

router = APIRouter(prefix="/contacts", tags=["contacts"])

CONTACT_CATEGORIES = [
    '거래업체&벤더',
    '컨택업체',
    '기관&협회',
    '공급업체',
    '기타업체',
    '분류필요'
]


class ContactCreate(BaseModel):
    team_id: int
    name: str
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    category: Optional[str] = '분류필요'
    note: Optional[str] = None


class ContactUpdate(BaseModel):
    team_id: Optional[int] = None
    name: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    category: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None  # 'active' or 'resigned'


@router.get("/categories", response_model=List[str])
def get_categories():
    """카테고리 목록 조회"""
    return CONTACT_CATEGORIES


@router.get("")
def list_contacts(
    request: Request,
    team_id: Optional[int] = Query(None),
    company_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None)
):
    """연락처 목록 조회"""
    # 미팅 조회 권한 확인
    user = getattr(request.state, 'user', None)
    can_view_meetings = user and (user.get('is_admin') or user.get('can_view_meeting'))

    # 권한에 따라 SQL 쿼리 다르게 구성
    if can_view_meetings:
        sql = """
            SELECT
                c.*,
                t.name as team_name,
                t.company_id,
                comp.name as company_name,
                (SELECT MAX(meeting_date) FROM meetings WHERE contact_id = c.id) as last_meeting_date
            FROM contacts c
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE 1=1
        """
    else:
        sql = """
            SELECT
                c.*,
                t.name as team_name,
                t.company_id,
                comp.name as company_name,
                NULL as last_meeting_date
            FROM contacts c
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE 1=1
        """
    params = []

    if team_id:
        sql += " AND c.team_id = %s"
        params.append(team_id)

    if company_id:
        sql += " AND t.company_id = %s"
        params.append(company_id)

    if search:
        # 이전 회사명(이직 이력)에서도 검색
        sql += """ AND (c.name LIKE %s OR c.position LIKE %s OR c.phone LIKE %s OR c.email LIKE %s OR c.note LIKE %s
                   OR comp.name LIKE %s OR t.name LIKE %s
                   OR c.id IN (SELECT contact_id FROM contact_transfer_history WHERE from_company_name LIKE %s OR from_team_name LIKE %s))"""
        search_param = f"%{search}%"
        params.extend([search_param] * 9)

    sql += " ORDER BY comp.name, t.name, c.name"

    with sales_db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/stale")
def get_stale_contacts(request: Request, days: int = Query(30, description="미팅이 없는 일수")):
    """오래된 연락처 조회 (N일 이상 미팅 없음)"""
    # 미팅 조회 권한 확인 - 이 API는 미팅 데이터 기반이므로 권한 필수
    user = require_perm(request, "can_view_meeting")

    cutoff_date = datetime.now() - timedelta(days=days)

    sql = """
        SELECT
            c.*,
            t.name as team_name,
            t.company_id,
            comp.name as company_name,
            (SELECT MAX(meeting_date) FROM meetings WHERE contact_id = c.id) as last_meeting_date
        FROM contacts c
        LEFT JOIN teams t ON c.team_id = t.id
        LEFT JOIN companies comp ON t.company_id = comp.id
        WHERE NOT EXISTS (
            SELECT 1 FROM meetings m
            WHERE m.contact_id = c.id
            AND m.meeting_date >= %s
        )
        ORDER BY comp.name, t.name, c.name
    """

    with sales_db_cursor() as cur:
        cur.execute(sql, (cutoff_date,))
        return cur.fetchall()


@router.get("/export/excel")
def export_contacts_excel(request: Request):
    """담당자 목록 엑셀 다운로드 (카테고리별 시트)"""
    sql = """
        SELECT
            c.category,
            comp.name as company_name,
            t.name as team_name,
            c.name as contact_name,
            c.position,
            c.phone,
            c.email,
            c.note
        FROM contacts c
        LEFT JOIN teams t ON c.team_id = t.id
        LEFT JOIN companies comp ON t.company_id = comp.id
        ORDER BY c.category, comp.name, t.name, c.name
    """

    with sales_db_cursor() as cur:
        cur.execute(sql)
        contacts = cur.fetchall()

    # 카테고리별로 데이터 분류
    category_data = {cat: [] for cat in CONTACT_CATEGORIES}

    for contact in contacts:
        cat = contact['category'] or '분류필요'
        if cat not in category_data:
            cat = '분류필요'
        category_data[cat].append(contact)

    # 엑셀 워크북 생성
    wb = Workbook()
    wb.remove(wb.active)

    # 스타일 정의 - 검정 배경에 빨간 굵은 글씨
    header_font = Font(bold=True, color="FF0000")
    header_fill = PatternFill(start_color="000000", end_color="000000", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )

    headers = ['업체명', '부서', '직급', '담당자', '전화번호', '이메일', '비고']

    for category in CONTACT_CATEGORIES:
        ws = wb.create_sheet(title=category[:31])

        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border

        # 데이터 행 스타일 (글씨 크기 10, 가운데 정렬)
        data_font = Font(size=10)
        data_alignment = Alignment(horizontal="center", vertical="center")

        for row_idx, contact in enumerate(category_data[category], 2):
            cell = ws.cell(row=row_idx, column=1, value=contact['company_name'] or '')
            cell.border = thin_border
            cell.font = data_font
            cell.alignment = data_alignment
            cell = ws.cell(row=row_idx, column=2, value=contact['team_name'] or '')
            cell.border = thin_border
            cell.font = data_font
            cell.alignment = data_alignment
            cell = ws.cell(row=row_idx, column=3, value=contact['position'] or '')
            cell.border = thin_border
            cell.font = data_font
            cell.alignment = data_alignment
            cell = ws.cell(row=row_idx, column=4, value=contact['contact_name'] or '')
            cell.border = thin_border
            cell.font = data_font
            cell.alignment = data_alignment
            cell = ws.cell(row=row_idx, column=5, value=contact['phone'] or '')
            cell.border = thin_border
            cell.font = data_font
            cell.alignment = data_alignment
            cell = ws.cell(row=row_idx, column=6, value=contact['email'] or '')
            cell.border = thin_border
            cell.font = data_font
            cell.alignment = data_alignment
            cell = ws.cell(row=row_idx, column=7, value=contact['note'] or '')
            cell.border = thin_border
            cell.font = data_font
            cell.alignment = data_alignment

        # 컬럼 너비 설정
        ws.column_dimensions['A'].width = 19.10   # 업체명
        ws.column_dimensions['B'].width = 37.80   # 부서
        ws.column_dimensions['C'].width = 32.80   # 직급
        ws.column_dimensions['D'].width = 19.30   # 담당자
        ws.column_dimensions['E'].width = 14.40   # 전화번호
        ws.column_dimensions['F'].width = 38.90   # 이메일
        ws.column_dimensions['G'].width = 50.00   # 비고

        # 1행 고정
        ws.freeze_panes = 'A2'

            # 1행에 필터 추가
        if len(category_data[category]) > 0:
            ws.auto_filter.ref = f"A1:G{len(category_data[category]) + 1}"
        else:
            ws.auto_filter.ref = "A1:G1"
        print(f"[DEBUG] {category}: filter={ws.auto_filter.ref}")

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    print(f"[DEBUG] Excel file size: {len(output.getvalue())} bytes")

    filename = f"담당자목록_{datetime.now().strftime('%Y%m%d')}.xlsx"
    encoded_filename = quote(filename)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )


@router.get("/{contact_id}")
def get_contact(contact_id: int):
    """연락처 상세 조회 (이직 이력 포함)"""
    with sales_db_cursor() as cur:
        cur.execute("""
            SELECT
                c.*,
                t.name as team_name,
                t.company_id,
                comp.name as company_name
            FROM contacts c
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE c.id = %s
        """, (contact_id,))
        contact = cur.fetchone()
        if not contact:
            raise HTTPException(404, "Contact not found")

        # 이직 이력 조회
        cur.execute("""
            SELECT * FROM contact_transfer_history
            WHERE contact_id = %s
            ORDER BY transferred_at DESC
        """, (contact_id,))
        contact['transfer_history'] = cur.fetchall()

        return contact


@router.get("/{contact_id}/transfer-history")
def get_contact_transfer_history(contact_id: int):
    """담당자 이직 이력 조회"""
    with sales_db_cursor() as cur:
        cur.execute("SELECT id FROM contacts WHERE id = %s", (contact_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Contact not found")

        cur.execute("""
            SELECT * FROM contact_transfer_history
            WHERE contact_id = %s
            ORDER BY transferred_at DESC
        """, (contact_id,))
        return cur.fetchall()


class TransferHistoryCreate(BaseModel):
    from_company_name: str
    from_team_name: Optional[str] = None
    transferred_at: Optional[str] = None  # YYYY-MM-DD 형식


@router.post("/{contact_id}/transfer-history")
def add_transfer_history(contact_id: int, data: TransferHistoryCreate, request: Request):
    """담당자 이직 이력 수동 추가 (이전 회사 정보 기록)"""
    require_perm(request, "can_transfer_contact")

    with sales_db_cursor() as cur:
        # 현재 담당자 정보 조회
        cur.execute("""
            SELECT c.*, t.name as team_name, t.company_id, comp.name as company_name
            FROM contacts c
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE c.id = %s
        """, (contact_id,))
        contact = cur.fetchone()
        if not contact:
            raise HTTPException(404, "Contact not found")

        # 이직 날짜 처리
        transfer_date = data.transferred_at if data.transferred_at else datetime.now().strftime('%Y-%m-%d')

        # 이력 추가 (이전 회사 → 현재 회사)
        cur.execute("""
            INSERT INTO contact_transfer_history
            (contact_id, from_company_id, from_company_name, from_team_id, from_team_name,
             to_company_id, to_company_name, to_team_id, to_team_name, transferred_at)
            VALUES (%s, NULL, %s, NULL, %s, %s, %s, %s, %s, %s)
        """, (
            contact_id,
            data.from_company_name,
            data.from_team_name,
            contact['company_id'], contact['company_name'],
            contact['team_id'], contact['team_name'],
            transfer_date
        ))

        return {"ok": True, "message": "이직 이력이 추가되었습니다."}


@router.delete("/{contact_id}/transfer-history/{history_id}")
def delete_transfer_history(contact_id: int, history_id: int, request: Request):
    """담당자 이직 이력 삭제"""
    require_perm(request, "can_transfer_contact")

    with sales_db_cursor() as cur:
        cur.execute("""
            DELETE FROM contact_transfer_history
            WHERE id = %s AND contact_id = %s
        """, (history_id, contact_id))

        if cur.rowcount == 0:
            raise HTTPException(404, "Transfer history not found")

        return {"ok": True}


@router.post("")
def create_contact(contact: ContactCreate, request: Request):
    """연락처 생성"""
    require_perm(request, "can_edit_company")
    with sales_db_cursor() as cur:
        # 팀 존재 확인
        cur.execute("SELECT id FROM teams WHERE id = %s", (contact.team_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Team not found")

        # 카테고리가 빈 문자열이면 '분류필요'로 설정
        category = contact.category if contact.category and contact.category.strip() else '분류필요'

        cur.execute(
            """INSERT INTO contacts (team_id, name, position, phone, email, category, note)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (contact.team_id, contact.name, contact.position, contact.phone, contact.email, category, contact.note)
        )
        new_id = cur.lastrowid
        cur.execute("""
            SELECT
                c.*,
                t.name as team_name,
                t.company_id,
                comp.name as company_name
            FROM contacts c
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE c.id = %s
        """, (new_id,))
        return cur.fetchone()


@router.put("/{contact_id}")
def update_contact(contact_id: int, contact: ContactUpdate, request: Request):
    """연락처 정보 수정"""
    # team_id 변경은 이직 처리 권한 필요, 그 외는 수정 권한 필요
    if contact.team_id is not None:
        require_perm(request, "can_transfer_contact")
    else:
        require_perm(request, "can_edit_company")
    with sales_db_cursor() as cur:
        # 현재 정보 조회 (이직 이력 저장용)
        cur.execute("""
            SELECT c.*, t.name as team_name, t.company_id, comp.name as company_name
            FROM contacts c
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE c.id = %s
        """, (contact_id,))
        current_contact = cur.fetchone()
        if not current_contact:
            raise HTTPException(404, "Contact not found")

        # 수정할 필드만 업데이트
        updates = []
        params = []

        # 이직 처리 (team_id 변경) 시 이력 저장
        if contact.team_id is not None and contact.team_id != current_contact['team_id']:
            # 새 팀 정보 조회
            cur.execute("""
                SELECT t.id, t.name as team_name, t.company_id, c.name as company_name
                FROM teams t
                LEFT JOIN companies c ON t.company_id = c.id
                WHERE t.id = %s
            """, (contact.team_id,))
            new_team = cur.fetchone()
            if not new_team:
                raise HTTPException(404, "Team not found")

            # 이직 이력 저장
            cur.execute("""
                INSERT INTO contact_transfer_history
                (contact_id, from_company_id, from_company_name, from_team_id, from_team_name,
                 to_company_id, to_company_name, to_team_id, to_team_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                contact_id,
                current_contact['company_id'], current_contact['company_name'],
                current_contact['team_id'], current_contact['team_name'],
                new_team['company_id'], new_team['company_name'],
                new_team['id'], new_team['team_name']
            ))

            updates.append("team_id = %s")
            params.append(contact.team_id)

        if contact.name is not None:
            updates.append("name = %s")
            params.append(contact.name)

        if contact.position is not None:
            updates.append("position = %s")
            params.append(contact.position)

        if contact.phone is not None:
            updates.append("phone = %s")
            params.append(contact.phone)

        if contact.email is not None:
            updates.append("email = %s")
            params.append(contact.email)

        if contact.category is not None:
            updates.append("category = %s")
            # 카테고리가 빈 문자열이면 '분류필요'로 설정
            category_value = contact.category if contact.category and contact.category.strip() else '분류필요'
            params.append(category_value)

        if contact.note is not None:
            updates.append("note = %s")
            params.append(contact.note)

        if contact.status is not None:
            if contact.status not in ('active', 'resigned'):
                raise HTTPException(400, "Invalid status. Must be 'active' or 'resigned'")
            updates.append("status = %s")
            params.append(contact.status)

        if not updates:
            raise HTTPException(400, "No fields to update")

        params.append(contact_id)
        sql = f"UPDATE contacts SET {', '.join(updates)} WHERE id = %s"

        cur.execute(sql, params)
        cur.execute("""
            SELECT
                c.*,
                t.name as team_name,
                t.company_id,
                comp.name as company_name
            FROM contacts c
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE c.id = %s
        """, (contact_id,))
        return cur.fetchone()


@router.post("/{contact_id}/resign")
def resign_contact(contact_id: int, request: Request):
    """담당자 퇴사 처리"""
    require_perm(request, "can_transfer_contact")
    with sales_db_cursor() as cur:
        cur.execute("SELECT id, status FROM contacts WHERE id = %s", (contact_id,))
        contact = cur.fetchone()
        if not contact:
            raise HTTPException(404, "Contact not found")

        if contact['status'] == 'resigned':
            raise HTTPException(400, "이미 퇴사 처리된 담당자입니다")

        cur.execute("UPDATE contacts SET status = 'resigned' WHERE id = %s", (contact_id,))

        # 업데이트된 정보 반환
        cur.execute("""
            SELECT
                c.*,
                t.name as team_name,
                t.company_id,
                comp.name as company_name
            FROM contacts c
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE c.id = %s
        """, (contact_id,))
        return cur.fetchone()


@router.post("/{contact_id}/restore")
def restore_contact(contact_id: int, request: Request):
    """담당자 퇴사 취소 (복직)"""
    require_perm(request, "can_transfer_contact")
    with sales_db_cursor() as cur:
        cur.execute("SELECT id, status FROM contacts WHERE id = %s", (contact_id,))
        contact = cur.fetchone()
        if not contact:
            raise HTTPException(404, "Contact not found")

        if contact['status'] == 'active':
            raise HTTPException(400, "현직 담당자입니다")

        cur.execute("UPDATE contacts SET status = 'active' WHERE id = %s", (contact_id,))

        # 업데이트된 정보 반환
        cur.execute("""
            SELECT
                c.*,
                t.name as team_name,
                t.company_id,
                comp.name as company_name
            FROM contacts c
            LEFT JOIN teams t ON c.team_id = t.id
            LEFT JOIN companies comp ON t.company_id = comp.id
            WHERE c.id = %s
        """, (contact_id,))
        return cur.fetchone()


@router.delete("/{contact_id}")
def delete_contact(contact_id: int, request: Request):
    """연락처 삭제 (미팅 기록도 함께 삭제됨 - CASCADE)"""
    require_perm(request, "can_delete_company")
    with sales_db_cursor() as cur:
        cur.execute("DELETE FROM contacts WHERE id = %s", (contact_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Contact not found")

    return {"ok": True}
