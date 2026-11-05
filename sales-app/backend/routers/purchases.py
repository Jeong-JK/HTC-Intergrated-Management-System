"""HTC Sales Pipeline — Purchases (매입 관리) API"""
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from datetime import date
from database import db_cursor
from config import get_logger, CURRENT_YEAR
from sheet_write_sync import update_purchase_in_sheet, is_sheet_sync_enabled

logger = get_logger(__name__)

router = APIRouter(tags=["Purchases"])

# ============ Pydantic Models ============

class PurchaseCreate(BaseModel):
    year: int = Field(..., ge=2020, le=2100)
    po_number: Optional[str] = Field(None, max_length=100)
    quote: Optional[str] = Field(None, max_length=100)
    oc: Optional[str] = Field(None, max_length=100)
    invoice: Optional[str] = Field(None, max_length=100)
    request_number: Optional[str] = Field(None, max_length=50)
    supplier: str = Field(..., min_length=1, max_length=200)
    project: Optional[str] = Field(None, max_length=300)
    project_id: Optional[int] = None
    product_name: str = Field(..., min_length=1, max_length=300)
    quantity: int = Field(1, ge=1)
    net_price: float = Field(0, ge=0)
    currency: str = Field("USD", max_length=10)
    amount: float = Field(0, ge=0)
    expected_date: Optional[str] = None
    received_status: str = Field("미입고", max_length=50)
    payment_date1: Optional[str] = None
    payment_amount1: float = Field(0, ge=0)
    exchange_rate1: Optional[float] = Field(None, ge=0)
    payment_date2: Optional[str] = None
    payment_amount2: float = Field(0, ge=0)
    exchange_rate2: Optional[float] = Field(None, ge=0)

class PurchaseUpdate(BaseModel):
    po_number: Optional[str] = None
    quote: Optional[str] = None
    oc: Optional[str] = None
    invoice: Optional[str] = None
    request_number: Optional[str] = None
    supplier: Optional[str] = None
    project: Optional[str] = None
    project_id: Optional[int] = None
    product_name: Optional[str] = None
    quantity: Optional[int] = None
    net_price: Optional[float] = None
    currency: Optional[str] = None
    amount: Optional[float] = None
    expected_date: Optional[str] = None
    received_status: Optional[str] = None
    payment_date1: Optional[str] = None
    payment_amount1: Optional[float] = None
    exchange_rate1: Optional[float] = None
    payment_date2: Optional[str] = None
    payment_amount2: Optional[float] = None
    exchange_rate2: Optional[float] = None
    bar_note: Optional[str] = None
    bar_start_date: Optional[str] = None
    bar_end_date: Optional[str] = None

# ============ API Endpoints ============

