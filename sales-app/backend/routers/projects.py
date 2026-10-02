"""HTC Sales Pipeline — Projects (프로젝트 관리) API"""
from fastapi import APIRouter, HTTPException, Request, Query, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date
from database import db_cursor
from config import get_logger, CURRENT_YEAR
from sheet_write_sync import update_project_in_sheet, is_sheet_sync_enabled

logger = get_logger(__name__)

router = APIRouter(tags=["Projects"])


def check_edit_permission(request: Request):
    """프로젝트 수정 권한 확인"""
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if not user.get('is_admin') and not user.get('can_edit_project'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")


def check_delete_permission(request: Request):
    """프로젝트 삭제 권한 확인"""
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if not user.get('is_admin') and not user.get('can_delete_project'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")

# ============ Pydantic Models ============

class PaymentCreate(BaseModel):
    payment_date: str
    payment_amount: float

class SalesItemCreate(BaseModel):
    product_name: str
    quantity: int = 1
    unit_price: float = 0
    total_price: float = 0

class ProjectPurchaseCreate(BaseModel):
    po_number: Optional[str] = None
    supplier: str
    product_name: str
    quantity: int = 1
    unit_price_usd: float = 0
    unit_price_krw: float = 0
    total_price_usd: float = 0
    total_price_krw: float = 0
    expected_date: Optional[str] = None
    received_status: str = "미입고"
    payment_status: Optional[float] = None
    exchange_rate: Optional[float] = None
    actual_order_date: Optional[str] = None  # 실제 발주일 (배송비 절감을 위해 다른 연도 물품과 함께 발주한 경우)

class ProjectCreate(BaseModel):
    year: int = Field(..., ge=2020, le=2100)
    project_no: str = Field(..., min_length=1, max_length=50)
    customer: str = Field(..., min_length=1, max_length=200)
    project_name: str = Field(..., min_length=1, max_length=300)
    supplier: Optional[str] = Field(None, max_length=200)
    delivery_date: Optional[str] = None
    order_amount: float = Field(0, ge=0)
    order_date: Optional[str] = None  # 업체 발주일
    status: str = Field("진행중", max_length=50)
    notes: Optional[str] = None
    payments: List[PaymentCreate] = []
    sales_items: List[SalesItemCreate] = []
    purchase_items: List[ProjectPurchaseCreate] = []

class ProjectUpdate(BaseModel):
    project_no: Optional[str] = None
    customer: Optional[str] = None
    project_name: Optional[str] = None
    supplier: Optional[str] = None
    delivery_date: Optional[str] = None
    order_amount: Optional[float] = None
    order_date: Optional[str] = None  # 업체 발주일
    payment_date: Optional[str] = None  # 수금일
    payment_amount: Optional[float] = None  # 수금액
    status: Optional[str] = None
    notes: Optional[str] = None
    year: Optional[int] = None
    payments: Optional[List[PaymentCreate]] = None
    sales_items: Optional[List[SalesItemCreate]] = None
    purchase_items: Optional[List[ProjectPurchaseCreate]] = None

# ============ API Endpoints ============

@router.get("/projects")
def get_projects(
    year: int = CURRENT_YEAR,
    status: Optional[str] = None,
    customer: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """프로젝트 목록 조회 (판매/매입 품목 포함)"""
    with db_cursor() as cur:
        query = """
            SELECT
                p.*,
                COUNT(DISTINCT si.id) as sales_items_count,
                COUNT(DISTINCT pi.id) as purchase_items_count,
                COALESCE(SUM(pi.total_price_krw), 0) as total_purchase_krw
            FROM projects p
            LEFT JOIN sales_items si ON p.id = si.project_id
            LEFT JOIN purchase_items pi ON p.id = pi.project_id
            WHERE p.year = %s
        """
        params = [year]

        if status:
            query += " AND p.status = %s"
            params.append(status)
        if customer:
            query += " AND p.customer LIKE %s"
            params.append(f"%{customer}%")

        query += " GROUP BY p.id ORDER BY p.project_no LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        cur.execute(query, params)
        projects = cur.fetchall()

        # 각 프로젝트에 판매/매입 품목 추가
        for project in projects:
            project_id = project['id']
            customer = project['customer'] or ''
            project_name = project['project_name'] or ''
            # purchases 테이블의 project 필드 매칭용 (예: "업체명_프로젝트명")
            project_match = f"{customer}_{project_name}"

            # 판매 품목 (row_index 순)
            cur.execute("SELECT * FROM sales_items WHERE project_id = %s ORDER BY row_index", (project_id,))
            project['sales_items'] = cur.fetchall()

            # 매입 품목 (row_index 순)
            cur.execute("""
                SELECT
                    id, po_number, supplier, product_name, quantity,
                    unit_price_usd, unit_price_krw, total_price_usd, total_price_krw,
                    expected_date, received_status, payment_status, exchange_rate,
                    actual_order_date, row_index
                FROM purchase_items
                WHERE project_id = %s
                ORDER BY row_index
            """, (project_id,))
            project['purchase_items'] = cur.fetchall()

            # 수금 정보 (여러 건)
            cur.execute("SELECT * FROM project_payments WHERE project_id = %s ORDER BY payment_date", (project_id,))
            project['payments'] = cur.fetchall()

            # 총 수금액 계산 (payments 합계)
            total_payment = sum(p['payment_amount'] or 0 for p in project['payments'])
            project['payment_amount'] = total_payment

        return projects

@router.get("/projects/{project_id}")
def get_project(project_id: int):
    """프로젝트 상세 조회"""
    with db_cursor() as cur:
        # 프로젝트 기본 정보
        cur.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        project = cur.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

        customer = project['customer'] or ''
        project_name = project['project_name'] or ''
        project_match = f"{customer}_{project_name}"

        # 수금 정보
        cur.execute("SELECT * FROM project_payments WHERE project_id = %s ORDER BY payment_date", (project_id,))
        payments = cur.fetchall()

        # 판매 품목 (row_index 순)
        cur.execute("SELECT * FROM sales_items WHERE project_id = %s ORDER BY row_index", (project_id,))
        sales_items = cur.fetchall()

        # 매입 품목 (row_index 순)
        cur.execute("""
            SELECT
                id, po_number, supplier, product_name, quantity,
                unit_price_usd, unit_price_krw, total_price_usd, total_price_krw,
                expected_date, received_status, payment_status, exchange_rate,
                actual_order_date, row_index
            FROM purchase_items
            WHERE project_id = %s
            ORDER BY row_index
        """, (project_id,))
        purchase_items = cur.fetchall()

        return {
            **project,
            "payments": payments,
            "sales_items": sales_items,
            "purchase_items": purchase_items
        }

@router.post("/projects")
def create_project(project: ProjectCreate):
    """프로젝트 생성"""
    with db_cursor() as cur:
        # 프로젝트 생성
        cur.execute("""
            INSERT INTO projects
            (year, project_no, customer, project_name, supplier, delivery_date, order_amount, order_date, status, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            project.year, project.project_no, project.customer, project.project_name, project.supplier,
            project.delivery_date, project.order_amount, project.order_date, project.status, project.notes
        ))
        project_id = cur.lastrowid

        # 수금 정보 추가
        for payment in project.payments:
            cur.execute("""
                INSERT INTO project_payments (project_id, payment_date, payment_amount)
                VALUES (%s, %s, %s)
            """, (project_id, payment.payment_date, payment.payment_amount))

        # 판매 품목 추가
        for item in project.sales_items:
            cur.execute("""
                INSERT INTO sales_items
                (project_id, product_name, quantity, unit_price, total_price)
                VALUES (%s, %s, %s, %s, %s)
            """, (project_id, item.product_name, item.quantity, item.unit_price, item.total_price))

        # 매입 품목 추가
        for item in project.purchase_items:
            cur.execute("""
                INSERT INTO purchase_items
                (project_id, po_number, supplier, product_name, quantity,
                 unit_price_usd, unit_price_krw, total_price_usd, total_price_krw,
                 expected_date, received_status, payment_status, exchange_rate,
                 actual_order_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                project_id, item.po_number, item.supplier, item.product_name, item.quantity,
                item.unit_price_usd, item.unit_price_krw, item.total_price_usd, item.total_price_krw,
                item.expected_date, item.received_status, item.payment_status, item.exchange_rate,
                item.actual_order_date
            ))

        return {"id": project_id, "message": "프로젝트가 생성되었습니다"}

@router.put("/projects/{project_id}")
def update_project(project_id: int, project: ProjectUpdate, request: Request, background_tasks: BackgroundTasks):
    """프로젝트 업데이트"""
    check_edit_permission(request)
    with db_cursor() as cur:
        # 존재 확인 및 현재 데이터 조회
        cur.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

        # 기본 필드 업데이트 (payment_date, payment_amount는 project_payments 테이블로 관리)
        project_dict = project.dict(exclude_unset=True)
        logger.debug(f"Project {project_id} update data: {project_dict}")
        basic_fields = {k: v for k, v in project_dict.items()
                       if k not in ['payments', 'sales_items', 'purchase_items', 'payment_date', 'payment_amount']}

        if basic_fields:
            updates = []
            params = []
            for key, value in basic_fields.items():
                updates.append(f"{key} = %s")
                params.append(value)

            params.append(project_id)
            query = f"UPDATE projects SET {', '.join(updates)} WHERE id = %s"
            cur.execute(query, params)

        # 수금 정보 업데이트 (기존 삭제 후 재생성)
        if project.payments is not None:
            cur.execute("DELETE FROM project_payments WHERE project_id = %s", (project_id,))
            for payment in project.payments:
                cur.execute("""
                    INSERT INTO project_payments (project_id, payment_date, payment_amount)
                    VALUES (%s, %s, %s)
                """, (project_id, payment.payment_date, payment.payment_amount))
        # 테이블에서 단일 수금 편집 시 (payment_date, payment_amount 직접 업데이트)
        elif project.payment_date is not None or project.payment_amount is not None:
            # 기존 수금 정보 조회
            cur.execute("SELECT * FROM project_payments WHERE project_id = %s ORDER BY payment_date LIMIT 1", (project_id,))
            existing_payment = cur.fetchone()

            if existing_payment:
                # 기존 첫 번째 수금 업데이트
                if project.payment_date is not None:
                    cur.execute("UPDATE project_payments SET payment_date = %s WHERE id = %s",
                               (project.payment_date, existing_payment['id']))
                if project.payment_amount is not None:
                    cur.execute("UPDATE project_payments SET payment_amount = %s WHERE id = %s",
                               (project.payment_amount, existing_payment['id']))
            else:
                # 새로운 수금 정보 추가
                payment_date = project.payment_date
                payment_amount = project.payment_amount or 0
                if payment_date:
                    cur.execute("""
                        INSERT INTO project_payments (project_id, payment_date, payment_amount)
                        VALUES (%s, %s, %s)
                    """, (project_id, payment_date, payment_amount))

        # 판매 품목 업데이트 (기존 삭제 후 재생성)
        if project.sales_items is not None:
            cur.execute("DELETE FROM sales_items WHERE project_id = %s", (project_id,))
            for item in project.sales_items:
                cur.execute("""
                    INSERT INTO sales_items
                    (project_id, product_name, quantity, unit_price, total_price)
                    VALUES (%s, %s, %s, %s, %s)
                """, (project_id, item.product_name, item.quantity, item.unit_price, item.total_price))

        # 매입 품목 업데이트 (기존 삭제 후 재생성)
        if project.purchase_items is not None:
            cur.execute("DELETE FROM purchase_items WHERE project_id = %s", (project_id,))
            for item in project.purchase_items:
                cur.execute("""
                    INSERT INTO purchase_items
                    (project_id, po_number, supplier, product_name, quantity,
                     unit_price_usd, unit_price_krw, total_price_usd, total_price_krw,
                     expected_date, received_status, payment_status, exchange_rate,
                     actual_order_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    project_id, item.po_number, item.supplier, item.product_name, item.quantity,
                    item.unit_price_usd, item.unit_price_krw, item.total_price_usd, item.total_price_krw,
                    item.expected_date, item.received_status, item.payment_status, item.exchange_rate,
                    item.actual_order_date
                ))

        # 구글 시트 동기화 (백그라운드에서 실행)
        if is_sheet_sync_enabled() and basic_fields:
            background_tasks.add_task(
                update_project_in_sheet,
                project_id,
                basic_fields,
                dict(existing)
            )

        return {"message": "프로젝트가 업데이트되었습니다"}

@router.delete("/projects/{project_id}")
def delete_project(project_id: int, request: Request):
    """프로젝트 삭제"""
    check_delete_permission(request)
    with db_cursor() as cur:
        cur.execute("DELETE FROM projects WHERE id = %s", (project_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
        return {"message": "프로젝트가 삭제되었습니다"}

@router.get("/projects/stats/summary")
def get_summary_stats(year: int = CURRENT_YEAR):
    """프로젝트 통계 요약"""
    with db_cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(DISTINCT p.id) as total_projects,
                SUM(p.order_amount) as total_order_amount,
                COALESCE((SELECT SUM(pp.payment_amount) FROM project_payments pp
                          JOIN projects p2 ON pp.project_id = p2.id WHERE p2.year = %s), 0) as total_payment_amount,
                COUNT(CASE WHEN p.status = '완료' THEN 1 END) as completed_count,
                COUNT(CASE WHEN p.status = '진행중' THEN 1 END) as in_progress_count
            FROM projects p
            WHERE p.year = %s
        """, (year, year))
        return cur.fetchone()
