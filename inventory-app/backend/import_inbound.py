#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
입고 데이터 Import 스크립트
입고_상세.html을 파싱하여 inbound 테이블에 입력
"""

import pandas as pd
import re
from datetime import datetime
from database import get_connection

def clean_currency(value):
    """통화 기호 및 쉼표 제거"""
    if pd.isna(value) or value == '':
        return 0.0

    # 문자열로 변환
    value_str = str(value)

    # $, ₩, 쉼표 제거
    cleaned = re.sub(r'[$₩,]', '', value_str)

    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return 0.0

def parse_date(date_str):
    """날짜 형식 변환: '2026. 1. 9' -> '2026-01-09'"""
    if pd.isna(date_str) or date_str == '':
        return None

    try:
        # '2026. 1. 9' 형식을 파싱
        date_str = str(date_str).strip()
        parts = date_str.split('.')
        if len(parts) == 3:
            year = parts[0].strip()
            month = parts[1].strip().zfill(2)
            day = parts[2].strip().zfill(2)
            return f"{year}-{month}-{day}"
    except (ValueError, IndexError):
        pass

    return None

def import_inbound_data():
    """입고_상세.html을 파싱하여 DB에 입력"""

    print("=" * 80)
    print("입고 데이터 Import 시작")
    print("=" * 80)

    # 1. HTML 파일 파싱
    print("\n[1/4] HTML 파일 파싱 중...")
    df = pd.read_html('/home/ec2-user/inventory-app/backend/입고_상세.html')[0]

    # 첫 행을 헤더로 사용
    new_header = df.iloc[0]
    df = df[2:]  # 헤더와 빈 행 제거
    df.columns = new_header
    df = df.reset_index(drop=True)

    print(f"   ✓ 총 {len(df)}개 행 파싱 완료")
    print(f"   ✓ 컬럼: {list(df.columns)}")

    # 2. 데이터 정제
    print("\n[2/4] 데이터 정제 중...")

    records = []
    for idx, row in df.iterrows():
        # 날짜 파싱
        inbound_date = parse_date(row['날짜'])
        if not inbound_date:
            print(f"   ⚠ 행 {idx+1}: 날짜 파싱 실패, 건너뜀")
            continue

        # 데이터 정제
        category = str(row['Product Category']) if pd.notna(row['Product Category']) else ''
        item_name = str(row['Procuct Name']) if pd.notna(row['Procuct Name']) else ''
        ip = str(row['Serial / IP']) if pd.notna(row['Serial / IP']) else ''
        serial = str(row['Serial']) if pd.notna(row['Serial']) else ''
        mac = str(row['MAC']) if pd.notna(row['MAC']) else ''
        quantity = int(row['수량']) if pd.notna(row['수량']) else 1
        unit_price = clean_currency(row['단가'])
        exchange_rate = clean_currency(row['환율'])

        records.append({
            'inbound_date': inbound_date,
            'category': category,
            'item_name': item_name,
            'ip': ip,
            'serial': serial,
            'mac': mac,
            'quantity': quantity,
            'unit_price': unit_price,
            'exchange_rate': exchange_rate
        })

    print(f"   ✓ {len(records)}개 레코드 정제 완료")

    # 3. DB 연결 및 기존 데이터 삭제
    print("\n[3/4] 기존 데이터 삭제 중...")
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 기존 데이터 개수 확인
        cursor.execute("SELECT COUNT(*) AS count FROM inbound")
        result = cursor.fetchone()
        old_count = result['count'] if result else 0
        print(f"   ℹ 기존 데이터: {old_count}개")

        # 전체 삭제
        cursor.execute("DELETE FROM inbound")
        conn.commit()
        print(f"   ✓ 기존 데이터 삭제 완료")

        # 4. 새 데이터 INSERT
        print("\n[4/4] 새 데이터 INSERT 중...")

        insert_query = """
        INSERT INTO inbound
        (inbound_date, category, item_name, ip, serial, mac, quantity, unit_price, exchange_rate)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        success_count = 0
        error_count = 0

        for record in records:
            try:
                cursor.execute(insert_query, (
                    record['inbound_date'],
                    record['category'],
                    record['item_name'],
                    record['ip'],
                    record['serial'],
                    record['mac'],
                    record['quantity'],
                    record['unit_price'],
                    record['exchange_rate']
                ))
                success_count += 1
            except Exception as e:
                error_count += 1
                print(f"   ✗ 에러: {e}")
                print(f"      데이터: {record}")

        conn.commit()

        print(f"\n   ✓ 성공: {success_count}개")
        if error_count > 0:
            print(f"   ✗ 실패: {error_count}개")

        # 최종 확인
        cursor.execute("SELECT COUNT(*) AS count FROM inbound")
        result = cursor.fetchone()
        new_count = result['count'] if result else 0

        print("\n" + "=" * 80)
        print("Import 완료!")
        print("=" * 80)
        print(f"기존 데이터: {old_count}개")
        print(f"새 데이터: {new_count}개")
        print("=" * 80)

    except Exception as e:
        conn.rollback()
        print(f"\n✗ 에러 발생: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    import_inbound_data()
