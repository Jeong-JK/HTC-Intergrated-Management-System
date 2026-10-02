#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
재고 수량 조정 스크립트 (최종)
- 납품예정: 새제품에서만 차감
- 대여중: 데모에서만 차감
"""

from database import get_connection

def adjust_quantities_final(dry_run=True):
    """재고 수량 조정 - 새제품/데모 구분"""

    print("=" * 80)
    print("재고 수량 조정")
    print("  • 납품예정 → 새제품에서 차감")
    print("  • 대여중 → 데모에서 차감")
    print("=" * 80)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 1. 품목별 대여중 수량 (데모에서 차감)
        print("\n[1/2] 대여중 수량 집계 (데모용)...")
        cursor.execute("""
            SELECT item_name, SUM(quantity) as total
            FROM rental_history
            WHERE returned_at IS NULL
            GROUP BY item_name
        """)
        rental_needs = {row['item_name']: int(row['total']) for row in cursor.fetchall()}
        print(f"   ✓ 대여중: {len(rental_needs)}개 품명, {sum(rental_needs.values())}개 (데모에서 차감)")

        # 2. 품목별 납품예정 수량 (새제품에서 차감)
        print("\n[2/2] 납품예정 수량 집계 (새제품용)...")
        cursor.execute("""
            SELECT item_name, SUM(quantity) as total
            FROM delivery_history
            WHERE status = '납품예정'
            GROUP BY item_name
        """)
        pending_needs = {row['item_name']: int(row['total']) for row in cursor.fetchall()}
        print(f"   ✓ 납품예정: {len(pending_needs)}개 품명, {sum(pending_needs.values())}개 (새제품에서 차감)")

        # 3. 대여중(데모) 처리
        print("\n[3/4] 대여중 수량 차감 중 (데모)...")
        rental_updates = []
        rental_deducted = 0

        for item_name, need_qty in sorted(rental_needs.items()):
            # 데모 품목만 조회
            cursor.execute("""
                SELECT id, item_name, quantity, status
                FROM items
                WHERE item_name = %s AND status = '데모' AND quantity > 0
                ORDER BY id
            """, (item_name,))
            items = cursor.fetchall()

            if not items:
                print(f"   ⚠️  '{item_name}': 데모 재고 없음 (필요: {need_qty}개)")
                continue

            current_stock = sum(item['quantity'] for item in items)
            if current_stock < need_qty:
                print(f"   ⚠️  '{item_name}': 데모 재고 부족 (현재: {current_stock}, 필요: {need_qty})")

            # 순차 차감
            remaining = need_qty
            for item in items:
                if remaining <= 0:
                    break

                deduct = min(item['quantity'], remaining)
                new_qty = item['quantity'] - deduct

                rental_updates.append({
                    'id': item['id'],
                    'item_name': item_name,
                    'status': item['status'],
                    'old_qty': item['quantity'],
                    'deduct': deduct,
                    'new_qty': new_qty
                })

                remaining -= deduct
                rental_deducted += deduct

        print(f"   ✓ 데모 {len(rental_updates)}개 행에서 {rental_deducted}개 차감")

        # 4. 납품예정(새제품) 처리
        print("\n[4/4] 납품예정 수량 차감 중 (새제품)...")
        pending_updates = []
        pending_deducted = 0

        for item_name, need_qty in sorted(pending_needs.items()):
            # 새제품만 조회
            cursor.execute("""
                SELECT id, item_name, quantity, status
                FROM items
                WHERE item_name = %s AND status = '새제품' AND quantity > 0
                ORDER BY id
            """, (item_name,))
            items = cursor.fetchall()

            if not items:
                print(f"   ⚠️  '{item_name}': 새제품 재고 없음 (필요: {need_qty}개)")
                continue

            current_stock = sum(item['quantity'] for item in items)
            if current_stock < need_qty:
                print(f"   ⚠️  '{item_name}': 새제품 재고 부족 (현재: {current_stock}, 필요: {need_qty})")

            # 순차 차감
            remaining = need_qty
            for item in items:
                if remaining <= 0:
                    break

                deduct = min(item['quantity'], remaining)
                new_qty = item['quantity'] - deduct

                pending_updates.append({
                    'id': item['id'],
                    'item_name': item_name,
                    'status': item['status'],
                    'old_qty': item['quantity'],
                    'deduct': deduct,
                    'new_qty': new_qty
                })

                remaining -= deduct
                pending_deducted += deduct

        print(f"   ✓ 새제품 {len(pending_updates)}개 행에서 {pending_deducted}개 차감")

        # 5. 전체 결과 출력
        all_updates = rental_updates + pending_updates

        print("\n" + "=" * 80)
        print(f"조정 결과: {len(all_updates)}개 행 업데이트")
        print("=" * 80)

        if len(all_updates) > 0:
            print(f"\n{'품명':<40} {'상태':<10} {'ID':<6} {'현재':<6} {'차감':<6} {'→':<3} {'결과':<6}")
            print("-" * 80)

            # 데모 먼저
            print("▶ 대여중 (데모)")
            for u in rental_updates[:30]:
                print(f"{u['item_name'][:40]:<40} {u['status']:<10} {u['id']:<6} {u['old_qty']:<6} -{u['deduct']:<5} → {u['new_qty']:<6}")

            if len(rental_updates) > 30:
                print(f"  ... 외 {len(rental_updates) - 30}개 더")

            # 새제품
            print("\n▶ 납품예정 (새제품)")
            for u in pending_updates[:30]:
                print(f"{u['item_name'][:40]:<40} {u['status']:<10} {u['id']:<6} {u['old_qty']:<6} -{u['deduct']:<5} → {u['new_qty']:<6}")

            if len(pending_updates) > 30:
                print(f"  ... 외 {len(pending_updates) - 30}개 더")

            print(f"\n총 차감: {rental_deducted + pending_deducted}개 (데모: {rental_deducted}, 새제품: {pending_deducted})")

        # 6. 실제 업데이트
        if not dry_run and len(all_updates) > 0:
            print("\n[실행] 데이터베이스 업데이트 중...")

            success = 0
            for u in all_updates:
                try:
                    cursor.execute("UPDATE items SET quantity = %s WHERE id = %s", (u['new_qty'], u['id']))
                    success += 1
                except Exception as e:
                    print(f"   ✗ 에러 (ID {u['id']}): {e}")

            conn.commit()
            print(f"   ✓ {success}개 행 업데이트 완료")

            print("\n" + "=" * 80)
            print("재고 수량 조정 완료!")
            print("=" * 80)

        elif dry_run:
            print("\n⚠️  DRY RUN 모드 - 실제 업데이트하지 않음")

    except Exception as e:
        conn.rollback()
        print(f"\n✗ 에러: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    print("\n[DRY RUN] 어떻게 조정될지 확인합니다...\n")
    adjust_quantities_final(dry_run=True)

    print("\n" + "=" * 80)
    response = input("\n실제로 업데이트하시겠습니까? (yes 입력): ")
    if response.lower() == 'yes':
        print()
        adjust_quantities_final(dry_run=False)
    else:
        print("\n취소되었습니다.")
