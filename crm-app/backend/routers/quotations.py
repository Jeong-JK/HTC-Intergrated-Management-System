"""HTC CRM — Quotations Router (견적서)"""
from fastapi import APIRouter, HTTPException, Query, Request
from permissions import require_perm
from typing import Optional
from decimal import Decimal
from datetime import datetime
from database import sales_db_cursor
from models.schemas import QuotationCreate, QuotationUpdate, QuotationStatusUpdate

router = APIRouter(prefix="/quotations", tags=["quotations"])


def get_user(request: Request):
    """인증된 사용자 정보 반환"""
    user = require_perm(request)
    return user


def generate_quotation_no(cur) -> str:
    """견적번호 자동 생성 (QT-YYYY-NNNN)"""
    year = datetime.now().strftime("%Y")
    prefix = f"QT-{year}-"

    cur.execute("""
        SELECT quotation_no FROM quotations
        WHERE quotation_no LIKE %s
        ORDER BY quotation_no DESC LIMIT 1
    """, (f"{prefix}%",))

    last = cur.fetchone()
    if last:
        try:
            last_num = int(last['quotation_no'].split('-')[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1

    return f"{prefix}{next_num:04d}"


def calculate_amounts(items, vat_rate):
    """금액 계산"""
    subtotal = Decimal("0")
    for item in items:
        qty = item.get('quantity', 1) or 1
        price = Decimal(str(item.get('unit_price', 0) or 0))
        item['amount'] = qty * price
        subtotal += item['amount']

    vat_rate = Decimal(str(vat_rate or 10))
    vat_amt = subtotal * vat_rate / Decimal("100")
    total = subtotal + vat_amt

    return subtotal, vat_amt, total


@router.get("")
def list_quotations(
    request: Request,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    company_id: Optional[int] = Query(None)
):
    """견적서 목록 조회"""
    get_user(request)

    sql = """
        SELECT
            q.*,
            (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as item_count
        FROM quotations q
        WHERE 1=1
    """
    params = []

    if search:
        sql += " AND (q.quotation_no LIKE %s OR q.company_name LIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])

    if status:
        sql += " AND q.status = %s"
        params.append(status)

    if company_id:
        sql += " AND q.company_id = %s"
        params.append(company_id)

    sql += " ORDER BY q.created_at DESC"

    with sales_db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/{quotation_id}")
def get_quotation(quotation_id: int, request: Request):
    """견적서 상세 조회"""
    get_user(request)

    with sales_db_cursor() as cur:
        cur.execute("SELECT * FROM quotations WHERE id = %s", (quotation_id,))
        quotation = cur.fetchone()
        if not quotation:
            raise HTTPException(404, "견적서를 찾을 수 없습니다")

        cur.execute("""
            SELECT * FROM quotation_items
            WHERE quotation_id = %s
            ORDER BY seq
        """, (quotation_id,))
        items = cur.fetchall()

        return {**quotation, "items": items}


@router.post("")
def create_quotation(data: QuotationCreate, request: Request):
    """견적서 생성"""
    get_user(request)

    with sales_db_cursor() as cur:
        # 회사 정보 조회
        cur.execute("SELECT id, name FROM companies WHERE id = %s", (data.company_id,))
        company = cur.fetchone()
        if not company:
            raise HTTPException(404, "회사를 찾을 수 없습니다")

        # 담당자 정보 조회 (선택적)
        contact_name = ""
        contact_phone = ""
        contact_email = ""
        if data.contact_id:
            cur.execute("SELECT name, phone, email FROM contacts WHERE id = %s", (data.contact_id,))
            contact = cur.fetchone()
            if contact:
                contact_name = contact.get('name', '')
                contact_phone = contact.get('phone', '')
                contact_email = contact.get('email', '')

        # 견적번호 생성
        quotation_no = generate_quotation_no(cur)

        # 금액 계산
        items = [item.dict() for item in data.items]
        subtotal, vat_amt, total = calculate_amounts(items, data.vat_rate)

        # 견적서 헤더 저장
        cur.execute("""
            INSERT INTO quotations (
                quotation_no, company_id, contact_id,
                company_name, contact_name, contact_phone, contact_email,
                quotation_date, valid_until,
                subtotal, vat_rate, vat_amt, total,
                status, note
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            quotation_no, data.company_id, data.contact_id,
            company['name'], contact_name, contact_phone, contact_email,
            data.quotation_date, data.valid_until,
            subtotal, data.vat_rate, vat_amt, total,
            '작성중', data.note
        ))
        quotation_id = cur.lastrowid

        # 품목 저장
        for seq, item in enumerate(items, 1):
            cur.execute("""
                INSERT INTO quotation_items (
                    quotation_id, seq, item_id, item_name, description,
                    quantity, unit_price, amount, note
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                quotation_id, seq, item.get('item_id'),
                item['item_name'], item.get('description', ''),
                item.get('quantity', 1), item.get('unit_price', 0),
                item['amount'], item.get('note', '')
            ))

        # 생성된 견적서 반환
        cur.execute("SELECT * FROM quotations WHERE id = %s", (quotation_id,))
        quotation = cur.fetchone()
        cur.execute("SELECT * FROM quotation_items WHERE quotation_id = %s ORDER BY seq", (quotation_id,))
        items = cur.fetchall()

        return {**quotation, "items": items}


@router.put("/{quotation_id}")
def update_quotation(quotation_id: int, data: QuotationUpdate, request: Request):
    """견적서 수정"""
    get_user(request)

    with sales_db_cursor() as cur:
        # 존재 확인
        cur.execute("SELECT * FROM quotations WHERE id = %s", (quotation_id,))
        quotation = cur.fetchone()
        if not quotation:
            raise HTTPException(404, "견적서를 찾을 수 없습니다")

        # 회사 정보 (변경 시)
        company_name = quotation['company_name']
        if data.company_id and data.company_id != quotation['company_id']:
            cur.execute("SELECT name FROM companies WHERE id = %s", (data.company_id,))
            company = cur.fetchone()
            if company:
                company_name = company['name']

        # 담당자 정보 (변경 시)
        contact_name = quotation['contact_name']
        contact_phone = quotation['contact_phone']
        contact_email = quotation.get('contact_email', '')
        if data.contact_id is not None:
            if data.contact_id:
                cur.execute("SELECT name, phone, email FROM contacts WHERE id = %s", (data.contact_id,))
                contact = cur.fetchone()
                if contact:
                    contact_name = contact.get('name', '')
                    contact_phone = contact.get('phone', '')
                    contact_email = contact.get('email', '')
            else:
                contact_name = ""
                contact_phone = ""
                contact_email = ""

        # 품목 처리 및 금액 계산
        vat_rate = data.vat_rate if data.vat_rate is not None else quotation['vat_rate']
        if data.items is not None:
            items = [item.dict() for item in data.items]
            subtotal, vat_amt, total = calculate_amounts(items, vat_rate)

            # 기존 품목 삭제 후 재삽입
            cur.execute("DELETE FROM quotation_items WHERE quotation_id = %s", (quotation_id,))
            for seq, item in enumerate(items, 1):
                cur.execute("""
                    INSERT INTO quotation_items (
                        quotation_id, seq, item_id, item_name, description,
                        quantity, unit_price, amount, note
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    quotation_id, seq, item.get('item_id'),
                    item['item_name'], item.get('description', ''),
                    item.get('quantity', 1), item.get('unit_price', 0),
                    item['amount'], item.get('note', '')
                ))
        else:
            subtotal = quotation['subtotal']
            vat_amt = quotation['vat_amt']
            total = quotation['total']

        # 견적서 헤더 업데이트
        cur.execute("""
            UPDATE quotations SET
                company_id = %s,
                contact_id = %s,
                company_name = %s,
                contact_name = %s,
                contact_phone = %s,
                contact_email = %s,
                quotation_date = %s,
                valid_until = %s,
                subtotal = %s,
                vat_rate = %s,
                vat_amt = %s,
                total = %s,
                note = %s
            WHERE id = %s
        """, (
            data.company_id or quotation['company_id'],
            data.contact_id if data.contact_id is not None else quotation['contact_id'],
            company_name,
            contact_name,
            contact_phone,
            contact_email,
            data.quotation_date or quotation['quotation_date'],
            data.valid_until if data.valid_until is not None else quotation['valid_until'],
            subtotal, vat_rate, vat_amt, total,
            data.note if data.note is not None else quotation['note'],
            quotation_id
        ))

        # 수정된 견적서 반환
        cur.execute("SELECT * FROM quotations WHERE id = %s", (quotation_id,))
        quotation = cur.fetchone()
        cur.execute("SELECT * FROM quotation_items WHERE quotation_id = %s ORDER BY seq", (quotation_id,))
        items = cur.fetchall()

        return {**quotation, "items": items}


@router.delete("/{quotation_id}")
def delete_quotation(quotation_id: int, request: Request):
    """견적서 삭제"""
    get_user(request)

    with sales_db_cursor() as cur:
        cur.execute("DELETE FROM quotations WHERE id = %s", (quotation_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "견적서를 찾을 수 없습니다")

    return {"ok": True}


@router.put("/{quotation_id}/status")
def update_quotation_status(quotation_id: int, data: QuotationStatusUpdate, request: Request):
    """견적서 상태 변경"""
    get_user(request)

    valid_statuses = ['작성중', '발송', '승인', '거절', '만료']
    if data.status not in valid_statuses:
        raise HTTPException(400, f"유효하지 않은 상태입니다. ({', '.join(valid_statuses)})")

    with sales_db_cursor() as cur:
        cur.execute("UPDATE quotations SET status = %s WHERE id = %s", (data.status, quotation_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "견적서를 찾을 수 없습니다")

        cur.execute("SELECT * FROM quotations WHERE id = %s", (quotation_id,))
        return cur.fetchone()


@router.post("/{quotation_id}/to-po")
def convert_to_purchase_order(quotation_id: int, request: Request):
    """견적서를 발주서로 변환"""
    get_user(request)

    with sales_db_cursor() as cur:
        # 견적서 조회
        cur.execute("SELECT * FROM quotations WHERE id = %s", (quotation_id,))
        quotation = cur.fetchone()
        if not quotation:
            raise HTTPException(404, "견적서를 찾을 수 없습니다")

        # 견적서 품목 조회
        cur.execute("SELECT * FROM quotation_items WHERE quotation_id = %s ORDER BY seq", (quotation_id,))
        items = cur.fetchall()

        # 발주번호 생성
        year = datetime.now().strftime("%Y")
        prefix = f"PO-{year}-"
        cur.execute("""
            SELECT po_no FROM purchase_orders
            WHERE po_no LIKE %s
            ORDER BY po_no DESC LIMIT 1
        """, (f"{prefix}%",))
        last = cur.fetchone()
        if last:
            try:
                next_num = int(last['po_no'].split('-')[-1]) + 1
            except:
                next_num = 1
        else:
            next_num = 1
        po_no = f"{prefix}{next_num:04d}"

        # 발주서 생성
        cur.execute("""
            INSERT INTO purchase_orders (
                po_no, quotation_id, company_id, contact_id,
                company_name, contact_name, contact_phone, contact_email,
                order_date, subtotal, vat_rate, vat_amt, total,
                status, note
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURDATE(), %s, %s, %s, %s, %s, %s)
        """, (
            po_no, quotation_id, quotation['company_id'], quotation['contact_id'],
            quotation['company_name'], quotation['contact_name'],
            quotation['contact_phone'], quotation.get('contact_email', ''),
            quotation['subtotal'], quotation['vat_rate'],
            quotation['vat_amt'], quotation['total'],
            '발주', quotation['note']
        ))
        po_id = cur.lastrowid

        # 발주서 품목 복사
        for item in items:
            cur.execute("""
                INSERT INTO purchase_order_items (
                    po_id, seq, item_id, item_name, description,
                    quantity, unit_price, amount, note
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                po_id, item['seq'], item['item_id'],
                item['item_name'], item['description'],
                item['quantity'], item['unit_price'],
                item['amount'], item['note']
            ))

        # 견적서 상태를 '승인'으로 변경
        cur.execute("UPDATE quotations SET status = '승인' WHERE id = %s", (quotation_id,))

        # 생성된 발주서 반환
        cur.execute("SELECT * FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()
        cur.execute("SELECT * FROM purchase_order_items WHERE po_id = %s ORDER BY seq", (po_id,))
        po_items = cur.fetchall()

        return {**po, "items": po_items}
