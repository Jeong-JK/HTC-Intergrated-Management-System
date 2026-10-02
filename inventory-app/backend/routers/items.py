"""HTC Inventory — Items Router v3"""
from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional
from models.schemas import ItemCreate, ItemUpdate, ItemBulkCreate, InboundBulkCreate, LocationBulkUpdate, LicenseBulkUpdate
from database import db_cursor
from config import CATEGORIES, STATUSES, ITEM_TYPES
from routers.auth import get_session

router = APIRouter(prefix="/items", tags=["items"])


def check_delete_permission(request: Request):
    """삭제 권한 확인 (관리자 또는 can_delete 권한 필요)"""
    session_token = request.cookies.get("session_token")
    user = get_session(session_token)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")

    if not user.get('is_admin') and not user.get('can_delete'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")


@router.get("/constants")
def get_constants():
    return {"item_types": ITEM_TYPES, "categories": CATEGORIES, "statuses": STATUSES}


@router.get("/summary")
def get_summary():
    """재고현황 — 품명+카테고리별 집계 (현재고/대여중/납품예정/총수량)"""
    sql = """
        SELECT
            item_type, category, item_name, description, base_status as status,
            -- 현재고: 대여중/납품예정이 아닌 것
            SUM(CASE
                WHEN actual_status NOT IN ('대여중','납품예정','파손','분실') THEN
                    CASE
                        WHEN item_type = '악세사리' THEN
                            GREATEST(quantity - COALESCE(rental_qty, 0) - COALESCE(delivery_qty, 0), 0)
                        ELSE quantity
                    END
                ELSE 0
            END) AS stock_qty,
            -- 대여중 수량 (데모 그룹에서만 계산)
            SUM(CASE
                WHEN base_status = '데모' THEN
                    CASE
                        -- 악세사리: rental_qty 직접 사용
                        WHEN item_type = '악세사리' THEN COALESCE(rental_qty, 0)
                        -- 라디오/안테나: actual_status가 대여중인 것
                        WHEN actual_status = '대여중' THEN quantity
                        ELSE 0
                    END
                ELSE 0
            END) AS rental_qty,
            -- 납품예정 수량 (새제품 그룹에서만 계산)
            SUM(CASE
                WHEN base_status = '새제품' THEN
                    CASE
                        -- 악세사리: delivery_qty 직접 사용
                        WHEN item_type = '악세사리' THEN COALESCE(delivery_qty, 0)
                        -- 라디오/안테나: actual_status가 납품예정인 것
                        WHEN actual_status = '납품예정' THEN quantity
                        ELSE 0
                    END
                ELSE 0
            END) AS pending_qty,
            -- 총 수량
            SUM(quantity) AS total_qty,
            GROUP_CONCAT(DISTINCT note SEPARATOR ' / ') AS note
        FROM (
            SELECT
                i.*,
                -- base_status: 원래 status (대여중→데모, 납품예정→새제품)
                CASE
                    WHEN i.status = '대여중' THEN '데모'
                    WHEN i.status = '납품예정' THEN '새제품'
                    ELSE i.status
                END as base_status,
                COALESCE(rental_sum.rental_qty, 0) as rental_qty,
                COALESCE(delivery_sum.delivery_qty, 0) as delivery_qty,
                CASE
                    -- item_id로 직접 연결된 경우 (라디오/안테나) - EXISTS로 중복 방지
                    WHEN EXISTS (SELECT 1 FROM rental_history WHERE item_id = i.id AND returned_at IS NULL) THEN '대여중'
                    WHEN EXISTS (SELECT 1 FROM delivery_history WHERE item_id = i.id AND status = '납품예정') THEN '납품예정'
                    -- 품명 기반 (악세사리): 일부라도 대여/납품되었으면 원래 status 유지하고 수량만 분리
                    WHEN COALESCE(rental_sum.rental_qty, 0) > 0 AND i.item_type = '악세사리' THEN
                        CASE
                            WHEN i.status = '대여중' THEN '데모'
                            WHEN i.status = '납품예정' THEN '새제품'
                            ELSE i.status
                        END
                    WHEN COALESCE(delivery_sum.delivery_qty, 0) > 0 AND i.item_type = '악세사리' THEN
                        CASE
                            WHEN i.status = '대여중' THEN '데모'
                            WHEN i.status = '납품예정' THEN '새제품'
                            ELSE i.status
                        END
                    -- status가 대여중/납품예정이면 그대로 유지 (actual_status로 사용)
                    WHEN i.status = '대여중' THEN '대여중'
                    WHEN i.status = '납품예정' THEN '납품예정'
                    ELSE i.status
                END as actual_status
            FROM items i
            -- 품명 기반 수량 합계 (악세사리 - item_id 유무 상관없이 모두 집계)
            LEFT JOIN (
                SELECT item_name, SUM(quantity) as rental_qty
                FROM rental_history
                WHERE returned_at IS NULL
                GROUP BY item_name
            ) rental_sum ON i.item_name = rental_sum.item_name AND i.item_type = '악세사리'
            LEFT JOIN (
                SELECT item_name, SUM(quantity) as delivery_qty
                FROM delivery_history
                WHERE status = '납품예정'
                GROUP BY item_name
            ) delivery_sum ON i.item_name = delivery_sum.item_name AND i.item_type = '악세사리'
        ) AS items_with_status
        GROUP BY item_type, category, item_name, description, base_status
        ORDER BY item_type, category, item_name, base_status
    """
    with db_cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


@router.get("/detail")
def get_detail(item_name: str, category: str):
    sql = """
        SELECT id, rack_no, box_no, serial, ip, mac, status, license_key,
               purchase_date, unit_price, note, created_at
        FROM items
        WHERE item_name=%s AND category=%s
        ORDER BY status, serial
    """
    with db_cursor() as cur:
        cur.execute(sql, (item_name, category))
        return cur.fetchall()


@router.get("/item-names")
def get_item_names(exclude_accessory: bool = False):
    """모든 품명 리스트 (중복 제거)"""
    if exclude_accessory:
        sql = "SELECT DISTINCT item_name FROM items WHERE item_type IN ('라디오', '안테나') ORDER BY item_name"
    else:
        sql = "SELECT DISTINCT item_name FROM items ORDER BY item_name"
    with db_cursor() as cur:
        cur.execute(sql)
        return [row['item_name'] for row in cur.fetchall()]


@router.get("/by-name")
def get_items_by_name(item_name: str):
    """특정 품명의 모든 항목 + 실제 상태 (대여중/납품예정/대여가능/새제품)"""
    sql = """
        SELECT
            i.*,
            COALESCE(rental_sum.rental_qty, 0) as rental_qty,
            COALESCE(delivery_sum.delivery_qty, 0) as delivery_qty,
            CASE
                -- item_id로 직접 연결된 경우 - EXISTS로 중복 방지
                WHEN EXISTS (SELECT 1 FROM rental_history WHERE item_id = i.id AND returned_at IS NULL) THEN '대여중'
                WHEN EXISTS (SELECT 1 FROM delivery_history WHERE item_id = i.id AND status = '납품예정') THEN '납품예정'
                -- 품명 기반 (악세사리)
                WHEN COALESCE(rental_sum.rental_qty, 0) >= i.quantity THEN '대여중'
                WHEN COALESCE(delivery_sum.delivery_qty, 0) >= i.quantity THEN '납품예정'
                WHEN i.status = '새제품' THEN '새제품'
                WHEN i.status = '데모' THEN '대여가능'
                ELSE i.status
            END as actual_status,
            (SELECT borrower FROM rental_history WHERE item_id = i.id AND returned_at IS NULL LIMIT 1) as rental_company,
            (SELECT client FROM delivery_history WHERE item_id = i.id AND status = '납품예정' LIMIT 1) as delivery_company
        FROM items i
        -- 품명 기반 수량 합계 (악세사리 - item_id 유무 상관없이 모두 집계)
        LEFT JOIN (
            SELECT item_name, SUM(quantity) as rental_qty
            FROM rental_history
            WHERE returned_at IS NULL
            GROUP BY item_name
        ) rental_sum ON i.item_name = rental_sum.item_name AND i.item_type = '악세사리'
        LEFT JOIN (
            SELECT item_name, SUM(quantity) as delivery_qty
            FROM delivery_history
            WHERE status = '납품예정'
            GROUP BY item_name
        ) delivery_sum ON i.item_name = delivery_sum.item_name AND i.item_type = '악세사리'
        WHERE i.item_name = %s
        ORDER BY i.rack_no, i.box_no, i.serial, i.ip
    """
    with db_cursor() as cur:
        cur.execute(sql, (item_name,))
        return cur.fetchall()


@router.get("")
def list_items(
    item_type: Optional[str] = Query(None),
    category:  Optional[str] = Query(None),
    status:    Optional[str] = Query(None),
    search:    Optional[str] = Query(None),
):
    # actual_status 계산: 대여중/납품예정 여부 포함
    # 악세사리의 경우 수량 기반 계산 (일부만 대여중일 수 있음)
    # available_quantity: 실제 대여 가능한 수량
    sql = """
        SELECT
            i.*,
            COALESCE(rental_sum.rental_qty, 0) as rental_qty,
            COALESCE(delivery_sum.delivery_qty, 0) as delivery_qty,
            -- 가용 수량 계산: 악세사리는 전체 수량 - 대여중 수량 - 납품예정 수량
            CASE
                WHEN i.item_type = '악세사리' THEN
                    GREATEST(i.quantity - COALESCE(rental_sum.rental_qty, 0) - COALESCE(delivery_sum.delivery_qty, 0), 0)
                -- 라디오/안테나: 대여중이면 0, 아니면 quantity
                WHEN EXISTS (SELECT 1 FROM rental_history WHERE item_id = i.id AND returned_at IS NULL) THEN 0
                ELSE i.quantity
            END as available_quantity,
            CASE
                -- item_id로 직접 연결된 경우 (라디오/안테나) - EXISTS로 중복 방지
                WHEN EXISTS (SELECT 1 FROM rental_history WHERE item_id = i.id AND returned_at IS NULL) THEN '대여중'
                WHEN EXISTS (SELECT 1 FROM delivery_history WHERE item_id = i.id AND status = '납품예정') THEN '납품예정'
                -- 품명 기반 (악세사리): 전체 수량이 대여/납품되었는지 확인
                WHEN COALESCE(rental_sum.rental_qty, 0) >= i.quantity THEN '대여중'
                WHEN COALESCE(delivery_sum.delivery_qty, 0) >= i.quantity THEN '납품예정'
                ELSE i.status
            END as actual_status,
            -- 대여 업체 정보
            (SELECT borrower FROM rental_history WHERE item_id = i.id AND returned_at IS NULL LIMIT 1) as rental_company,
            -- 납품 업체 정보
            (SELECT client FROM delivery_history WHERE item_id = i.id AND status = '납품예정' LIMIT 1) as delivery_company
        FROM items i
        -- 품명 기반 대여 수량 합계 (악세사리 - item_id 유무 상관없이 모두 집계)
        LEFT JOIN (
            SELECT item_name, SUM(quantity) as rental_qty
            FROM rental_history
            WHERE returned_at IS NULL
            GROUP BY item_name
        ) rental_sum ON i.item_name = rental_sum.item_name AND i.item_type = '악세사리'
        -- 품명 기반 납품예정 수량 합계 (악세사리 - item_id 유무 상관없이 모두 집계)
        LEFT JOIN (
            SELECT item_name, SUM(quantity) as delivery_qty
            FROM delivery_history
            WHERE status = '납품예정'
            GROUP BY item_name
        ) delivery_sum ON i.item_name = delivery_sum.item_name AND i.item_type = '악세사리'
        WHERE 1=1
    """
    params = []
    if item_type:
        sql += " AND i.item_type=%s"; params.append(item_type)
    if category:
        sql += " AND i.category=%s"; params.append(category)
    if status:
        sql += " AND i.status=%s"; params.append(status)
    if search:
        sql += " AND (i.item_name LIKE %s OR i.serial LIKE %s OR i.ip LIKE %s OR i.description LIKE %s OR i.note LIKE %s OR i.license_key LIKE %s)"
        p = f"%{search}%"; params.extend([p,p,p,p,p,p])
    sql += " ORDER BY i.item_type, i.category, i.item_name, i.serial"
    with db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/{item_id}")
def get_item(item_id: int):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM items WHERE id=%s", (item_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Item not found")
    return row


