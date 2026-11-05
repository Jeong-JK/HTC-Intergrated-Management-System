"""HTC CRM — Inventory Items Proxy Router (재고 품목 조회)"""
from fastapi import APIRouter, Query, Request, HTTPException
from permissions import require_perm
from typing import Optional
from database import db_cursor  # htc_inventory DB 접속

router = APIRouter(prefix="/inventory", tags=["inventory"])


def get_user(request: Request):
    """인증된 사용자 정보 반환"""
    user = require_perm(request)
    return user


@router.get("/items")
def list_inventory_items(
    request: Request,
    search: Optional[str] = Query(None),
    item_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(100)
):
    """재고 품목 목록 조회"""
    get_user(request)

    sql = """
        SELECT DISTINCT
            id, item_type, category, item_name, description,
            unit_price, exchange_rate
        FROM items
        WHERE status IN ('새제품', '데모', '재고')
    """
    params = []

    if search:
        sql += " AND item_name LIKE %s"
        params.append(f"%{search}%")

    if item_type:
        sql += " AND item_type = %s"
        params.append(item_type)

    if category:
        sql += " AND category = %s"
        params.append(category)

    sql += " ORDER BY item_name LIMIT %s"
    params.append(limit)

    with db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/item-names")
def list_item_names(
    request: Request,
    search: Optional[str] = Query(None),
    exclude_accessory: bool = Query(False)
):
    """품명 목록 (자동완성용)"""
    get_user(request)

    sql = """
        SELECT DISTINCT item_name, item_type, category,
               MAX(unit_price) as unit_price,
               MAX(description) as description
        FROM items
        WHERE status IN ('새제품', '데모', '재고')
    """
    params = []

    if exclude_accessory:
        sql += " AND item_type != '악세사리'"

    if search:
        sql += " AND item_name LIKE %s"
        params.append(f"%{search}%")

    sql += " GROUP BY item_name, item_type, category"
    sql += " ORDER BY item_name"
    sql += " LIMIT 50"

    with db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/items/by-name")
def get_items_by_name(
    request: Request,
    item_name: str = Query(...)
):
    """품명으로 품목 조회 (상세 정보)"""
    get_user(request)

    sql = """
        SELECT id, item_type, category, item_name, description,
               serial, ip, unit_price, exchange_rate, status
        FROM items
        WHERE item_name = %s AND status IN ('새제품', '데모', '재고')
        ORDER BY id
    """

    with db_cursor() as cur:
        cur.execute(sql, (item_name,))
        return cur.fetchall()


@router.get("/constants")
def get_constants(request: Request):
    """품목 유형, 카테고리, 상태 목록"""
    get_user(request)

    with db_cursor() as cur:
        # 품목 유형
        cur.execute("SELECT DISTINCT item_type FROM items WHERE item_type IS NOT NULL AND item_type != ''")
        item_types = [r['item_type'] for r in cur.fetchall()]

        # 카테고리 (품목 유형별)
        categories = {}
        for item_type in item_types:
            cur.execute("""
                SELECT DISTINCT category FROM items
                WHERE item_type = %s AND category IS NOT NULL AND category != ''
                ORDER BY category
            """, (item_type,))
            categories[item_type] = [r['category'] for r in cur.fetchall()]

        return {
            "item_types": item_types or ['라디오', '안테나', '악세사리'],
            "categories": categories
        }
