#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
대여이력, 납품이력 데이터 Import 스크립트
"""

import pandas as pd
import re
from datetime import datetime
from database import get_connection

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
            if len(parts) >= 2:
                year = parts[0].strip()
                month = parts[1].strip().zfill(2)
                if len(parts) == 3 and parts[2].strip():
                    day = parts[2].strip().zfill(2)
                else:
                    day = '01'
                return f"{year}-{month}-{day}"
        except (ValueError, IndexError):
            pass

    # 특수한 값들은 None 처리
    if date_str in ['?', '협의필요', '협의중', 'NaN']:
        return None

    return None

def clean_string(value):
    """문자열 정제"""
    if pd.isna(value) or value == '' or value == 'NaN' or value == 'nan':
        return ''
    return str(value).strip()

def import_rental_history():
    """대여이력 import"""
    print("=" * 80)
    print("대여이력 Import 시작")
    print("=" * 80)

    # 1. HTML 파싱
    print("\n[1/4] 대여이력.html 파싱 중...")
    df = pd.read_html('/home/ec2-user/inventory-app/backend/대여이력.html')[0]
    new_header = df.iloc[1]
    df = df[3:]
    df.columns = new_header
    df = df.reset_index(drop=True)
    print(f"   ✓ {len(df)}개 행 파싱 완료")

    # 2. 데이터 정제
    print("\n[2/4] 데이터 정제 중...")
    records = []

    for idx, row in df.iterrows():
        borrower = clean_string(row['업체명'])
        if not borrower:  # 업체명 없으면 건너뛰기
            continue

        item_name = clean_string(row['Product Name'])
        rent_date = parse_date(row['대여일'])
        expected_return = parse_date(row['반납예정일'])
        returned_at = parse_date(row['반납일'])
        serial_ip = clean_string(row.get('Serial / IP', ''))
        quantity = int(row['수량']) if pd.notna(row['수량']) else 1
        note = clean_string(row.get('비고', ''))
        purpose = clean_string(row.get('구분', ''))

        if not rent_date:  # 대여일 없으면 건너뛰기
            continue

        records.append({
            'borrower': borrower,
            'contact_name': '',  # HTML에 없음
            'contact_phone': '',  # HTML에 없음
            'purpose': purpose,
            'item_name': item_name,
            'description': serial_ip,  # Serial/IP를 description에
            'quantity': quantity,
            'rent_date': rent_date,
            'expected_return': expected_return,
            'returned_at': returned_at,
            'note': note
        })

    print(f"   ✓ {len(records)}개 레코드 정제 완료")

    # 3. DB 연결 및 기존 데이터 삭제
    print("\n[3/4] 기존 대여이력 삭제 중...")
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT COUNT(*) AS count FROM rental_history")
        result = cursor.fetchone()
        old_count = result['count'] if result else 0
        print(f"   ℹ 기존 데이터: {old_count}개")

        cursor.execute("DELETE FROM rental_history")
        conn.commit()
        print(f"   ✓ 기존 데이터 삭제 완료")

        # 4. 새 데이터 INSERT
        print("\n[4/4] 새 대여이력 INSERT 중...")

        insert_query = """
        INSERT INTO rental_history
        (borrower, contact_name, contact_phone, purpose, item_name, description,
         quantity, rent_date, expected_return, returned_at, note)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        success_count = 0
        error_count = 0

        for record in records:
            try:
                cursor.execute(insert_query, (
                    record['borrower'],
                    record['contact_name'],
                    record['contact_phone'],
                    record['purpose'],
                    record['item_name'],
                    record['description'],
                    record['quantity'],
                    record['rent_date'],
                    record['expected_return'],
                    record['returned_at'],
                    record['note']
                ))
                success_count += 1
            except Exception as e:
                error_count += 1
                print(f"   ✗ 에러: {e}")

        conn.commit()

        print(f"\n   ✓ 성공: {success_count}개")
        if error_count > 0:
            print(f"   ✗ 실패: {error_count}개")

        cursor.execute("SELECT COUNT(*) AS count FROM rental_history")
        result = cursor.fetchone()
        new_count = result['count'] if result else 0

        print("\n" + "=" * 80)
        print("대여이력 Import 완료!")
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