def _insert_item(cur, item_data: dict):
    unit_price    = min(float(item_data.get('unit_price') or 0), 9999999999999.99)
    exchange_rate = float(item_data.get('exchange_rate') or 0)
    if exchange_rate < 0 or exchange_rate > 999999: exchange_rate = 0.0
    total = unit_price * exchange_rate

    # purchase_date가 없으면 inbound_date 사용 (입고일 = 매입일)
    pd = item_data.get('purchase_date') or item_data.get('inbound_date') or None
    if pd == '': pd = None

    sql = """
        INSERT INTO items
        (rack_no,box_no,item_type,category,item_name,description,
         serial,ip,mac,status,quantity,license_key,purchase_date,unit_price,exchange_rate,total_price,note)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """
    cur.execute(sql, (
        item_data.get('rack_no',''), item_data.get('box_no',''),
        item_data.get('item_type','라디오'), item_data.get('category',''),
        item_data.get('item_name'), item_data.get('description',''),
        item_data.get('serial',''), item_data.get('ip',''), item_data.get('mac',''),
        item_data.get('status','데모'), int(item_data.get('quantity') or 1),
        item_data.get('license_key',''),
        pd, unit_price, exchange_rate, total,
        item_data.get('note',''),
    ))
    return cur.lastrowid


