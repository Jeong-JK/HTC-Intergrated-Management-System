"""HTC Inventory — Delivery Router v2"""
from fastapi import APIRouter, Query, Request, HTTPException
from typing import Optional
from models.schemas import DeliveryCreate, DeliveryGroupUpdate, DeliveryConfirm
from database import db_cursor
from routers.auth import get_session

router = APIRouter(prefix="/deliveries", tags=["deliveries"])


def check_delete_permission(request: Request):
    """삭제 권한 확인 (관리자 또는 can_delete 권한 필요)"""
    session_token = request.cookies.get("session_token")
    user = get_session(session_token)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")

    if not user.get('is_admin') and not user.get('can_delete'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")


@router.get("")
def list_deliveries(
    item_type: Optional[str] = Query(None),
    client:    Optional[str] = Query(None),
    status:    Optional[str] = Query(None),
):
    sql = """
        SELECT d.id, d.user_id, d.item_id,
               COALESCE(d.item_name, i.item_name, '') as item_name,
               COALESCE(d.description, i.description, '') as description,
               COALESCE(d.serial_ip, i.ip, i.serial, '') as serial_ip,
               d.client, d.project_name, d.contact_name, d.contact_position, d.contact_phone,
               d.quantity, d.unit_price, d.delivery_date, d.status, d.note, d.created_at,
               COALESCE(i.item_type, '') as item_type,
               COALESCE(i.category, '') as category,
               COALESCE(i.serial, '') as serial,
               COALESCE(i.ip, '') as ip
        FROM delivery_history d
        LEFT JOIN items i ON d.item_id = i.id
        WHERE 1=1
    """
    params = []
    if item_type:
        sql += " AND i.item_type=%s"; params.append(item_type)
    if client:
        sql += " AND d.client LIKE %s"; params.append(f"%{client}%")
    if status:
        sql += " AND d.status=%s"; params.append(status)
    sql += " ORDER BY d.delivery_date DESC, d.id DESC"
    with db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.post("")
def create_delivery(delivery: DeliveryCreate):
    # item_id가 있으면 items에서 item_name 가져오기
    item_name_to_save = getattr(delivery, 'item_name', '')

    with db_cursor() as cur:
        if delivery.item_id and not item_name_to_save:
            cur.execute("SELECT item_name FROM items WHERE id=%s", (delivery.item_id,))
            item = cur.fetchone()
            if item:
                item_name_to_save = item['item_name']

        sql = """
            INSERT INTO delivery_history
            (item_id,item_name,description,serial_ip,client,project_name,contact_name,contact_position,contact_phone,quantity,unit_price,delivery_date,status,note)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """
        cur.execute(sql, (
            delivery.item_id, item_name_to_save,
            getattr(delivery, 'description', ''),
            getattr(delivery, 'serial_ip', ''),
            delivery.client,
            getattr(delivery, 'project_name', ''),
            getattr(delivery, 'contact_name', ''),
            getattr(delivery, 'contact_position', ''),
            getattr(delivery, 'contact_phone', ''),
            delivery.quantity,
            float(delivery.unit_price or 0), delivery.delivery_date,
            delivery.status, delivery.note,
        ))
        new_id = cur.lastrowid

        # item_id가 있을 때만 items 처리
        # 악세사리는 수량 기반이므로 삭제하지 않음
        if delivery.item_id:
            cur.execute("SELECT item_type, status FROM items WHERE id=%s", (delivery.item_id,))
            item_info = cur.fetchone()
            if item_info and item_info['item_type'] != '악세사리':
                if delivery.status == "납품완료":
                    # 납품완료: 라디오/안테나만 재고에서 제거 (조건부 삭제)
                    cur.execute("DELETE FROM items WHERE id=%s AND status IN ('데모', '새제품')", (delivery.item_id,))
                    if cur.rowcount == 0:
                        cur.execute("DELETE FROM delivery_history WHERE id=%s", (new_id,))
                        raise HTTPException(409, "이 장비는 현재 납품할 수 없습니다 (이미 대여중이거나 납품예정)")
                elif delivery.status == "납품예정":
                    # 납품예정: items 상태를 '납품예정'으로 변경 (조건부 업데이트)
                    cur.execute("UPDATE items SET status='납품예정' WHERE id=%s AND status IN ('데모', '새제품')", (delivery.item_id,))
                    if cur.rowcount == 0:
                        cur.execute("DELETE FROM delivery_history WHERE id=%s", (new_id,))
                        raise HTTPException(409, "이 장비는 현재 납품할 수 없습니다 (이미 대여중이거나 납품예정)")
            # 악세사리: 삭제 안 함 (수량 기반으로 계산)

        # 결과 반환
        cur.execute("""
            SELECT d.*,
                   COALESCE(i.item_type, '') as item_type,
                   COALESCE(i.category, '') as category,
                   COALESCE(i.serial, '') as serial,
                   COALESCE(i.ip, '') as ip
            FROM delivery_history d
            LEFT JOIN items i ON d.item_id = i.id
            WHERE d.id=%s
        """, (new_id,))
        return cur.fetchone()


@router.put("/{delivery_id}/confirm")
def confirm_delivery(delivery_id: int, body: DeliveryConfirm):
    """납품예정 → 납품완료 확정 (날짜 입력)"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM delivery_history WHERE id=%s", (delivery_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "납품 기록을 찾을 수 없습니다")

        # 이미 납품완료인지 체크 (중복 확정 방지)
        if row.get("status") == "납품완료":
            raise HTTPException(409, "이미 납품 완료 처리된 건입니다")

        # 납품완료로 상태 변경 + 날짜 업데이트 (조건부 업데이트)
        cur.execute(
            "UPDATE delivery_history SET status='납품완료', delivery_date=%s WHERE id=%s AND status='납품예정'",
            (body.delivery_date, delivery_id)
        )
        if cur.rowcount == 0:
            raise HTTPException(409, "납품 확정에 실패했습니다 (상태가 변경되었을 수 있음)")

        # item_id가 있으면 재고에서 제거 (악세사리는 수량 기반이므로 제외)
        if row["item_id"]:
            cur.execute("SELECT item_type FROM items WHERE id=%s", (row["item_id"],))
            item_info = cur.fetchone()
            if item_info and item_info['item_type'] != '악세사리':
                cur.execute("DELETE FROM items WHERE id=%s", (row["item_id"],))
    return {"ok": True}


@router.delete("/{delivery_id}")
def delete_delivery(delivery_id: int, request: Request):
    check_delete_permission(request)
    with db_cursor() as cur:
        # 삭제 전 납품 정보 조회
        cur.execute("SELECT item_id, status FROM delivery_history WHERE id=%s", (delivery_id,))
        delivery = cur.fetchone()

        # 납품 기록 삭제
        cur.execute("DELETE FROM delivery_history WHERE id=%s", (delivery_id,))

        # 납품예정은 items 상태를 변경하지 않으므로 복원도 필요 없음
        # 납품완료는 이미 items에서 삭제되었으므로 복원 불가

    return {"ok": True}


@router.put("/group/update")
def update_delivery_group(body: DeliveryGroupUpdate):
    """업체별(그룹별) 일괄 수정 - 같은 날짜, 업체, 담당자의 모든 납품 이력 수정"""
    print(f"[DEBUG] Received delivery group update: {body}")
    with db_cursor() as cur:
        # 수정할 납품 이력 조회 (delivery_date가 NULL인 경우도 처리)
        if body.delivery_date is None:
            sql = "SELECT * FROM delivery_history WHERE delivery_date IS NULL AND client=%s"
            params = [body.client]
        else:
            sql = "SELECT * FROM delivery_history WHERE delivery_date=%s AND client=%s"
            params = [body.delivery_date, body.client]

        if body.original_contact_name:
            sql += " AND contact_name=%s"
            params.append(body.original_contact_name)
        else:
            sql += " AND (contact_name IS NULL OR contact_name='')"

        cur.execute(sql, params)
        deliveries = cur.fetchall()

        if not deliveries:
            raise HTTPException(404, "해당 그룹의 납품 이력이 없습니다")

        # 수정할 delivery_id 목록
        delivery_ids = [d["id"] for d in deliveries]

        # 업데이트 쿼리 작성
        update_fields = []
        update_params = []

        # delivery_date 업데이트 (새 날짜가 제공된 경우)
        if hasattr(body, 'new_delivery_date') and body.new_delivery_date:
            update_fields.append("delivery_date=%s")
            update_params.append(body.new_delivery_date)

        # client 업데이트 (새 업체명이 제공된 경우)
        if hasattr(body, 'new_client') and body.new_client:
            update_fields.append("client=%s")
            update_params.append(body.new_client)

        # project_name 업데이트 (빈 문자열 포함)
        if hasattr(body, 'project_name') and body.project_name is not None:
            update_fields.append("project_name=%s")
            update_params.append(body.project_name)

        # contact_name 업데이트 (빈 문자열 포함)
        if hasattr(body, 'contact_name') and body.contact_name is not None:
            update_fields.append("contact_name=%s")
            update_params.append(body.contact_name)

        # contact_position 업데이트 (빈 문자열 포함)
        if hasattr(body, 'contact_position') and body.contact_position is not None:
            update_fields.append("contact_position=%s")
            update_params.append(body.contact_position)

        # contact_phone 업데이트 (빈 문자열 포함)
        if hasattr(body, 'contact_phone') and body.contact_phone is not None:
            update_fields.append("contact_phone=%s")
            update_params.append(body.contact_phone)

        if update_fields:
            placeholders = ','.join(['%s'] * len(delivery_ids))
            sql = f"UPDATE delivery_history SET {', '.join(update_fields)} WHERE id IN ({placeholders})"
            update_params.extend(delivery_ids)
            cur.execute(sql, update_params)

    return {"ok": True, "updated_count": len(delivery_ids)}
