"""HTC CRM — Purchase Orders Router (발주서)"""
from fastapi import APIRouter, HTTPException, Query, Request
from permissions import require_perm
from typing import Optional
from decimal import Decimal
from datetime import datetime
from database import sales_db_cursor
from models.schemas import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderStatusUpdate

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


def get_user(request: Request):
    """인증된 사용자 정보 반환"""
    user = require_perm(request)
    return user


def generate_po_no(cur) -> str:
    """발주번호 자동 생성 (PO-YYYY-NNNN)"""
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
            last_num = int(last['po_no'].split('-')[-1])
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
def list_purchase_orders(
    request: Request,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    company_id: Optional[int] = Query(None)
):
    """발주서 목록 조회"""
    get_user(request)

    sql = """
        SELECT
            po.*,
            q.quotation_no,
            (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id) as item_count
        FROM purchase_orders po
        LEFT JOIN quotations q ON po.quotation_id = q.id
        WHERE 1=1
    """
    params = []

    if search:
        sql += " AND (po.po_no LIKE %s OR po.company_name LIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])

    if status:
        sql += " AND po.status = %s"
        params.append(status)

    if company_id:
        sql += " AND po.company_id = %s"
        params.append(company_id)

    sql += " ORDER BY po.created_at DESC"

    with sales_db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/{po_id}")
def get_purchase_order(po_id: int, request: Request):
    """발주서 상세 조회"""
    get_user(request)

    with sales_db_cursor() as cur:
        cur.execute("""
            SELECT po.*, q.quotation_no
            FROM purchase_orders po
            LEFT JOIN quotations q ON po.quotation_id = q.id
            WHERE po.id = %s
        """, (po_id,))
        po = cur.fetchone()
        if not po:
            raise HTTPException(404, "발주서를 찾을 수 없습니다")

        cur.execute("""
            SELECT * FROM purchase_order_items
            WHERE po_id = %s
            ORDER BY seq
        """, (po_id,))
        items = cur.fetchall()

        return {**po, "items": items}


@router.post("")
def create_purchase_order(data: PurchaseOrderCreate, request: Request):
    """발주서 생성"""
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

        # 발주번호 생성
        po_no = generate_po_no(cur)

        # 금액 계산
        items = [item.dict() for item in data.items]
        subtotal, vat_amt, total = calculate_amounts(items, data.vat_rate)

        # 발주서 헤더 저장
        cur.execute("""
            INSERT INTO purchase_orders (
                po_no, quotation_id, company_id, contact_id,
                company_name, contact_name, contact_phone, contact_email,
                order_date, delivery_due,
                subtotal, vat_rate, vat_amt, total,
                status, delivery_address, note
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            po_no, data.quotation_id, data.company_id, data.contact_id,
            company['name'], contact_name, contact_phone, contact_email,
            data.order_date, data.delivery_due,
            subtotal, data.vat_rate, vat_amt, total,
            '발주', data.delivery_address, data.note
        ))
        po_id = cur.lastrowid

        # 품목 저장
        for seq, item in enumerate(items, 1):
            cur.execute("""
                INSERT INTO purchase_order_items (
                    po_id, seq, item_id, item_name, description,
                    quantity, unit_price, amount, note
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                po_id, seq, item.get('item_id'),
                item['item_name'], item.get('description', ''),
                item.get('quantity', 1), item.get('unit_price', 0),
                item['amount'], item.get('note', '')
            ))

        # 생성된 발주서 반환
        cur.execute("SELECT * FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()
        cur.execute("SELECT * FROM purchase_order_items WHERE po_id = %s ORDER BY seq", (po_id,))
        items = cur.fetchall()

        return {**po, "items": items}


@router.put("/{po_id}")
def update_purchase_order(po_id: int, data: PurchaseOrderUpdate, request: Request):
    """발주서 수정"""
    get_user(request)

    with sales_db_cursor() as cur:
        # 존재 확인
        cur.execute("SELECT * FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()
        if not po:
            raise HTTPException(404, "발주서를 찾을 수 없습니다")

        # 회사 정보 (변경 시)
        company_name = po['company_name']
        if data.company_id and data.company_id != po['company_id']:
            cur.execute("SELECT name FROM companies WHERE id = %s", (data.company_id,))
            company = cur.fetchone()
            if company:
                company_name = company['name']

        # 담당자 정보 (변경 시)
        contact_name = po['contact_name']
        contact_phone = po['contact_phone']
        contact_email = po.get('contact_email', '')
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
        vat_rate = data.vat_rate if data.vat_rate is not None else po['vat_rate']
        if data.items is not None:
            items = [item.dict() for item in data.items]
            subtotal, vat_amt, total = calculate_amounts(items, vat_rate)

            # 기존 품목 삭제 후 재삽입
            cur.execute("DELETE FROM purchase_order_items WHERE po_id = %s", (po_id,))
            for seq, item in enumerate(items, 1):
                cur.execute("""
                    INSERT INTO purchase_order_items (
                        po_id, seq, item_id, item_name, description,
                        quantity, unit_price, amount, note
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    po_id, seq, item.get('item_id'),
                    item['item_name'], item.get('description', ''),
                    item.get('quantity', 1), item.get('unit_price', 0),
                    item['amount'], item.get('note', '')
                ))
        else:
            subtotal = po['subtotal']
            vat_amt = po['vat_amt']
            total = po['total']

        # 발주서 헤더 업데이트
        cur.execute("""
            UPDATE purchase_orders SET
                company_id = %s,
                contact_id = %s,
                company_name = %s,
                contact_name = %s,
                contact_phone = %s,
                contact_email = %s,
                order_date = %s,
                delivery_due = %s,
                subtotal = %s,
                vat_rate = %s,
                vat_amt = %s,
                total = %s,
                delivery_address = %s,
                note = %s
            WHERE id = %s
        """, (
            data.company_id or po['company_id'],
            data.contact_id if data.contact_id is not None else po['contact_id'],
            company_name,
            contact_name,
            contact_phone,
            contact_email,
            data.order_date or po['order_date'],
            data.delivery_due if data.delivery_due is not None else po['delivery_due'],
            subtotal, vat_rate, vat_amt, total,
            data.delivery_address if data.delivery_address is not None else po['delivery_address'],
            data.note if data.note is not None else po['note'],
            po_id
        ))

        # 수정된 발주서 반환
        cur.execute("SELECT * FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()
        cur.execute("SELECT * FROM purchase_order_items WHERE po_id = %s ORDER BY seq", (po_id,))
        items = cur.fetchall()

        return {**po, "items": items}


@router.delete("/{po_id}")
def delete_purchase_order(po_id: int, request: Request):
    """발주서 삭제"""
    get_user(request)

    with sales_db_cursor() as cur:
        cur.execute("DELETE FROM purchase_orders WHERE id = %s", (po_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "발주서를 찾을 수 없습니다")

    return {"ok": True}


@router.put("/{po_id}/status")
def update_po_status(po_id: int, data: PurchaseOrderStatusUpdate, request: Request):
    """발주서 상태 변경"""
    get_user(request)

    valid_statuses = ['발주', '부분납품', '납품완료', '취소']
    if data.status not in valid_statuses:
        raise HTTPException(400, f"유효하지 않은 상태입니다. ({', '.join(valid_statuses)})")

    with sales_db_cursor() as cur:
        cur.execute("UPDATE purchase_orders SET status = %s WHERE id = %s", (data.status, po_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "발주서를 찾을 수 없습니다")

        cur.execute("SELECT * FROM purchase_orders WHERE id = %s", (po_id,))
        return cur.fetchone()
