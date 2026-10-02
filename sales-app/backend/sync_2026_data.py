#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2026Y 매입/프로젝트 데이터 동기화 스크립트
관리자 드라이브의 CSV 파일과 DB를 동기화합니다.
"""

import csv
import re
import pymysql
from decimal import Decimal
from config import DB_HOST, DB_USER, DB_PASSWORD, DB_NAME

# DB 연결 설정
DB_CONFIG = {
    'host': DB_HOST,
    'user': DB_USER,
    'password': DB_PASSWORD,
    'db': DB_NAME,
    'charset': 'utf8mb4'
}

PURCHASE_CSV = '/home/ec2-user/inventory-app/backend/uploads/admin_drive/통신사업팀 Sales Pipeline - 2026Y 매입 (1).csv'
PROJECT_CSV = '/home/ec2-user/inventory-app/backend/uploads/admin_drive/통신사업팀 Sales Pipeline - 2026Y 프로젝트 (1).csv'

def clean_price(value):
    """가격 문자열에서 숫자만 추출"""
    if not value or value.strip() == '':
        return None
    # 쉼표, 통화기호 제거
    cleaned = re.sub(r'[^\d.\-]', '', str(value).replace(',', ''))
    if cleaned == '' or cleaned == '-':
        return None
    try:
        return Decimal(cleaned)
    except:
        return None

def clean_quantity(value):
    """수량 문자열에서 정수만 추출"""
    if not value or value.strip() == '':
        return None
    try:
        return int(float(value))
    except:
        return None

def clean_string(value):
    """문자열 정리"""
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned if cleaned else None

def clean_date(value):
    """날짜 문자열 정리"""
    if not value or value.strip() == '':
        return None
    # 날짜 포맷 정리 (2026. 1. 21 -> 2026-01-21)
    cleaned = str(value).strip()
    # 다양한 형식 처리
    match = re.match(r'(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})', cleaned)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return cleaned

def detect_currency(price_str):
    """통화 감지"""
    if not price_str:
        return 'USD'
    if '₩' in str(price_str) or '원' in str(price_str):
        return 'KRW'
    return 'USD'

def parse_purchase_csv():
    """매입 CSV 파싱"""
    purchases = []

    with open(PURCHASE_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)

    # 헤더 행 찾기 (PO가 있는 행)
    header_row = None
    for i, row in enumerate(rows):
        if len(row) > 1 and 'PO' in row:
            header_row = i
            break

    if header_row is None:
        print("헤더 행을 찾을 수 없습니다.")
        return []

    # 컬럼 인덱스
    headers = rows[header_row]
    col_indices = {
        'po': 1,        # PO
        'quote': 2,     # Quote
        'oc': 3,        # OC
        'invoice': 4,   # Invoice
        'request_number': 5,  # 품의번호
        'supplier': 6,  # Supplier
        'project': 7,   # Project
        'product_name': 8,  # Products
        'quantity': 9,  # Q'ty
        'net_price': 10, # Net Price
        'amount': 11,   # Amount
        'expected_date': 12,  # Expected Date
        'received_status': 13, # 입고여부
        'total_amount': 14,  # 합계금액
        'payment_status': 15,  # 송금현황
        'payment_date1': 16,  # 송금일1
        'payment_amount1': 17, # 송금액1
        'exchange_rate1': 18,  # 환율1
        'payment_date2': 19,  # 송금일2
        'payment_amount2': 20, # 송금액2
        'exchange_rate2': 21,  # 환율2
        'avg_exchange_rate': 22,  # 평균환율
    }

    # 데이터 행 파싱
    for i in range(header_row + 1, len(rows)):
        row = rows[i]
        if len(row) < 9:  # 최소 필수 컬럼 확인
            continue

        # PO가 없고 품목명도 없으면 스킵
        po = clean_string(row[col_indices['po']] if len(row) > col_indices['po'] else None)
        product_name = clean_string(row[col_indices['product_name']] if len(row) > col_indices['product_name'] else None)
        supplier = clean_string(row[col_indices['supplier']] if len(row) > col_indices['supplier'] else None)

        if not product_name and not supplier:
            continue

        # 가격에서 통화 감지
        net_price_str = row[col_indices['net_price']] if len(row) > col_indices['net_price'] else ''
        currency = detect_currency(net_price_str)

        purchase = {
            'year': 2026,
            'po_number': po,
            'quote': clean_string(row[col_indices['quote']] if len(row) > col_indices['quote'] else None),
            'oc': clean_string(row[col_indices['oc']] if len(row) > col_indices['oc'] else None),
            'invoice': clean_string(row[col_indices['invoice']] if len(row) > col_indices['invoice'] else None),
            'request_number': clean_string(row[col_indices['request_number']] if len(row) > col_indices['request_number'] else None),
            'supplier': supplier,
            'project': clean_string(row[col_indices['project']] if len(row) > col_indices['project'] else None),
            'product_name': product_name,
            'quantity': clean_quantity(row[col_indices['quantity']] if len(row) > col_indices['quantity'] else None),
            'net_price': clean_price(row[col_indices['net_price']] if len(row) > col_indices['net_price'] else None),
            'currency': currency,
            'amount': clean_price(row[col_indices['amount']] if len(row) > col_indices['amount'] else None),
            'expected_date': clean_date(row[col_indices['expected_date']] if len(row) > col_indices['expected_date'] else None),
            'received_status': clean_string(row[col_indices['received_status']] if len(row) > col_indices['received_status'] else None),
            'payment_date1': clean_date(row[col_indices['payment_date1']] if len(row) > col_indices['payment_date1'] else None),
            'payment_amount1': clean_price(row[col_indices['payment_amount1']] if len(row) > col_indices['payment_amount1'] else None),
            'exchange_rate1': clean_price(row[col_indices['exchange_rate1']] if len(row) > col_indices['exchange_rate1'] else None),
            'payment_date2': clean_date(row[col_indices['payment_date2']] if len(row) > col_indices['payment_date2'] else None),
            'payment_amount2': clean_price(row[col_indices['payment_amount2']] if len(row) > col_indices['payment_amount2'] else None),
            'exchange_rate2': clean_price(row[col_indices['exchange_rate2']] if len(row) > col_indices['exchange_rate2'] else None),
        }

        # 필수 필드 확인 - supplier와 product_name 모두 있어야 함
        if purchase['supplier'] and purchase['product_name']:
            purchases.append(purchase)
        elif purchase['supplier'] and not purchase['product_name']:
            # supplier만 있는 경우 product_name을 빈 문자열로 설정
            purchase['product_name'] = ''
            purchases.append(purchase)

    return purchases

def parse_project_csv():
    """프로젝트 CSV 파싱"""
    projects = []

    with open(PROJECT_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)

    # 데이터 행 찾기 (No, 업체명 등이 있는 행)
    header_row = None
    for i, row in enumerate(rows):
        if len(row) > 2 and 'No' in row and '업체명' in row:
            header_row = i
            break

    if header_row is None:
        print("헤더 행을 찾을 수 없습니다.")
        return []

    # 컬럼 인덱스
    col_indices = {
        'status': 0,  # 완료, 수금필요 등
        'no': 1,      # No (26-01 형식)
        'customer': 2,  # 업체명
        'project_name': 3,  # 프로젝트명
        'delivery_date': 4,  # 납기요청일
        'order_amount': 5,  # 수주금액
        'payment_date': 6,  # 수금일
        'payment_amount': 7,  # 수금액
        'payment_status': 8,  # 수금현황
    }

    # 데이터 행 파싱
    current_project = None
    for i in range(header_row + 1, len(rows)):
        row = rows[i]
        if len(row) < 4:
            continue

        status_cell = clean_string(row[0]) if len(row) > 0 else None
        no_cell = clean_string(row[1]) if len(row) > 1 else None
        customer = clean_string(row[2]) if len(row) > 2 else None
        project_name = clean_string(row[3]) if len(row) > 3 else None

        # 새 프로젝트 행 (No가 26-XX 형식이면)
        if no_cell and re.match(r'^26-\d+', no_cell):
            # 발주서 기준 행은 스킵
            if '발주서기준' in str(row):
                continue

            # 26-XX 형식에서 날짜 부분 제거
            project_no = no_cell.split('\n')[0].strip() if '\n' in no_cell else no_cell.strip()
            project_no_match = re.match(r'(26-\d+)', project_no)
            if project_no_match:
                project_no = project_no_match.group(1)

            # 발주일 추출 (26-01\n(2026.01.01) 형식에서)
            order_date = None
            if '\n' in no_cell:
                date_match = re.search(r'\((\d{4}\.\d{2}\.\d{2})\)', no_cell)
                if date_match:
                    order_date = date_match.group(1)

            # 수금현황에서 비율 추출
            payment_status_str = clean_string(row[8]) if len(row) > 8 else None
            payment_status = None
            if payment_status_str:
                pct_match = re.search(r'(\d+)%', payment_status_str)
                if pct_match:
                    payment_status = Decimal(pct_match.group(1)) / 100

            # 상태 결정
            status = '진행중'
            if status_cell:
                if '완료' in status_cell:
                    status = '완료'
                elif '수금필요' in status_cell:
                    status = '수금필요'
                elif '납기체크' in status_cell:
                    status = '납기체크'

            current_project = {
                'year': 2026,
                'project_no': project_no,
                'customer': customer,
                'project_name': project_name,
                'delivery_date': clean_string(row[4]) if len(row) > 4 else None,
                'order_amount': clean_price(row[5]) if len(row) > 5 else None,
                'payment_date': clean_date(row[6]) if len(row) > 6 else None,
                'payment_amount': clean_price(row[7]) if len(row) > 7 else None,
                'payment_status': payment_status,
                'status': status,
                'order_date': order_date,
            }
            projects.append(current_project)

    return projects

def sync_purchases():
    """매입 데이터 동기화"""
    purchases = parse_purchase_csv()
    print(f"CSV에서 {len(purchases)}개의 매입 데이터를 파싱했습니다.")

    # 데이터 검증
    for i, p in enumerate(purchases):
        if not p['product_name']:
            p['product_name'] = '-'
        if not p['supplier']:
            p['supplier'] = '-'

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # 기존 2026년 데이터 삭제
        cursor.execute("DELETE FROM purchases WHERE year = 2026")
        print(f"기존 2026년 매입 데이터 삭제 완료")

        # 새 데이터 삽입
        insert_count = 0
        for p in purchases:
            sql = """
                INSERT INTO purchases (
                    year, po_number, quote, oc, invoice, request_number,
                    supplier, project, product_name, quantity, net_price,
                    currency, amount, expected_date, received_status,
                    payment_date1, payment_amount1, exchange_rate1,
                    payment_date2, payment_amount2, exchange_rate2
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """
            cursor.execute(sql, (
                p['year'], p['po_number'], p['quote'], p['oc'], p['invoice'],
                p['request_number'], p['supplier'], p['project'], p['product_name'],
                p['quantity'], p['net_price'], p['currency'], p['amount'],
                p['expected_date'], p['received_status'], p['payment_date1'],
                p['payment_amount1'], p['exchange_rate1'], p['payment_date2'],
                p['payment_amount2'], p['exchange_rate2']
            ))
            insert_count += 1

        conn.commit()
        print(f"매입 데이터 {insert_count}건 삽입 완료")

    except Exception as e:
        conn.rollback()
        print(f"오류 발생: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    return insert_count

def sync_projects():
    """프로젝트 데이터 동기화"""
    projects = parse_project_csv()
    print(f"CSV에서 {len(projects)}개의 프로젝트 데이터를 파싱했습니다.")

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        # 기존 2026년 데이터 삭제
        cursor.execute("DELETE FROM projects WHERE year = 2026")
        print(f"기존 2026년 프로젝트 데이터 삭제 완료")

        # 새 데이터 삽입
        insert_count = 0
        for p in projects:
            sql = """
                INSERT INTO projects (
                    year, project_no, customer, project_name, delivery_date,
                    order_amount, payment_date, payment_amount, payment_status,
                    status, order_date
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """
            cursor.execute(sql, (
                p['year'], p['project_no'], p['customer'], p['project_name'],
                p['delivery_date'], p['order_amount'], p['payment_date'],
                p['payment_amount'], p['payment_status'], p['status'],
                p['order_date']
            ))
            insert_count += 1

        conn.commit()
        print(f"프로젝트 데이터 {insert_count}건 삽입 완료")

    except Exception as e:
        conn.rollback()
        print(f"오류 발생: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    return insert_count

if __name__ == '__main__':
    print("=" * 60)
    print("2026Y 매입/프로젝트 데이터 동기화 시작")
    print("=" * 60)

    print("\n[1/2] 매입 데이터 동기화")
    purchase_count = sync_purchases()

    print("\n[2/2] 프로젝트 데이터 동기화")
    project_count = sync_projects()

    print("\n" + "=" * 60)
    print("동기화 완료!")
    print(f"- 매입: {purchase_count}건")
    print(f"- 프로젝트: {project_count}건")
    print("=" * 60)