@router.post("")
def create_item(item: ItemCreate):
    with db_cursor() as cur:
        new_id = _insert_item(cur, item.dict())
        cur.execute("SELECT * FROM items WHERE id=%s", (new_id,))
        return cur.fetchone()


@router.post("/bulk")
def create_bulk(body: ItemBulkCreate):
    """같은 품명에 serial/ip 여러 개 일괄 추가"""
    base = body.dict()
    entries = base.pop('entries', [])
    created = []
    with db_cursor() as cur:
        if not entries:
            new_id = _insert_item(cur, base)
            cur.execute("SELECT * FROM items WHERE id=%s", (new_id,))
            created.append(cur.fetchone())
        else:
            for entry in entries:
                data = {**base, **entry}
                new_id = _insert_item(cur, data)
                cur.execute("SELECT * FROM items WHERE id=%s", (new_id,))
                created.append(cur.fetchone())
    return created


@router.post("/inbound-bulk")
def inbound_bulk(body: InboundBulkCreate):
    """입고처리 — 여러 품목 각각 설정해서 일괄 등록"""
    import datetime
    created_items = []
    with db_cursor() as cur:
        for item_data in body.items:
            d = item_data.dict()

            # inbound 테이블 저장용 값들 미리 추출 (pop 대신 get 사용)
            supplier     = d.get('supplier', '')
            inbound_date = d.get('inbound_date', None) or datetime.date.today().isoformat()
            quantity     = int(d.get('quantity', 1))

            # 단가와 환율 처리 (빈 문자열도 0으로 처리)
            unit_price_raw = d.get('unit_price')
            exchange_rate_raw = d.get('exchange_rate')
            unit_price = float(unit_price_raw) if unit_price_raw not in [None, '', 0] else 0.0
            exchange_rate = float(exchange_rate_raw) if exchange_rate_raw not in [None, '', 0] else 0.0

            # DEBUG: 받은 데이터 로깅
            print(f"[DEBUG] inbound-bulk received: item_name={d.get('item_name')}, unit_price_raw={unit_price_raw} -> {unit_price}, exchange_rate_raw={exchange_rate_raw} -> {exchange_rate}")
            item_name    = d.get('item_name', '')
            category     = d.get('category', '')
            item_type    = d.get('item_type', '라디오')
            status       = d.get('status', '데모')
            ip           = d.get('ip', '')
            serial       = d.get('serial', '')
            mac          = d.get('mac', '')
            license_key  = d.get('license_key', '')
            note         = d.get('note', '')

            new_id = _insert_item(cur, d)
            cur.execute("SELECT * FROM items WHERE id=%s", (new_id,))
            new_item = cur.fetchone()
            created_items.append(new_item)

            # 입고 기록
            cur.execute("""
                INSERT INTO inbound (item_id, quantity, supplier, inbound_date, unit_price, exchange_rate, note,
                                   item_name, category, item_type, status, ip, serial, mac, license_key)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (new_id, quantity, supplier, inbound_date,
                  unit_price, exchange_rate, note,
                  item_name, category, item_type, status, ip, serial, mac, license_key))

    return created_items


@router.put("/{item_id}")
def update_item(item_id: int, item: ItemUpdate):
    total = float(item.unit_price or 0) * float(item.exchange_rate or 0)
    pd = item.purchase_date if item.purchase_date else None
    sql = """
        UPDATE items SET
        rack_no=%s,box_no=%s,item_type=%s,category=%s,item_name=%s,
        description=%s,serial=%s,ip=%s,mac=%s,status=%s,quantity=%s,license_key=%s,
        purchase_date=%s,unit_price=%s,exchange_rate=%s,total_price=%s,note=%s
        WHERE id=%s
    """
    with db_cursor() as cur:
        cur.execute(sql, (
            item.rack_no, item.box_no, item.item_type, item.category,
            item.item_name, item.description, item.serial, item.ip, item.mac,
            item.status, int(item.quantity or 1), item.license_key, pd,
            float(item.unit_price or 0), float(item.exchange_rate or 0), total, item.note, item_id,
        ))

        # 동기화: 가장 최근 입고 건의 단가/환율도 업데이트
        cur.execute("""
            SELECT id FROM inbound
            WHERE item_id=%s
            ORDER BY inbound_date DESC, id DESC
            LIMIT 1
        """, (item_id,))
        latest_inbound = cur.fetchone()
        if latest_inbound:
            cur.execute("""
                UPDATE inbound
                SET unit_price=%s, exchange_rate=%s
                WHERE id=%s
            """, (float(item.unit_price or 0), float(item.exchange_rate or 0), latest_inbound['id']))

        cur.execute("SELECT * FROM items WHERE id=%s", (item_id,))
        return cur.fetchone()


@router.delete("/{item_id}")
def delete_item(item_id: int, request: Request):
    check_delete_permission(request)
    with db_cursor() as cur:
        cur.execute("DELETE FROM items WHERE id=%s", (item_id,))
    return {"ok": True}


@router.put("/bulk/description")
def update_items_description(body: dict):
    """품명별 설명 일괄 변경"""
    item_name = body.get('item_name')
    description = body.get('description', '')

    if not item_name:
        raise HTTPException(400, "품명이 필요합니다")

    with db_cursor() as cur:
        cur.execute(
            "UPDATE items SET description = %s WHERE item_name = %s",
            (description, item_name)
        )
        updated = cur.rowcount
        return {"ok": True, "updated": updated}


@router.put("/bulk/location")
def update_items_location(body: LocationBulkUpdate):
    """여러 품목의 위치(렉/박스) 일괄 변경"""
    if not body.ids:
        raise HTTPException(400, "변경할 품목이 없습니다")
    if body.rack_no is None and body.box_no is None:
        raise HTTPException(400, "렉 또는 박스 중 하나는 입력해주세요")

    updates = []
    params = []
    if body.rack_no is not None:
        updates.append("rack_no = %s")
        params.append(body.rack_no)
    if body.box_no is not None:
        updates.append("box_no = %s")
        params.append(body.box_no)

    placeholders = ",".join(["%s"] * len(body.ids))
    sql = f"UPDATE items SET {', '.join(updates)} WHERE id IN ({placeholders})"
    params.extend(body.ids)

    with db_cursor() as cur:
        cur.execute(sql, params)
        return {"ok": True, "updated": len(body.ids)}


@router.put("/bulk/license")
def update_items_license(body: LicenseBulkUpdate):
    """여러 품목의 라이센스 일괄 변경"""
    if not body.ids:
        raise HTTPException(400, "변경할 품목이 없습니다")

    placeholders = ",".join(["%s"] * len(body.ids))
    sql = f"UPDATE items SET license_key = %s WHERE id IN ({placeholders})"
    params = [body.license_key] + body.ids

    with db_cursor() as cur:
        cur.execute(sql, params)
        return {"ok": True, "updated": len(body.ids)}