def import_delivery_history():
    """납품이력 import"""
    print("\n" + "=" * 80)
    print("납품이력 Import 시작")
    print("=" * 80)

    # 1. HTML 파싱
    print("\n[1/4] 납품이력.html 파싱 중...")
    df = pd.read_html('/home/ec2-user/inventory-app/backend/납품이력.html')[0]
    new_header = df.iloc[1]
    df = df[3:]
    df.columns = new_header
    df = df.reset_index(drop=True)
    print(f"   ✓ {len(df)}개 행 파싱 완료")

    # 2. 데이터 정제
    print("\n[2/4] 데이터 정제 중...")
    records = []

    for idx, row in df.iterrows():
        client = clean_string(row['업체명'])
        if not client:  # 업체명 없으면 건너뛰기
            continue

        item_name = clean_string(row['Product Name'])
        delivery_date = parse_date(row['납품완료일'])
        serial_ip = clean_string(row.get('Serial / IP', ''))
        quantity = int(row['수량']) if pd.notna(row['수량']) else 1
        note = clean_string(row.get('비고', ''))
        status = clean_string(row.get('현황', '납품완료'))

        # 납품예정인 경우 날짜가 없을 수 있음
        if not delivery_date and status != '납품예정':
            continue

        # 납품예정이면서 날짜 없으면 임시 날짜 사용
        if not delivery_date:
            delivery_date = '1900-01-01'  # 임시 날짜

        records.append({
            'client': client,
            'contact_name': '',  # HTML에 없음
            'contact_phone': '',  # HTML에 없음
            'project_name': '',  # HTML에 없음
            'item_name': item_name,
            'description': serial_ip,  # Serial/IP는 description에
            'quantity': quantity,
            'unit_price': 0.0,  # HTML에 없음
            'delivery_date': delivery_date,
            'status': status,
            'note': note
        })

    print(f"   ✓ {len(records)}개 레코드 정제 완료")

    # 3. DB 연결 및 기존 데이터 삭제
    print("\n[3/4] 기존 납품이력 삭제 중...")
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT COUNT(*) AS count FROM delivery_history")
        result = cursor.fetchone()
        old_count = result['count'] if result else 0
        print(f"   ℹ 기존 데이터: {old_count}개")

        cursor.execute("DELETE FROM delivery_history")
        conn.commit()
        print(f"   ✓ 기존 데이터 삭제 완료")

        # 4. 새 데이터 INSERT
        print("\n[4/4] 새 납품이력 INSERT 중...")

        insert_query = """
        INSERT INTO delivery_history
        (client, contact_name, contact_phone, project_name, item_name, description,
         quantity, unit_price, delivery_date, status, note)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        success_count = 0
        error_count = 0

        for record in records:
            try:
                cursor.execute(insert_query, (
                    record['client'],
                    record['contact_name'],
                    record['contact_phone'],
                    record['project_name'],
                    record['item_name'],
                    record['description'],
                    record['quantity'],
                    record['unit_price'],
                    record['delivery_date'],
                    record['status'],
                    record['note']
                ))
                success_count += 1
            except Exception as e:
                error_count += 1
                print(f"   ✗ 에러: {e}")

        conn.commit()

        print(f"\n   ✓ 성공: {success_count}개")
        if error_count > 0:
            print(f"   ✗ 실패: {error_count}개")

        cursor.execute("SELECT COUNT(*) AS count FROM delivery_history")
        result = cursor.fetchone()
        new_count = result['count'] if result else 0

        print("\n" + "=" * 80)
        print("납품이력 Import 완료!")
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
    import_rental_history()
    print("\n\n")
    import_delivery_history()
