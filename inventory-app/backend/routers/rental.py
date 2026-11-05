"""HTC Inventory — Rental Router v2"""
from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional
from datetime import date
from models.schemas import RentalCreate, RentalReturn, RentalExtend, RentalHeaderCreate, RentalGroupUpdate, RentalItemUpdate
from database import db_cursor
from routers.auth import require_perm

router = APIRouter(prefix="/rentals", tags=["rentals"])


@router.get("")
def list_rentals(
    item_type: Optional[str]  = Query(None),
    borrower:  Optional[str]  = Query(None),
    active:    Optional[bool] = Query(None),
):
    sql = """
        SELECT r.id, r.user_id, r.item_id,
               COALESCE(i.item_name, r.item_name) as item_name,
               COALESCE(i.description, r.description) as description,
               r.borrower, r.contact_name, r.contact_position, r.contact_phone,
               r.purpose, r.quantity, r.rent_date, r.expected_return,
               r.returned_at, r.needs_check, r.note, r.created_at,
               i.item_type, i.category, i.serial, i.ip
        FROM rental_history r
        LEFT JOIN items i ON r.item_id = i.id
        WHERE 1=1
    """
    params = []
    if item_type:
        sql += " AND i.item_type=%s"; params.append(item_type)
    if borrower:
        sql += " AND r.borrower LIKE %s"; params.append(f"%{borrower}%")
    if active is True:
        sql += " AND r.returned_at IS NULL"
    elif active is False:
        sql += " AND r.returned_at IS NOT NULL"
    sql += " ORDER BY r.rent_date DESC, r.id DESC"
    with db_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


@router.get("/overdue")
def list_overdue():
    sql = """
        SELECT r.id, r.user_id, r.item_id,
               COALESCE(i.item_name, r.item_name) as item_name,
               COALESCE(i.description, r.description) as description,
               r.borrower, r.contact_name, r.contact_position, r.contact_phone,
               r.purpose, r.quantity, r.rent_date, r.expected_return,
               r.returned_at, r.needs_check, r.note, r.created_at,
               i.item_type, i.category, i.serial, i.ip
        FROM rental_history r
        LEFT JOIN items i ON r.item_id = i.id
        WHERE r.returned_at IS NULL AND r.expected_return < CURDATE()
        ORDER BY r.expected_return
    """
    with db_cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


@router.get("/calendar")
def rental_calendar(year: int = Query(...), month: int = Query(...)):
    """달력용 — 해당 월 대여 현황"""
    from calendar import monthrange
    last_day = monthrange(year, month)[1]
    start = f"{year}-{month:02d}-01"
    end   = f"{year}-{month:02d}-{last_day}"

    sql = """
        SELECT
            r.id as rental_id,
            r.rent_date,
            r.expected_return,
            r.returned_at,
            r.borrower,
            r.contact_name,
            COALESCE(i.item_name, r.item_name) as item_name,
            r.quantity
        FROM rental_history r
        LEFT JOIN items i ON r.item_id = i.id
        WHERE r.rent_date <= %s
          AND (r.expected_return >= %s OR r.expected_return IS NULL)
        ORDER BY r.borrower, r.rent_date
    """
    with db_cursor() as cur:
        cur.execute(sql, (end, start))
        return cur.fetchall()


