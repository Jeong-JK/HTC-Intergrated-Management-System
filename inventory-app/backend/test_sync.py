#!/usr/bin/env python3
"""단가/환율 동기화 테스트 스크립트"""
import requests
import json
from database import db_cursor

BASE_URL = "http://localhost:8000/api"

def execute_query(sql):
    """DB 쿼리 실행 헬퍼 함수"""
    with db_cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()

def test_items_to_inbound_sync():
    """테스트 1: items 수정 시 최신 inbound도 변경되는지"""
    print("\n=== 테스트 1: 재고 관리 화면에서 수정 (items → inbound 동기화) ===")

    item_id = 1031

    # 수정 전 상태 확인
    print("\n[수정 전]")
    item_before = execute_query(f"SELECT id, item_name, unit_price, exchange_rate FROM items WHERE id={item_id};")
    print(f"Items (id={item_id}): {item_before}")

    inbound_before = execute_query(f"""
        SELECT id, item_id, unit_price, exchange_rate, inbound_date
        FROM inbound WHERE item_id={item_id}
        ORDER BY inbound_date DESC, id DESC LIMIT 1;
    """)
    print(f"최신 Inbound: {inbound_before}")

    # API 호출로 items 수정
    payload = {
        "rack_no": "",
        "box_no": "",
        "item_type": "라디오",
        "category": "SL4210",
        "item_name": "SL4210-235-SB",
        "description": "",
        "serial": "",
        "ip": "",
        "mac": "",
        "status": "데모",
        "quantity": 1,
        "license_key": "",
        "purchase_date": None,
        "unit_price": 5000.00,
        "exchange_rate": 1400.00,
        "note": ""
    }

    print(f"\n[수정 실행] PUT /items/{item_id}")
    print(f"  새 단가: $5000, 새 환율: 1400")

    response = requests.put(f"{BASE_URL}/items/{item_id}", json=payload)
    print(f"  응답 상태: {response.status_code}")

    # 수정 후 상태 확인
    print("\n[수정 후]")
    item_after = execute_query(f"SELECT id, item_name, unit_price, exchange_rate FROM items WHERE id={item_id};")
    print(f"Items (id={item_id}): {item_after}")

    inbound_after = execute_query(f"""
        SELECT id, item_id, unit_price, exchange_rate, inbound_date
        FROM inbound WHERE item_id={item_id}
        ORDER BY inbound_date DESC, id DESC LIMIT 1;
    """)
    print(f"최신 Inbound: {inbound_after}")

    # 결과 확인
    if inbound_after and len(inbound_after) > 0:
        inbound_rec = inbound_after[0]
        if float(inbound_rec['unit_price']) == 5000.00 and float(inbound_rec['exchange_rate']) == 1400.00:
            print("\n✅ 동기화 성공! 최신 입고 건의 단가/환율이 함께 업데이트되었습니다.")
            return True
        else:
            print("\n❌ 동기화 실패! 입고 건이 업데이트되지 않았습니다.")
            print(f"   실제: 단가=${inbound_rec['unit_price']}, 환율={inbound_rec['exchange_rate']}")
            return False
    else:
        print("\n⚠️ 입고 기록이 없습니다.")
        return False


def test_inbound_to_items_sync():
    """테스트 2: inbound 수정 시 items도 변경되는지"""
    print("\n\n=== 테스트 2: 입고 상세 화면에서 수정 (inbound → items 동기화) ===")

    item_id = 1031

    # 최신 입고 건 ID 가져오기
    inbound_rec = execute_query(f"""
        SELECT id, item_id, unit_price, exchange_rate
        FROM inbound WHERE item_id={item_id}
        ORDER BY inbound_date DESC, id DESC LIMIT 1;
    """)

    if not inbound_rec or len(inbound_rec) == 0:
        print("❌ 입고 기록이 없어서 테스트를 진행할 수 없습니다.")
        return False

    inbound_id = inbound_rec[0]['id']

    # 수정 전 상태 확인
    print("\n[수정 전]")
    item_before = execute_query(f"SELECT id, item_name, unit_price, exchange_rate FROM items WHERE id={item_id};")
    print(f"Items (id={item_id}): {item_before}")

    print(f"Inbound (id={inbound_id}): {inbound_rec}")

    # API 호출로 inbound 수정
    payload = {
        "unit_price": 6000.00,
        "exchange_rate": 1500.00
    }

    print(f"\n[수정 실행] PUT /inbound/{inbound_id}")
    print(f"  새 단가: $6000, 새 환율: 1500")

    response = requests.put(f"{BASE_URL}/inbound/{inbound_id}", json=payload)
    print(f"  응답 상태: {response.status_code}")

    # 수정 후 상태 확인
    print("\n[수정 후]")
    item_after = execute_query(f"SELECT id, item_name, unit_price, exchange_rate FROM items WHERE id={item_id};")
    print(f"Items (id={item_id}): {item_after}")

    inbound_after = execute_query(f"""
        SELECT id, item_id, unit_price, exchange_rate
        FROM inbound WHERE id={inbound_id};
    """)
    print(f"Inbound (id={inbound_id}): {inbound_after}")

    # 결과 확인
    if item_after and len(item_after) > 0:
        item_rec = item_after[0]
        if float(item_rec['unit_price']) == 6000.00 and float(item_rec['exchange_rate']) == 1500.00:
            print("\n✅ 동기화 성공! Items의 단가/환율이 함께 업데이트되었습니다.")
            return True
        else:
            print(f"\n❌ 동기화 실패! Items가 업데이트되지 않았습니다.")
            print(f"   예상: 단가=$6000, 환율=1500")
            print(f"   실제: 단가=${item_rec['unit_price']}, 환율={item_rec['exchange_rate']}")
            return False
    else:
        print("\n⚠️ Items 레코드를 찾을 수 없습니다.")
        return False


if __name__ == "__main__":
    result1 = test_items_to_inbound_sync()
    result2 = test_inbound_to_items_sync()

    print("\n" + "="*70)
    print("테스트 결과 요약")
    print("="*70)
    print(f"테스트 1 (items → inbound): {'✅ 성공' if result1 else '❌ 실패'}")
    print(f"테스트 2 (inbound → items): {'✅ 성공' if result2 else '❌ 실패'}")
    print("="*70)
