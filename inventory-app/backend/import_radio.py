#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
라디오 데이터 Import 스크립트
라디오(New).html, 라디오.html을 파싱하여 items 테이블에 입력
"""

import pandas as pd
import re
from datetime import datetime
from database import get_connection

def clean_currency(value):
    """통화 기호 및 쉼표 제거"""
    if pd.isna(value) or value == '':
        return 0.0

    value_str = str(value)
    cleaned = re.sub(r'[$₩,]', '', value_str)

    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return 0.0

def parse_date(date_str):
    """날짜 형식 변환"""
    if pd.isna(date_str) or date_str == '' or date_str == 'NaN':
        return None

    date_str = str(date_str).strip()

    # 이미 YYYY-MM-DD 형식인 경우
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str

    # '2026. 1. 9' 형식
    if '.' in date_str:
        try:
            parts = date_str.split('.')
            if len(parts) == 3:
                year = parts[0].strip()
                month = parts[1].strip().zfill(2)
                day = parts[2].strip().zfill(2)
                return f"{year}-{month}-{day}"
        except (ValueError, IndexError):
            pass

    # 기타 특수한 값들은 None 처리
    if date_str in ['?', '이사님 기증', '이사님기증']:
        return None

    return None

def clean_string(value):
    """문자열 정제"""
    if pd.isna(value) or value == '' or value == 'NaN' or value == 'nan':
        return ''
    return str(value).strip()

def import_radio_data():
    """라디오 HTML 파일을 파싱하여 DB에 입력"""

    print("=" * 80)
    print("라디오 데이터 Import 시작")
    print("=" * 80)

    # 1. 라디오(New) 파싱
    print("\n[1/5] 라디오(New).html 파싱 중...")
    df_new = pd.read_html('/home/ec2-user/inventory-app/backend/라디오(New).html')[0]
    new_header = df_new.iloc[1]
    df_new = df_new[3:]
    df_new.columns = new_header
    df_new = df_new.reset_index(drop=True)
    print(f"   ✓ {len(df_new)}개 행 파싱 완료")

    # 2. 라디오 파싱
    print("\n[2/5] 라디오.html 파싱 중...")
    df_old = pd.read_html('/home/ec2-user/inventory-app/backend/라디오.html')[0]
    new_header = df_old.iloc[1]
    df_old = df_old[3:]
    df_old.columns = new_header
    df_old = df_old.reset_index(drop=True)
    print(f"   ✓ {len(df_old)}개 행 파싱 완료")

    # 3. 데이터 정제
    print("\n[3/5] 데이터 정제 중...")

    records = []

    # 라디오(New) 처리
    for idx, row in df_new.iterrows():
        rack_no = clean_string(row['Location'])
        box_no = ''  # 라디오(New)는 BOX No 없음
        category = clean_string(row['Product Category'])
        item_name = clean_string(row['Procuct Name'])
        description = clean_string(row.get('Description', ''))
        ip = clean_string(row['Serial / IP'])
        serial = clean_string(row['Serial'])
        mac = clean_string(row['MAC'])
        license_key = clean_string(row.get('라이선스', ''))
        quantity = int(row['수량']) if pd.notna(row['수량']) else 1
        status = clean_string(row['상태'])
        note = clean_string(row.get('비고', ''))
        purchase_date = parse_date(row['매입일'])
        unit_price = clean_currency(row['단가'])
        exchange_rate = clean_currency(row['환율'])

        records.append({
            'item_type': '라디오',
            'rack_no': rack_no,
            'box_no': box_no,
            'category': category,
            'item_name': item_name,
            'description': description,
            'ip': ip,
            'serial': serial,
            'mac': mac,
            'license_key': license_key,
            'quantity': quantity,
            'status': status,
            'note': note,
            'purchase_date': purchase_date,
            'unit_price': unit_price,
            'exchange_rate': exchange_rate
        })

    print(f"   ✓ 라디오(New): {len(df_new)}개 레코드 정제 완료")

    # 라디오 처리
    for idx, row in df_old.iterrows():
        rack_no = clean_string(row['Location'])
        box_no = clean_string(row['BOX No'])
        category = clean_string(row['Product Category'])
        item_name = clean_string(row['Procuct Name'])
        description = clean_string(row.get('Description', ''))
        ip = clean_string(row['Serial / IP'])
        serial = clean_string(row['Serial'])
        mac = clean_string(row['MAC'])
        license_key = clean_string(row.get('라이선스', ''))
        quantity = int(row['수량']) if pd.notna(row['수량']) else 1
        status = clean_string(row['상태'])
        note = clean_string(row.get('비고', ''))
        purchase_date = parse_date(row['매입일'])
        unit_price = clean_currency(row['단가'])
        exchange_rate = clean_currency(row['환율'])

        records.append({
            'item_type': '라디오',
            'rack_no': rack_no,
            'box_no': box_no,
            'category': category,
            'item_name': item_name,
            'description': description,
            'ip': ip,
            'serial': serial,
            'mac': mac,
            'license_key': license_key,
            'quantity': quantity,
            'status': status,
            'note': note,
            'purchase_date': purchase_date,
            'unit_price': unit_price,
            'exchange_rate': exchange_rate
        })

    print(f"   ✓ 라디오: {len(df_old)}개 레코드 정제 완료")
    print(f"   ✓ 총 {len(records)}개 레코드 준비 완료")

    # 4. DB 연결 및 기존 데이터 삭제
    print("\n[4/5] 기존 라디오 데이터 삭제 중...")
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 기존 라디오 데이터 개수 확인
        cursor.execute("SELECT COUNT(*) AS count FROM items WHERE item_type='라디오'")
        result = cursor.fetchone()
        old_count = result['count'] if result else 0
        print(f"   ℹ 기존 라디오 데이터: {old_count}개")

        # 라디오 데이터 삭제
        cursor.execute("DELETE FROM items WHERE item_type='라디오'")
        conn.commit()
        print(f"   ✓ 기존 라디오 데이터 삭제 완료")

        # 5. 새 데이터 INSERT
        print("\n[5/5] 새 라디오 데이터 INSERT 중...")

        insert_query = """
        INSERT INTO items
        (item_type, rack_no, box_no, category, item_name, description,
         ip, serial, mac, license_key, quantity, status, note,
         purchase_date, unit_price, exchange_rate)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        success_count = 0
        error_count = 0

        for record in records:
            try:
                cursor.execute(insert_query, (
                    record['item_type'],
                    record['rack_no'],
                    record['box_no'],
                    record['category'],
                    record['item_name'],
                    record['description'],
                    record['ip'],
                    record['serial'],
                    record['mac'],
                    record['license_key'],
                    record['quantity'],
                    record['status'],
                    record['note'],
                    record['purchase_date'],
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
        cursor.execute("SELECT COUNT(*) AS count FROM items WHERE item_type='라디오'")
        result = cursor.fetchone()
        new_count = result['count'] if result else 0

        print("\n" + "=" * 80)
        print("라디오 Import 완료!")
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
    import_radio_data()