@router.post("")
def create_rental(rental: RentalCreate):
    with db_cursor() as cur:
        original_status = '데모'  # 기본값

        # item_id가 있으면 해당 item의 현재 상태를 가져옴
        if rental.item_id:
            cur.execute("SELECT status FROM items WHERE id=%s", (rental.item_id,))
            item_row = cur.fetchone()
            if item_row:
                original_status = item_row['status']

        sql = """
            INSERT INTO rental_history
            (item_id,item_name,description,borrower,contact_name,contact_position,contact_phone,purpose,quantity,rent_date,expected_return,original_status,note)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """
        cur.execute(sql, (
            rental.item_id,
            getattr(rental, 'item_name', ''),
            getattr(rental, 'description', ''),
            rental.borrower,
            getattr(rental, 'contact_name', ''),
            getattr(rental, 'contact_position', ''),
            getattr(rental, 'contact_phone', ''),
            rental.purpose,
            rental.quantity, rental.rent_date, rental.expected_return, original_status, rental.note,
        ))
        new_id = cur.lastrowid

        # item_id가 있으면 items.status를 '대여중'으로 변경 (조건부 업데이트로 동시성 문제 방지)
        if rental.item_id:
            cur.execute(
                "UPDATE items SET status='대여중' WHERE id=%s AND status IN ('데모', '새제품')",
                (rental.item_id,)
            )
            if cur.rowcount == 0:
                # 업데이트 실패 = 이미 대여중이거나 납품예정
                # 방금 INSERT한 rental_history 삭제
                cur.execute("DELETE FROM rental_history WHERE id=%s", (new_id,))
                raise HTTPException(409, "이 장비는 현재 대여할 수 없습니다 (이미 대여중이거나 납품예정)")
            cur.execute("""
                SELECT r.*, i.item_name as i_item_name, i.description as i_description FROM rental_history r
                JOIN items i ON r.item_id=i.id WHERE r.id=%s
            """, (new_id,))
            return cur.fetchone()
        else:
            # item_id가 없는 경우 (악세사리): 품명으로 재고 차감
            item_name = getattr(rental, 'item_name', '')
            rent_qty = rental.quantity or 1

            if item_name:
                # 같은 품명의 항목에서 재고 차감 (데모/새제품 상태, 수량 충분한 것 우선)
                cur.execute("""
                    SELECT id, quantity, status FROM items
                    WHERE item_name = %s AND status IN ('데모', '새제품') AND quantity >= %s
                    ORDER BY status = '데모' DESC, quantity DESC
                    LIMIT 1
                """, (item_name, rent_qty))
                item_row = cur.fetchone()

                if item_row:
                    # 재고 차감
                    new_qty = item_row['quantity'] - rent_qty
                    cur.execute(
                        "UPDATE items SET quantity = %s WHERE id = %s",
                        (new_qty, item_row['id'])
                    )
                    # original_status 업데이트 (차감한 재고의 상태로)
                    cur.execute(
                        "UPDATE rental_history SET original_status = %s WHERE id = %s",
                        (item_row['status'], new_id)
                    )

            cur.execute("SELECT * FROM rental_history WHERE id=%s", (new_id,))
            return cur.fetchone()


