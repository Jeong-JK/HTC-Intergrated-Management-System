#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
재고 수량 조정 스크립트
대여중(반납안됨) + 납품예정 수량만큼 items 테이블의 수량을 차감
※ 납품완료는 이미 조정되어 있다고 가정
"""

from database import get_connection
from decimal import Decimal

def analyze_quantities(dry_run=True):
    """재고 수량 분석 및 조정"""

    print("=" * 80)
    print("재고 수량 조정 분석")
    print("=" * 80)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # items 테이블의 모든 품목과 현재 수량 조회
        print("\n[1/4] items 테이블 데이터 로드 중...")
        cursor.execute("""
            SELECT id, item_name, quantity, status
            FROM items
            WHERE item_type IN ('라디오', '안테나', '악세사리')
        """)
        items = cursor.fetchall()
        print(f"   ✓ {len(items)}개 품목 로드 완료")

        # 품목별 대여중 수량 집계 (반납 안 된 것만)
        print("\n[2/4] 대여중 수량 집계 중...")
        cursor.execute("""
            SELECT item_name, SUM(quantity) as total_rented
            FROM rental_history
            WHERE returned_at IS NULL
            GROUP BY item_name
        """)
        rental_dict = {row['item_name']: int(row['total_rented']) for row in cursor.fetchall()}
        total_rented = sum(rental_dict.values())
        print(f"   ✓ 대여중: {len(rental_dict)}개 품목, 총 {total_rented}개")

        # 품목별 납품예정 수량 집계 (납품완료는 이미 조정되어 있음)
        print("\n[3/4] 납품예정 수량 집계 중...")
        cursor.execute("""
            SELECT item_name, SUM(quantity) as total_pending
            FROM delivery_history
            WHERE status = '납품예정'
            GROUP BY item_name
        """)
        delivery_dict = {row['item_name']: int(row['total_pending']) for row in cursor.fetchall()}
        total_delivered = sum(delivery_dict.values())
        print(f"   ✓ 납품예정: {len(delivery_dict)}개 품목, 총 {total_delivered}개")

        # 조정이 필요한 품목 찾기
        print("\n[4/4] 조정 필요 품목 분석 중...")
        adjustments = []

        for item in items:
            item_name = item['item_name']
            current_qty = item['quantity']

            # 대여중 수량
            rented = rental_dict.get(item_name, 0)

            # 납품예정 수량
            pending = delivery_dict.get(item_name, 0)

            # 조정 필요 수량
            total_out = rented + pending

            if total_out > 0:
                new_qty = max(0, current_qty - total_out)  # 음수 방지

                if new_qty != current_qty:
                    adjustments.append({
                        'id': item['id'],
                        'item_name': item_name,
                        'status': item['status'],
                        'current_qty': current_qty,
                        'rented': rented,
                        'pending': pending,
                        'new_qty': new_qty,
                        'diff': new_qty - current_qty
                    })

        print(f"   ✓ 조정 필요: {len(adjustments)}개 품목")

        # 결과 출력
        print("\n" + "=" * 80)
        print("조정 필요 품목 목록")
        print("=" * 80)

        if len(adjustments) == 0:
            print("\n조정이 필요한 품목이 없습니다.")
        else:
            print(f"\n{'품명':<40} {'상태':<10} {'현재':<6} {'대여중':<6} {'예정':<6} {'→':<3} {'조정후':<6} {'차이':<6}")
            print("-" * 80)

            for adj in adjustments[:50]:  # 처음 50개만 표시
                print(f"{adj['item_name'][:40]:<40} {adj['status']:<10} {adj['current_qty']:<6} {adj['rented']:<6} {adj['pending']:<6} → {adj['new_qty']:<6} {adj['diff']:<6}")

            if len(adjustments) > 50:
                print(f"\n... 외 {len(adjustments) - 50}개 품목 더 있음")

            print("\n" + "=" * 80)
            print(f"총 {len(adjustments)}개 품목이 조정됩니다.")
            print("=" * 80)

        # 실제 업데이트 실행
        if not dry_run and len(adjustments) > 0:
            print("\n[실행] 재고 수량 업데이트 중...")

            success_count = 0
            error_count = 0

            for adj in adjustments:
                try:
                    cursor.execute("""
                        UPDATE items
                        SET quantity = %s
                        WHERE id = %s
                    """, (adj['new_qty'], adj['id']))
                    success_count += 1
                except Exception as e:
                    error_count += 1
                    print(f"   ✗ 에러 (ID: {adj['id']}): {e}")

            conn.commit()

            print(f"\n   ✓ 성공: {success_count}개")
            if error_count > 0:
                print(f"   ✗ 실패: {error_count}개")

            print("\n" + "=" * 80)
            print("재고 수량 조정 완료!")
            print("=" * 80)
        elif dry_run:
            print("\n⚠️  DRY RUN 모드입니다. 실제로 업데이트하려면 adjust_quantities(dry_run=False)를 실행하세요.")

        return adjustments

    except Exception as e:
        conn.rollback()
        print(f"\n✗ 에러 발생: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    # Dry run으로 먼저 확인
    print("\n⚠️  먼저 어떻게 변경될지 확인합니다...\n")
    adjustments = analyze_quantities(dry_run=True)

    if len(adjustments) > 0:
        print("\n" + "=" * 80)
        response = input("\n실제로 업데이트하시겠습니까? (yes/no): ")
        if response.lower() == 'yes':
            print("\n")
            analyze_quantities(dry_run=False)
        else:
            print("\n취소되었습니다.")
