#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
재고 상태 업데이트 (IP/Serial 기반)
- 대여이력의 IP/Serial → items 상태를 '대여중'으로
- 납품이력의 IP/Serial → items 상태를 '납품예정'으로
"""

from database import get_connection

def update_status_by_ip(dry_run=True):
    """IP/Serial 기반으로 재고 상태 업데이트"""

    print("=" * 80)
    print("재고 상태 업데이트 (IP/Serial 기반)")
    print("  • 대여이력 IP/Serial → 상태: 대여중")
    print("  • 납품이력 IP/Serial → 상태: 납품예정")
    print("=" * 80)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 1. 대여중 처리
        print("\n[1/2] 대여중 상태 업데이트...")
        cursor.execute("""
            SELECT id, item_name, description
            FROM rental_history
            WHERE returned_at IS NULL
              AND description IS NOT NULL
              AND description <> ''
        """)
        rentals = cursor.fetchall()
        print(f"   ✓ 대여중 {len(rentals)}건 (IP/Serial 있음)")

        rental_updates = []
        rental_not_found = []

        for rental in rentals:
            ip_serial = rental['description'].strip()

            # items에서 ip 또는 serial로 검색
            cursor.execute("""
                SELECT id, item_name, ip, serial, status
                FROM items
                WHERE (ip = %s OR serial = %s)
                  AND item_name = %s
                LIMIT 1
            """, (ip_serial, ip_serial, rental['item_name']))

            item = cursor.fetchone()

            if item:
                if item['status'] != '대여중':
                    rental_updates.append({
                        'id': item['id'],
                        'item_name': item['item_name'],
                        'ip_serial': ip_serial,
                        'old_status': item['status'],
                        'new_status': '대여중'
                    })
            else:
                rental_not_found.append({
                    'item_name': rental['item_name'],
                    'ip_serial': ip_serial
                })

        print(f"   ✓ 매칭: {len(rental_updates)}개")
        if len(rental_not_found) > 0:
            print(f"   ⚠️  미매칭: {len(rental_not_found)}개")
            for nf in rental_not_found[:5]:
                print(f"      - {nf['item_name']} ({nf['ip_serial']})")
            if len(rental_not_found) > 5:
                print(f"      ... 외 {len(rental_not_found) - 5}개")

        # 2. 납품예정 처리
        print("\n[2/2] 납품예정 상태 업데이트...")
        cursor.execute("""
            SELECT id, item_name, description
            FROM delivery_history
            WHERE status = '납품예정'
              AND description IS NOT NULL
              AND description <> ''
        """)
        deliveries = cursor.fetchall()
        print(f"   ✓ 납품예정 {len(deliveries)}건 (IP/Serial 있음)")

        delivery_updates = []
        delivery_not_found = []

        for delivery in deliveries:
            ip_serial = delivery['description'].strip()

            # items에서 ip 또는 serial로 검색
            cursor.execute("""
                SELECT id, item_name, ip, serial, status
                FROM items
                WHERE (ip = %s OR serial = %s)
                  AND item_name = %s
                LIMIT 1
            """, (ip_serial, ip_serial, delivery['item_name']))

            item = cursor.fetchone()

            if item:
                if item['status'] != '납품예정':
                    delivery_updates.append({
                        'id': item['id'],
                        'item_name': item['item_name'],
                        'ip_serial': ip_serial,
                        'old_status': item['status'],
                        'new_status': '납품예정'
                    })
            else:
                delivery_not_found.append({
                    'item_name': delivery['item_name'],
                    'ip_serial': ip_serial
                })

        print(f"   ✓ 매칭: {len(delivery_updates)}개")
        if len(delivery_not_found) > 0:
            print(f"   ⚠️  미매칭: {len(delivery_not_found)}개")
            for nf in delivery_not_found[:5]:
                print(f"      - {nf['item_name']} ({nf['ip_serial']})")
            if len(delivery_not_found) > 5:
                print(f"      ... 외 {len(delivery_not_found) - 5}개")

        # 3. 결과 출력
        all_updates = rental_updates + delivery_updates

        print("\n" + "=" * 80)
        print(f"업데이트 대상: {len(all_updates)}개")
        print("=" * 80)

        if len(all_updates) > 0:
            print(f"\n{'품명':<40} {'IP/Serial':<20} {'기존':<10} {'→':<3} {'변경':<10}")
            print("-" * 80)

            # 대여중
            if len(rental_updates) > 0:
                print("▶ 대여중")
                for u in rental_updates[:20]:
                    print(f"{u['item_name'][:40]:<40} {u['ip_serial']:<20} {u['old_status']:<10} → {u['new_status']:<10}")
                if len(rental_updates) > 20:
                    print(f"  ... 외 {len(rental_updates) - 20}개")

            # 납품예정
            if len(delivery_updates) > 0:
                print("\n▶ 납품예정")
                for u in delivery_updates[:20]:
                    print(f"{u['item_name'][:40]:<40} {u['ip_serial']:<20} {u['old_status']:<10} → {u['new_status']:<10}")
                if len(delivery_updates) > 20:
                    print(f"  ... 외 {len(delivery_updates) - 20}개")

        # 4. 실제 업데이트
        if not dry_run and len(all_updates) > 0:
            print("\n[실행] 상태 업데이트 중...")

            success = 0
            for u in all_updates:
                try:
                    cursor.execute(
                        "UPDATE items SET status = %s WHERE id = %s",
                        (u['new_status'], u['id'])
                    )
                    success += 1
                except Exception as e:
                    print(f"   ✗ 에러 (ID {u['id']}): {e}")

            conn.commit()
            print(f"   ✓ {success}개 상태 업데이트 완료")

            print("\n" + "=" * 80)
            print("상태 업데이트 완료!")
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
    print("\n[DRY RUN] 어떻게 변경될지 확인합니다...\n")
    update_status_by_ip(dry_run=True)

    print("\n" + "=" * 80)
    response = input("\n실제로 업데이트하시겠습니까? (yes 입력): ")
    if response.lower() == 'yes':
        print()
        update_status_by_ip(dry_run=False)
    else:
        print("\n취소되었습니다.")