@router.put("/{rental_id}/return")
def return_rental(rental_id: int, body: RentalReturn):
    with db_cursor() as cur:
        cur.execute("SELECT * FROM rental_history WHERE id=%s", (rental_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Rental not found")

        # 이미 반납된 건인지 체크 (중복 반납 방지)
        if row.get("returned_at"):
            raise HTTPException(409, "이미 반납 처리된 대여입니다")

        original_quantity = row["quantity"] or 1
        return_quantity = body.return_quantity if body.return_quantity is not None else original_quantity

        # 반납 수량 검증
        if return_quantity <= 0:
            raise HTTPException(400, "반납 수량은 1 이상이어야 합니다")
        if return_quantity > original_quantity:
            raise HTTPException(400, f"반납 수량({return_quantity})이 대여 수량({original_quantity})보다 많습니다")

        # 부분 반납인 경우
        if return_quantity < original_quantity:
            remaining_quantity = original_quantity - return_quantity

            # 원래 레코드의 수량을 줄임 (남은 수량)
            cur.execute(
                "UPDATE rental_history SET quantity=%s, note=CONCAT(IFNULL(note,''),%s) WHERE id=%s",
                (remaining_quantity, f"\n[부분반납] {return_quantity}개 반납, {remaining_quantity}개 대여중", rental_id)
            )

            # 반납된 수량만큼 새 레코드 생성
            cur.execute("""
                INSERT INTO rental_history
                (item_id, item_name, description, borrower, contact_name, contact_position, contact_phone,
                 purpose, quantity, rent_date, expected_return, returned_at, note)
                SELECT item_id, item_name, description, borrower, contact_name, contact_position, contact_phone,
                       purpose, %s, rent_date, expected_return, %s,
                       CONCAT(IFNULL(note, ''), %s)
                FROM rental_history WHERE id=%s
            """, (
                return_quantity,
                body.returned_at,
                f"\n[부분반납] {return_quantity}개 반납" + (f" - {body.note}" if body.note else ""),
                rental_id
            ))
        else:
            # 전체 반납 (기존 로직)
            cur.execute(
                "UPDATE rental_history SET returned_at=%s, note=CONCAT(IFNULL(note,''),%s) WHERE id=%s",
                (body.returned_at, f"\n[반납] {body.note}" if body.note else "", rental_id)
            )

        # 재고 복구 처리
        item_id = row.get("item_id")
        target_status = body.return_status or "데모"  # 새제품 또는 데모

        if item_id:
            # item_id가 있으면 해당 장비 상태를 선택한 상태로 변경
            cur.execute("UPDATE items SET status=%s WHERE id=%s AND status='대여중'", (target_status, item_id))
        else:
            # item_id가 없는 경우: 품명으로 재고 복구 (return_status에 맞는 상태의 항목에)
            item_name = row.get("item_name") or ""

            if item_name:
                # 같은 품명 + 같은 상태의 항목에 수량 추가
                cur.execute("""
                    SELECT id, quantity FROM items
                    WHERE item_name = %s AND status = %s
                    ORDER BY quantity DESC
                    LIMIT 1
                """, (item_name, target_status))
                item_row = cur.fetchone()

                if item_row:
                    # 기존 항목에 수량 추가
                    new_qty = item_row['quantity'] + return_quantity
                    cur.execute(
                        "UPDATE items SET quantity = %s WHERE id = %s",
                        (new_qty, item_row['id'])
                    )

    return {"ok": True}


@router.put("/{rental_id}/extend")
def extend_rental(rental_id: int, body: RentalExtend):
    """대여 연장 처리"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM rental_history WHERE id=%s", (rental_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Rental not found")

        if row["returned_at"]:
            raise HTTPException(400, "이미 반납된 대여는 연장할 수 없습니다")

        # 기존 반납예정일 저장
        old_date = row["expected_return"] or "미정"

        # 반납예정일 업데이트 + 노트 추가
        note_text = f"\n[연장] {old_date} → {body.new_expected_return}"
        if body.note:
            note_text += f" ({body.note})"

        cur.execute(
            "UPDATE rental_history SET expected_return=%s, note=CONCAT(IFNULL(note,''),%s) WHERE id=%s",
            (body.new_expected_return, note_text, rental_id)
        )

    return {"ok": True}


@router.put("/{rental_id}/toggle-check")
def toggle_needs_check(rental_id: int):
    """확인필요 체크 토글"""
    with db_cursor() as cur:
        cur.execute("SELECT needs_check FROM rental_history WHERE id=%s", (rental_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Rental not found")

        new_value = 0 if row.get("needs_check") else 1
        cur.execute("UPDATE rental_history SET needs_check=%s WHERE id=%s", (new_value, rental_id))

    return {"ok": True, "needs_check": bool(new_value)}


@router.put("/{rental_id}")
def update_rental_item(rental_id: int, body: RentalItemUpdate):
    """개별 대여 품목 수정 (품목 교체 등)"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM rental_history WHERE id=%s", (rental_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Rental not found")

        old_item_id = row.get("item_id")
        old_item_name = row.get("item_name") or ""

        update_fields = []
        update_params = []
        note_parts = []

        # 새 장비로 교체하는 경우
        if body.item_id is not None:
            # 기존 장비 상태 복구 (대여중 → 데모)
            if old_item_id:
                cur.execute("UPDATE items SET status='데모' WHERE id=%s AND status='대여중'", (old_item_id,))

            # 새 장비 상태 변경 (데모 → 대여중)
            if body.item_id > 0:
                cur.execute(
                    "UPDATE items SET status='대여중' WHERE id=%s AND status IN ('데모', '새제품')",
                    (body.item_id,)
                )
                if cur.rowcount == 0:
                    raise HTTPException(409, "이 장비는 현재 대여할 수 없습니다 (이미 대여중이거나 납품예정)")

                # 새 장비 정보 가져오기
                cur.execute("SELECT item_name, description, ip, serial FROM items WHERE id=%s", (body.item_id,))
                new_item = cur.fetchone()
                if new_item:
                    update_fields.append("item_id=%s")
                    update_params.append(body.item_id)
                    update_fields.append("item_name=%s")
                    update_params.append(new_item['item_name'])
                    update_fields.append("description=%s")
                    update_params.append(new_item['description'] or '')
                    note_parts.append(f"품목 교체: {old_item_name} → {new_item['item_name']}")
            else:
                # item_id를 0 또는 None으로 설정 (장비 연결 해제)
                update_fields.append("item_id=NULL")
                note_parts.append(f"장비 연결 해제: {old_item_name}")

        # 품명 직접 수정 (item_id가 없는 경우)
        if body.item_name is not None and body.item_id is None:
            update_fields.append("item_name=%s")
            update_params.append(body.item_name)
            if old_item_name != body.item_name:
                note_parts.append(f"품명 변경: {old_item_name} → {body.item_name}")

        # 규격(description) 수정
        if body.description is not None:
            update_fields.append("description=%s")
            update_params.append(body.description)

        # 수량 수정
        if body.quantity is not None:
            old_qty = row.get("quantity") or 1
            update_fields.append("quantity=%s")
            update_params.append(body.quantity)
            if old_qty != body.quantity:
                note_parts.append(f"수량 변경: {old_qty} → {body.quantity}")

        # 비고 추가
        if body.note:
            note_parts.append(body.note)

        # 노트 업데이트
        if note_parts:
            update_fields.append("note=CONCAT(IFNULL(note,''),%s)")
            update_params.append(f"\n[수정] " + ", ".join(note_parts))

        if update_fields:
            update_params.append(rental_id)
            sql = f"UPDATE rental_history SET {', '.join(update_fields)} WHERE id=%s"
            cur.execute(sql, update_params)

    return {"ok": True}


@router.delete("/{rental_id}")
def delete_rental(rental_id: int, request: Request):
    require_perm(request, "can_delete")
    with db_cursor() as cur:
        # 삭제 전 정보 조회
        cur.execute("SELECT item_id, item_name, quantity, returned_at FROM rental_history WHERE id=%s", (rental_id,))
        row = cur.fetchone()

        if row:
            # 미반납 상태일 때만 재고 복구
            if not row["returned_at"]:
                if row["item_id"]:
                    # item_id가 있으면 status를 '데모'로 복구
                    cur.execute("UPDATE items SET status='데모' WHERE id=%s AND status='대여중'", (row["item_id"],))
                else:
                    # item_id가 없는 경우 (악세사리): 품명으로 재고 복구
                    item_name = row.get("item_name") or ""
                    restore_qty = row.get("quantity") or 1
                    if item_name:
                        cur.execute("""
                            SELECT id, quantity FROM items
                            WHERE item_name = %s AND status IN ('데모', '새제품')
                            ORDER BY quantity DESC
                            LIMIT 1
                        """, (item_name,))
                        item_row = cur.fetchone()
                        if item_row:
                            new_qty = item_row['quantity'] + restore_qty
                            cur.execute("UPDATE items SET quantity = %s WHERE id = %s", (new_qty, item_row['id']))

            # rental_history에서 삭제
            cur.execute("DELETE FROM rental_history WHERE id=%s", (rental_id,))
    return {"ok": True}


@router.post("/group/delete")
def delete_rental_group(
    request: Request,
    rent_date: str = Query(...),
    borrower: str = Query(...),
    contact_name: Optional[str] = Query(None)
):
    """업체별(그룹별) 전체 삭제 - 같은 날짜, 업체, 담당자의 모든 대여 이력 삭제"""
    require_perm(request, "can_delete")
    with db_cursor() as cur:
        # 삭제할 대여 이력 조회
        sql = "SELECT * FROM rental_history WHERE rent_date=%s AND borrower=%s"
        params = [rent_date, borrower]

        if contact_name:
            sql += " AND contact_name=%s"
            params.append(contact_name)
        else:
            sql += " AND (contact_name IS NULL OR contact_name='')"

        cur.execute(sql, params)
        rentals = cur.fetchall()

        if not rentals:
            raise HTTPException(404, "해당 그룹의 대여 이력이 없습니다")

        # 삭제할 rental_id 목록
        rental_ids = [r["id"] for r in rentals]

        # 미반납 상태일 때 재고 복구
        for r in rentals:
            if not r.get("returned_at"):
                if r.get("item_id"):
                    # item_id가 있으면 status 복구
                    cur.execute("UPDATE items SET status='데모' WHERE id=%s AND status='대여중'", (r["item_id"],))
                else:
                    # item_id가 없는 경우 (악세사리): 품명으로 재고 복구
                    item_name = r.get("item_name") or ""
                    restore_qty = r.get("quantity") or 1
                    if item_name:
                        cur.execute("""
                            SELECT id, quantity FROM items
                            WHERE item_name = %s AND status IN ('데모', '새제품')
                            ORDER BY quantity DESC
                            LIMIT 1
                        """, (item_name,))
                        item_row = cur.fetchone()
                        if item_row:
                            new_qty = item_row['quantity'] + restore_qty
                            cur.execute("UPDATE items SET quantity = %s WHERE id = %s", (new_qty, item_row['id']))

        # rental_history에서 삭제
        placeholders = ','.join(['%s'] * len(rental_ids))
        cur.execute(f"DELETE FROM rental_history WHERE id IN ({placeholders})", rental_ids)

    return {"ok": True, "deleted_count": len(rental_ids)}


@router.put("/group/update")
def update_rental_group(body: RentalGroupUpdate):
    """업체별(그룹별) 일괄 수정 - 같은 날짜, 업체, 담당자의 모든 대여 이력 수정"""
    with db_cursor() as cur:
        # 수정할 대여 이력 조회
        sql = "SELECT * FROM rental_history WHERE rent_date=%s AND borrower=%s"
        params = [body.rent_date, body.borrower]

        if body.original_contact_name:
            sql += " AND contact_name=%s"
            params.append(body.original_contact_name)
        else:
            sql += " AND (contact_name IS NULL OR contact_name='')"

        cur.execute(sql, params)
        rentals = cur.fetchall()

        if not rentals:
            raise HTTPException(404, "해당 그룹의 대여 이력이 없습니다")

        # 수정할 rental_id 목록
        rental_ids = [r["id"] for r in rentals]

        # 업데이트 쿼리 작성
        update_fields = []
        update_params = []

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

        # expected_return 업데이트 (None = 미정, 날짜 = 설정)
        # 주의: validator가 빈 문자열을 None으로 변환함
        if hasattr(body, 'expected_return'):
            update_fields.append("expected_return=%s")
            update_params.append(body.expected_return)

        # 노트 추가
        if hasattr(body, 'note') and body.note:
            update_fields.append("note=CONCAT(IFNULL(note,''),%s)")
            update_params.append(f"\n[수정] {body.note}")

        if update_fields:
            placeholders = ','.join(['%s'] * len(rental_ids))
            sql = f"UPDATE rental_history SET {', '.join(update_fields)} WHERE id IN ({placeholders})"
            update_params.extend(rental_ids)
            cur.execute(sql, update_params)

    return {"ok": True, "updated_count": len(rental_ids)}