@router.get("/purchases")
def get_purchases(
    year: int = CURRENT_YEAR,
    supplier: Optional[str] = None,
    po_number: Optional[str] = None,
    received_status: Optional[str] = None,
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """매입 목록 조회"""
    with db_cursor() as cur:
        query = """
            SELECT pu.*, p.project_no, CONCAT(p.customer, '_', p.project_name) as project_match
            FROM purchases pu
            LEFT JOIN projects p ON pu.project_id = p.id
            WHERE pu.year = %s
        """
        params = [year]

        if supplier:
            query += " AND pu.supplier LIKE %s"
            params.append(f"%{supplier}%")
        if po_number:
            query += " AND pu.po_number LIKE %s"
            params.append(f"%{po_number}%")
        if received_status:
            query += " AND pu.received_status = %s"
            params.append(received_status)

        query += " ORDER BY pu.id LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        cur.execute(query, params)
        return cur.fetchall()

@router.get("/purchases/by-po")
def get_purchases_by_po(year: int = 2026):
    """PO별 매입 그룹화 조회"""
    with db_cursor() as cur:
        cur.execute("""
            SELECT
                po_number,
                supplier,
                COUNT(*) as item_count,
                SUM(amount) as total_amount,
                MIN(expected_date) as expected_date,
                GROUP_CONCAT(DISTINCT received_status) as received_statuses,
                SUM(payment_amount1 + payment_amount2) as total_paid
            FROM purchases
            WHERE year = %s
            GROUP BY po_number, supplier
            ORDER BY po_number
        """, (year,))
        return cur.fetchall()

@router.get("/purchases/by-po/{po_number}")
def get_purchases_by_po_number(po_number: str, year: int = 2026):
    """발주서 번호로 품목 목록 조회"""
    with db_cursor() as cur:
        cur.execute("""
            SELECT *
            FROM purchases
            WHERE po_number = %s AND year = %s
            ORDER BY id
        """, (po_number, year))
        items = cur.fetchall()
        logger.debug(f"PO: {po_number}, Year: {year}, Found: {len(items)} items")

        # 같은 PO의 공통 환율 찾기 (USD 품목 중 환율이 있는 첫 번째 것)
        po_exchange_rate = None
        for item in items:
            if item.get('currency', 'USD') == 'USD':
                rate = item.get('exchange_rate1') or item.get('exchange_rate2')
                if rate:
                    po_exchange_rate = float(rate)
                    break

        # 모든 품목에 po_exchange_rate 추가
        for item in items:
            item['po_exchange_rate'] = po_exchange_rate

        return items

@router.get("/purchases/{purchase_id}")
def get_purchase(purchase_id: int):
    """매입 상세 조회"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM purchases WHERE id = %s", (purchase_id,))
        purchase = cur.fetchone()
        if not purchase:
            raise HTTPException(status_code=404, detail="매입 정보를 찾을 수 없습니다")
        return purchase

@router.post("/purchases")
def create_purchase(purchase: PurchaseCreate):
    """매입 생성"""
    try:
        with db_cursor() as cur:
            # project 문자열로 project_id 찾기 (project_id가 없을 경우)
            project_id = purchase.project_id
            if not project_id and purchase.project:
                cur.execute("""
                    SELECT id FROM projects
                    WHERE CONCAT(customer, '_', project_name) = %s AND year = %s
                """, (purchase.project, purchase.year))
                result = cur.fetchone()
                if result:
                    project_id = result['id']

            cur.execute("""
                INSERT INTO purchases
                (year, po_number, quote, oc, invoice, request_number, supplier, project, project_id,
                 product_name, quantity, net_price, currency, amount, expected_date, received_status,
                 payment_date1, payment_amount1, exchange_rate1,
                 payment_date2, payment_amount2, exchange_rate2)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                purchase.year, purchase.po_number, purchase.quote, purchase.oc, purchase.invoice,
                purchase.request_number, purchase.supplier, purchase.project, project_id, purchase.product_name,
                purchase.quantity, purchase.net_price, purchase.currency, purchase.amount, purchase.expected_date,
                purchase.received_status, purchase.payment_date1, purchase.payment_amount1,
                purchase.exchange_rate1, purchase.payment_date2, purchase.payment_amount2,
                purchase.exchange_rate2
            ))
            return {"id": cur.lastrowid, "message": "매입이 생성되었습니다"}
    except Exception as e:
        logger.error(f"create_purchase failed: {e}")
        logger.debug(f"purchase data: {purchase.dict()}")
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/purchases/{purchase_id}")
def update_purchase(purchase_id: int, purchase: PurchaseUpdate, background_tasks: BackgroundTasks):
    """매입 업데이트"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM purchases WHERE id = %s", (purchase_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="매입 정보를 찾을 수 없습니다")

        update_data = purchase.dict(exclude_unset=True)

        # project가 변경되면 project_id도 자동으로 찾아서 업데이트
        if 'project' in update_data and update_data['project']:
            cur.execute("""
                SELECT id FROM projects
                WHERE CONCAT(customer, '_', project_name) = %s AND year = %s
            """, (update_data['project'], existing['year']))
            result = cur.fetchone()
            if result:
                update_data['project_id'] = result['id']

        updates = []
        params = []
        for key, value in update_data.items():
            updates.append(f"{key} = %s")
            params.append(value)

        if updates:
            params.append(purchase_id)
            query = f"UPDATE purchases SET {', '.join(updates)} WHERE id = %s"
            cur.execute(query, params)

        # 구글 시트 동기화 (백그라운드에서 실행)
        if is_sheet_sync_enabled() and update_data:
            background_tasks.add_task(
                update_purchase_in_sheet,
                purchase_id,
                update_data,
                dict(existing)
            )

        return {"message": "매입이 업데이트되었습니다"}

@router.delete("/purchases/{purchase_id}")
def delete_purchase(purchase_id: int):
    """매입 삭제"""
    with db_cursor() as cur:
        cur.execute("DELETE FROM purchases WHERE id = %s", (purchase_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="매입 정보를 찾을 수 없습니다")
        return {"message": "매입이 삭제되었습니다"}

@router.get("/purchases/stats/summary")
def get_purchase_stats(year: int = CURRENT_YEAR):
    """매입 통계 (원화 환산)"""
    with db_cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(DISTINCT po_number) as total_po_count,
                COUNT(*) as total_items,
                SUM(
                    CASE
                        WHEN currency = 'KRW' THEN amount
                        ELSE amount * COALESCE(exchange_rate1, exchange_rate2, 1300)
                    END
                ) as total_amount_krw,
                COUNT(CASE WHEN received_status = '입고완료' THEN 1 END) as received_count,
                COUNT(CASE WHEN received_status = '미입고' THEN 1 END) as not_received_count,
                SUM(
                    CASE
                        WHEN currency = 'KRW' THEN COALESCE(payment_amount1, 0) + COALESCE(payment_amount2, 0)
                        ELSE COALESCE(payment_amount1, 0) * COALESCE(exchange_rate1, 1300)
                           + COALESCE(payment_amount2, 0) * COALESCE(exchange_rate2, 1300)
                    END
                ) as total_paid_krw
            FROM purchases
            WHERE year = %s
        """, (year,))
        return cur.fetchone()
