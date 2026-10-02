"""HTC Inventory — Inbound Router"""
from fastapi import APIRouter, Query
from typing import Optional
from database import db_cursor
from models.schemas import InboundUpdate

router = APIRouter(prefix="/inbound", tags=["inbound"])


@router.get("")
def list_inbound(
    item_type: Optional[str] = Query(None),
    search:    Optional[str] = Query(None),
    year:      Optional[int] = Query(None),
):
    # item_id 없어도 다 가져옴 (LEFT JOIN)
    sql = """
        SELECT b.id, b.item_id, b.inbound_date, b.quantity,
               b.unit_price, b.exchange_rate, b.supplier, b.note, b.created_at,
               COALESCE(b.item_name, i.item_name, '') AS item_name,
               COALESCE(b.category,  i.category,  '') AS category,
               COALESCE(b.item_type, i.item_type, '') AS item_type,
               COALESCE(b.status,    i.status,    '') AS status,
               COALESCE(b.ip,        i.ip,        '') AS ip,
               COALESCE(b.serial,    i.serial,    '') AS serial,
               COALESCE(b.mac,       i.mac,       '') AS mac,
               COALESCE(b.license_key, i.license_key, '') AS license_key
        FROM inbound b
        LEFT JOIN items i ON b.item_id = i.id
        WHERE 1=1
    """
    params = []
    if item_type:
        sql += " AND COALESCE(b.item_type, i.item_type, '') = %s"
        params.append(item_type)
    if search:
        sql += " AND (COALESCE(b.item_name, i.item_name, '') LIKE %s OR COALESCE(b.category, i.category, '') LIKE %s)"
        p = f"%{search}%"; params.extend([p, p])
    if year:
        sql += " AND YEAR(b.inbound_date) = %s"
        params.append(year)
    sql += " ORDER BY b.inbound_date DESC, b.id DESC"
    with db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.put("/{inbound_id}")
def update_inbound(inbound_id: int, data: InboundUpdate):
    with db_cursor() as cur:
        # item_id 먼저 가져오기 (동기화를 위해)
        cur.execute("SELECT item_id, unit_price, exchange_rate FROM inbound WHERE id=%s", (inbound_id,))
        inbound_record = cur.fetchone()

        # 업데이트할 필드만 처리
        fields = []
        params = []

        if data.quantity is not None:
            fields.append("quantity=%s")
            params.append(data.quantity)
        if data.inbound_date is not None:
            fields.append("inbound_date=%s")
            params.append(data.inbound_date)
        if data.unit_price is not None:
            fields.append("unit_price=%s")
            params.append(float(data.unit_price))
        if data.exchange_rate is not None:
            fields.append("exchange_rate=%s")
            params.append(float(data.exchange_rate))
        if data.note is not None:
            fields.append("note=%s")
            params.append(data.note)

        if fields:
            sql = f"UPDATE inbound SET {', '.join(fields)} WHERE id=%s"
            params.append(inbound_id)
            cur.execute(sql, params)

        # 동기화: 단가/환율이 변경되었고 item_id가 있으면 items도 업데이트
        if inbound_record and inbound_record['item_id'] and (data.unit_price is not None or data.exchange_rate is not None):
            item_id = inbound_record['item_id']

            # 현재 items의 값을 가져오기
            cur.execute("SELECT unit_price, exchange_rate FROM items WHERE id=%s", (item_id,))
            item_record = cur.fetchone()

            if item_record:
                # 업데이트할 값 결정 (변경된 필드만 적용)
                new_unit_price = float(data.unit_price) if data.unit_price is not None else item_record['unit_price']
                new_exchange_rate = float(data.exchange_rate) if data.exchange_rate is not None else item_record['exchange_rate']
                new_total = new_unit_price * new_exchange_rate

                # items 테이블 업데이트
                cur.execute("""
                    UPDATE items
                    SET unit_price=%s, exchange_rate=%s, total_price=%s
                    WHERE id=%s
                """, (new_unit_price, new_exchange_rate, new_total, item_id))

    return {"ok": True}


@router.delete("/{inbound_id}")
def delete_inbound(inbound_id: int):
    with db_cursor() as cur:
        cur.execute("DELETE FROM inbound WHERE id=%s", (inbound_id,))
    return {"ok": True}


@router.put("/bulk/exchange-rate")
def bulk_update_exchange_rate(data: dict):
    """여러 입고 항목의 환율을 일괄 업데이트"""
    inbound_ids = data.get("ids", [])
    exchange_rate = data.get("exchange_rate")

    if not inbound_ids or exchange_rate is None:
        return {"error": "ids와 exchange_rate가 필요합니다"}

    with db_cursor() as cur:
        placeholders = ",".join(["%s"] * len(inbound_ids))
        sql = f"UPDATE inbound SET exchange_rate=%s WHERE id IN ({placeholders})"
        params = [float(exchange_rate)] + inbound_ids
        cur.execute(sql, params)

    return {"ok": True, "updated": len(inbound_ids)}
