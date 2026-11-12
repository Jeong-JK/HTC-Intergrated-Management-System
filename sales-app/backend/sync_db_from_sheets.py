#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
구글시트 동기화 데이터로 DB 업데이트
시트 뷰 데이터를 일반 뷰 DB로 동기화
"""

import json
import re
import pymysql
from decimal import Decimal
from collections import defaultdict
from config import DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, CURRENT_YEAR, PROJECT_NO_PATTERN

DB_CONFIG = {
    'host': DB_HOST,
    'user': DB_USER,
    'password': DB_PASSWORD,
    'db': DB_NAME,
    'charset': 'utf8mb4'
}

SHEET_DATA_DIR = '/home/ec2-user/sales-app/backend/sheet_data'


def clean_price(value):
    """가격 문자열에서 숫자만 추출"""
    if not value or str(value).strip() == '':
        return None
    # $, ₩, 쉼표 제거
    cleaned = re.sub(r'[^\d.\-]', '', str(value).replace(',', ''))
    if cleaned == '' or cleaned == '-':
        return None
    try:
        return Decimal(cleaned)
    except:
        return None


def clean_int(value):
    """정수 추출"""
    if not value or str(value).strip() == '':
        return None
    try:
        return int(float(str(value).replace(',', '')))
    except:
        return None


def clean_date(value):
    """날짜 정리 (2026. 1. 21 -> 2026-01-21)"""
    if not value or str(value).strip() == '':
        return None
    cleaned = str(value).strip()
    match = re.match(r'(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})', cleaned)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return None


def detect_currency(price_str):
    """통화 감지"""
    if not price_str:
        return 'USD'
    s = str(price_str)
    if '₩' in s or '원' in s:
        return 'KRW'
    return 'USD'


def sync_purchases_from_sheet():
    """매입 시트 데이터를 DB로 동기화"""
    with open(f'{SHEET_DATA_DIR}/{CURRENT_YEAR}Y_매입.json', 'r', encoding='utf-8') as f:
        sheet_data = json.load(f)

    rows = sheet_data['data']

    # 헤더 행 찾기 (PO가 있는 행)
    header_row_idx = None
    for i, row in enumerate(rows):
        if 'PO' in row:
            header_row_idx = i
            break

    if header_row_idx is None:
        print("헤더 행을 찾을 수 없습니다")
        return

    print(f"헤더 행: {header_row_idx + 1}")
    header = rows[header_row_idx]

    # 컬럼 인덱스 매핑
    col_map = {}
    for i, h in enumerate(header):
        h_lower = h.lower().strip()
        if h == 'PO':
            col_map['po'] = i
        elif h == 'Quote':
            col_map['quote'] = i
        elif h == 'OC':
            col_map['oc'] = i
        elif h == 'Invoice':
            col_map['invoice'] = i
        elif '품의번호' in h:
            col_map['request_number'] = i
        elif h == 'Supplier':
            col_map['supplier'] = i
        elif 'Project' in h:
            col_map['project'] = i
        elif h == 'Products':
            col_map['product_name'] = i
        elif "Q'ty" in h or 'qty' in h_lower:
            col_map['quantity'] = i
        elif 'Net Price' in h:
            col_map['net_price'] = i
        elif h == 'Amount':
            col_map['amount'] = i
        elif 'Expected' in h:
            col_map['expected_date'] = i
        elif '입고' in h:
            col_map['received_status'] = i
        elif '합계금액' in h:
            col_map['total_amount'] = i
        elif '송금현황' in h:
            col_map['payment_status'] = i
        elif '송금일1' in h:
            col_map['payment_date1'] = i
        elif '송금액1' in h:
            col_map['payment_amount1'] = i
        elif '환율1' in h:
            col_map['exchange_rate1'] = i
        elif '송금일2' in h:
            col_map['payment_date2'] = i
        elif '송금액2' in h:
            col_map['payment_amount2'] = i
        elif '환율2' in h:
            col_map['exchange_rate2'] = i

    print(f"컬럼 매핑: {col_map}")

    # 데이터 파싱
    purchases = []
    for i in range(header_row_idx + 1, len(rows)):
        row = rows[i]

        def get_val(key):
            idx = col_map.get(key)
            if idx is None or idx >= len(row):
                return ''
            return row[idx]

        supplier = get_val('supplier').strip()
        product_name = get_val('product_name').strip()

        # 빈 행 스킵
        if not supplier and not product_name:
            continue

        net_price_str = get_val('net_price')
        currency = detect_currency(net_price_str)

        purchase = {
            'year': CURRENT_YEAR,
            'po_number': get_val('po').strip() or None,
            'quote': get_val('quote').strip() or None,
            'oc': get_val('oc').strip() or None,
            'invoice': get_val('invoice').strip() or None,
            'request_number': get_val('request_number').strip() or None,
            'supplier': supplier or None,
            'project': get_val('project').strip() or None,
            'product_name': product_name or None,
            'quantity': clean_int(get_val('quantity')) or 1,
            'net_price': clean_price(get_val('net_price')),
            'currency': currency,
            'amount': clean_price(get_val('amount')),
            'expected_date': clean_date(get_val('expected_date')),
            'received_status': get_val('received_status').strip() or '미입고',
            'payment_date1': clean_date(get_val('payment_date1')),
            'payment_amount1': clean_price(get_val('payment_amount1')),
            'exchange_rate1': clean_price(get_val('exchange_rate1')),
            'payment_date2': clean_date(get_val('payment_date2')),
            'payment_amount2': clean_price(get_val('payment_amount2')),
            'exchange_rate2': clean_price(get_val('exchange_rate2')),
        }

        # supplier나 product_name 둘 중 하나는 있어야 함
        if purchase['supplier'] or purchase['product_name']:
            # product_name이 없으면 빈 문자열로
            if not purchase['product_name']:
                purchase['product_name'] = '-'
            if not purchase['supplier']:
                purchase['supplier'] = '-'
            purchases.append(purchase)

    print(f"파싱된 매입 데이터: {len(purchases)}건")

    # DB 업데이트
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    cols = ['po_number', 'quote', 'oc', 'invoice', 'request_number', 'supplier', 'project', 'product_name', 'quantity',
            'net_price', 'currency', 'amount', 'expected_date', 'received_status', 'payment_date1', 'payment_amount1',
            'exchange_rate1', 'payment_date2', 'payment_amount2', 'exchange_rate2']

    try:
        # 번호(id)를 지키려고 같은 (PO, 품목) 줄은 고쳐 쓰고 시트에 없는 줄만 지움
        # (활동 로그 바로가기/되돌리기 유지, 웹에서만 넣은 막대 메모·프로젝트 연결은 그대로)
        cursor.execute("SELECT id, po_number, product_name FROM purchases WHERE year = %s ORDER BY id", (CURRENT_YEAR,))
        old = defaultdict(list)
        for r in cursor.fetchall():
            old[(r['po_number'], r['product_name'])].append(r['id'])

        insert_count = 0
        for p in purchases:
            ids = old.get((p['po_number'], p['product_name']))
            if ids:
                cursor.execute(f"UPDATE purchases SET {', '.join(c + ' = %s' for c in cols)} WHERE id = %s",
                               [p[c] for c in cols] + [ids.pop(0)])
            else:
                cursor.execute(f"INSERT INTO purchases (year, {', '.join(cols)}) VALUES ({', '.join(['%s'] * (len(cols) + 1))})",
                               [p['year']] + [p[c] for c in cols])
            insert_count += 1
        gone = [i for ids in old.values() for i in ids]
        if gone:
            cursor.execute(f"DELETE FROM purchases WHERE id IN ({','.join(['%s'] * len(gone))})", gone)

        conn.commit()
        print(f"매입 데이터 {insert_count}건 삽입 완료")

    except Exception as e:
        conn.rollback()
        print(f"오류: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    return insert_count


def sync_projects_from_sheet():
    """프로젝트 시트 데이터를 DB로 동기화"""
    with open(f'{SHEET_DATA_DIR}/{CURRENT_YEAR}Y_프로젝트.json', 'r', encoding='utf-8') as f:
        sheet_data = json.load(f)

    rows = sheet_data['data']

    # 헤더 행 찾기 (No, 업체명이 있는 행)
    header_row_idx = None
    for i, row in enumerate(rows):
        if 'No' in row and '업체명' in row:
            header_row_idx = i
            break

    if header_row_idx is None:
        print("헤더 행을 찾을 수 없습니다")
        return

    print(f"헤더 행: {header_row_idx + 1}")
    header = rows[header_row_idx]

    # 컬럼 인덱스 매핑 (헤더 기반)
    # 헤더: No, 업체명, 프로젝트명, 납기요청일, 수주금액, 수금일, 수금액, 수금현황,
    #       품목명(판매), 수량(판매), 단가(판매), 총금액(판매),
    #       공급사, 매입(발주서), 품목명(매입), 수량(매입), 단가($), 단가(₩), 총금액($), 총금액(₩),
    #       Expected Date, 입고여부, 송금현황
    col_map = {
        'no': 1,
        'customer': 2,
        'project_name': 3,
        'delivery_date': 4,
        'order_amount': 5,
        'payment_date': 6,
        'payment_amount': 7,
        'payment_status': 8,
        # 판매 품목
        'sales_product': 9,
        'sales_quantity': 10,
        'sales_unit_price': 11,
        'sales_total_price': 12,
        # 매입 품목
        'purchase_supplier': 13,
        'purchase_po': 14,
        'purchase_product': 15,
        'purchase_quantity': 16,
        'purchase_unit_price_usd': 17,
        'purchase_unit_price_krw': 18,
        'purchase_total_price_usd': 19,
        'purchase_total_price_krw': 20,
        'purchase_expected_date': 21,
        'purchase_received': 22,
        'purchase_payment_status': 23,
    }

    print(f"컬럼 매핑: 고정 인덱스 사용")

    # 데이터 파싱 - 26-XX 형식의 No가 있는 행만
    # 프로젝트 번호별로 그룹핑하여 중복 제거
    project_map = {}  # project_no -> project data (첫 번째 유효한 데이터만)

    for i in range(header_row_idx + 1, len(rows)):
        row = rows[i]

        def get_val(key):
            idx = col_map.get(key)
            if idx is None or idx >= len(row):
                return ''
            return row[idx]

        no_cell = get_val('no').strip()

        # 26-XX 형식인 경우만 처리
        if not re.match('^' + PROJECT_NO_PATTERN, no_cell):
            continue

        # 발주서기준 행 스킵
        if '발주서기준' in str(row):
            continue

        # 프로젝트 번호 추출
        project_no_match = re.match(PROJECT_NO_PATTERN, no_cell.split('\n')[0])
        if not project_no_match:
            continue
        project_no = project_no_match.group(1)

        # 발주일 추출
        order_date = None
        if '\n' in no_cell:
            date_match = re.search(r'\((\d{4}\.\d{2}\.\d{2})\)', no_cell)
            if date_match:
                order_date = date_match.group(1).replace('.', '-')

        # 상태 결정
        status_cell = row[0].strip() if row else ''
        status = '진행중'
        if '완료' in status_cell:
            status = '완료'
        elif '수금필요' in status_cell:
            status = '수금필요'
        elif '납기체크' in status_cell:
            status = '납기체크'

        # 수금현황 퍼센트 추출
        payment_status_str = get_val('payment_status')
        payment_status = None
        if payment_status_str:
            pct_match = re.search(r'(\d+)%', payment_status_str)
            if pct_match:
                payment_status = Decimal(pct_match.group(1)) / 100

        # 현재 행의 수금 정보
        current_payment_date = clean_date(get_val('payment_date'))
        current_payment_amount = clean_price(get_val('payment_amount'))

        project = {
            'year': CURRENT_YEAR,
            'project_no': project_no,
            'customer': get_val('customer').strip().replace('\n', ' ') or None,
            'project_name': get_val('project_name').strip() or None,
            'delivery_date': get_val('delivery_date').strip() or None,
            'order_amount': clean_price(get_val('order_amount')),
            'payment_status': payment_status,
            'status': status,
            'order_date': order_date,
            'payments': [],  # 여러 수금 건을 저장할 배열
            'sales_items': [],  # 판매 품목
            'purchase_items': [],  # 매입 품목
        }

        # 현재 행의 판매 품목 정보
        sales_product = get_val('sales_product').strip()
        sales_quantity = clean_int(get_val('sales_quantity'))
        sales_unit_price = clean_price(get_val('sales_unit_price'))
        sales_total_price = clean_price(get_val('sales_total_price'))

        # 현재 행의 매입 품목 정보
        purchase_supplier = get_val('purchase_supplier').strip()
        purchase_po = get_val('purchase_po').strip()
        purchase_product = get_val('purchase_product').strip()
        purchase_quantity = clean_int(get_val('purchase_quantity'))
        purchase_unit_price_usd = clean_price(get_val('purchase_unit_price_usd'))
        purchase_unit_price_krw = clean_price(get_val('purchase_unit_price_krw'))
        purchase_total_price_usd = clean_price(get_val('purchase_total_price_usd'))
        purchase_total_price_krw = clean_price(get_val('purchase_total_price_krw'))
        purchase_expected_date = get_val('purchase_expected_date').strip()
        purchase_received = get_val('purchase_received').strip()
        purchase_payment_status_str = get_val('purchase_payment_status').strip()
        # 송금현황 퍼센트 추출
        purchase_payment_status = None
        if purchase_payment_status_str:
            pct_match = re.search(r'(\d+)%', purchase_payment_status_str)
            if pct_match:
                purchase_payment_status = Decimal(pct_match.group(1)) / 100

        # customer나 project_name 둘 중 하나는 있어야 함
        if project['customer'] or project['project_name']:
            if not project['customer']:
                project['customer'] = '-'
            if not project['project_name']:
                project['project_name'] = '-'

            # 프로젝트 번호별로 그룹핑 - 첫 번째 유효한 데이터 사용
            if project_no not in project_map:
                # 새 프로젝트 추가
                project_map[project_no] = project
            else:
                # 기존 프로젝트에 NULL인 필드만 업데이트 (병합 셀에서 빈 값인 경우)
                existing = project_map[project_no]
                for key in ['order_amount', 'payment_status', 'order_date', 'delivery_date']:
                    if existing.get(key) is None and project.get(key) is not None:
                        existing[key] = project[key]

            existing_project = project_map[project_no]

            # 판매 품목 추가 (품목명이 있는 경우)
            if sales_product:
                existing_project['sales_items'].append({
                    'product_name': sales_product,
                    'quantity': sales_quantity or 1,
                    'unit_price': sales_unit_price,
                    'total_price': sales_total_price,
                })

            # 매입 품목 추가 (공급사 또는 품목명이 있는 경우)
            if purchase_supplier or purchase_product:
                existing_project['purchase_items'].append({
                    'supplier': purchase_supplier or '-',
                    'po_number': purchase_po or None,
                    'product_name': purchase_product or '-',
                    'quantity': purchase_quantity or 1,
                    'unit_price_usd': purchase_unit_price_usd,
                    'unit_price_krw': purchase_unit_price_krw,
                    'total_price_usd': purchase_total_price_usd,
                    'total_price_krw': purchase_total_price_krw,
                    'expected_date': purchase_expected_date or None,
                    'received_status': '입고완료' if purchase_received else '미입고',
                    'payment_status': purchase_payment_status,
                })

            # 수금 정보가 있으면 payments 배열에 추가 (중복 체크)
            if current_payment_date and current_payment_amount:
                # 이미 같은 날짜/금액의 수금이 없는 경우에만 추가
                is_duplicate = any(
                    p['date'] == current_payment_date and p['amount'] == current_payment_amount
                    for p in existing_project['payments']
                )
                if not is_duplicate:
                    existing_project['payments'].append({
                        'date': current_payment_date,
                        'amount': current_payment_amount
                    })

    # 딕셔너리를 리스트로 변환
    projects = list(project_map.values())
    print(f"파싱된 프로젝트 데이터: {len(projects)}건 (중복 제거 후)")

    # DB 업데이트
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    try:
        # 번호(id)를 지키려고 같은 프로젝트 번호는 고쳐 쓰고, 시트에서 사라진 프로젝트만 지움
        # 웹에서만 넣는 칸(공급사, 비고, 매입 품목의 환율·실제 발주일)은 그대로 둠
        cursor.execute("SELECT id, project_no FROM projects WHERE year = %s", (CURRENT_YEAR,))
        old = {r['project_no']: r['id'] for r in cursor.fetchall()}
        keep_pi = defaultdict(list)
        if old:
            ph = ','.join(['%s'] * len(old))
            cursor.execute(f"SELECT project_id, po_number, product_name, exchange_rate, actual_order_date FROM purchase_items "
                           f"WHERE project_id IN ({ph}) ORDER BY id", list(old.values()))
            for r in cursor.fetchall():
                keep_pi[(r['project_id'], r['po_number'], r['product_name'])].append(r)

        # 새 데이터 삽입
        insert_count = 0
        payment_count = 0
        for p in projects:
            # 첫 번째 수금 정보 (projects 테이블 호환용)
            first_payment_date = p['payments'][0]['date'] if p['payments'] else None
            first_payment_amount = p['payments'][0]['amount'] if p['payments'] else None
            # 총 수금액 계산
            total_payment_amount = sum(pay['amount'] for pay in p['payments']) if p['payments'] else None

            values = (p['customer'], p['project_name'], p['delivery_date'], p['order_amount'], first_payment_date,
                      total_payment_amount, p['payment_status'], p['status'], p['order_date'])
            project_id = old.pop(p['project_no'], None)
            if project_id:
                cursor.execute("""UPDATE projects SET customer = %s, project_name = %s, delivery_date = %s, order_amount = %s,
                                  payment_date = %s, payment_amount = %s, payment_status = %s, status = %s, order_date = %s
                                  WHERE id = %s""", values + (project_id,))
                for t in ('project_payments', 'sales_items', 'purchase_items'):  # 딸린 줄은 시트 기준으로 다시
                    cursor.execute(f"DELETE FROM {t} WHERE project_id = %s", (project_id,))
            else:
                cursor.execute("""INSERT INTO projects (year, project_no, customer, project_name, delivery_date, order_amount,
                                  payment_date, payment_amount, payment_status, status, order_date)
                                  VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""", (p['year'], p['project_no']) + values)
                project_id = cursor.lastrowid
            insert_count += 1

            # project_payments 테이블에 모든 수금 정보 삽입
            for payment in p['payments']:
                cursor.execute("""
                    INSERT INTO project_payments (project_id, payment_date, payment_amount)
                    VALUES (%s, %s, %s)
                """, (project_id, payment['date'], payment['amount']))
                payment_count += 1

            # sales_items 테이블에 판매 품목 삽입
            for idx, item in enumerate(p['sales_items']):
                cursor.execute("""
                    INSERT INTO sales_items (project_id, product_name, quantity, unit_price, total_price, row_index)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (project_id, item['product_name'], item['quantity'],
                      item['unit_price'], item['total_price'], idx))

            # purchase_items 테이블에 매입 품목 삽입
            for idx, item in enumerate(p['purchase_items']):
                kept = keep_pi.get((project_id, item['po_number'], item['product_name'])) or [{}]
                prev = kept.pop(0) if kept[0] else {}
                cursor.execute("""
                    INSERT INTO purchase_items (project_id, po_number, supplier, product_name, quantity,
                        unit_price_usd, unit_price_krw, total_price_usd, total_price_krw,
                        expected_date, received_status, payment_status, row_index, exchange_rate, actual_order_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (project_id, item['po_number'], item['supplier'], item['product_name'],
                      item['quantity'], item['unit_price_usd'], item['unit_price_krw'],
                      item['total_price_usd'], item['total_price_krw'], item['expected_date'],
                      item['received_status'], item['payment_status'], idx,
                      prev.get('exchange_rate'), prev.get('actual_order_date')))

        # 시트에서 사라진 프로젝트
        gone = list(old.values())
        if gone:
            ph = ','.join(['%s'] * len(gone))
            for t in ('project_payments', 'sales_items', 'purchase_items'):
                cursor.execute(f"DELETE FROM {t} WHERE project_id IN ({ph})", gone)
            cursor.execute(f"DELETE FROM projects WHERE id IN ({ph})", gone)

        # 총 품목 수 계산
        total_sales = sum(len(p['sales_items']) for p in projects)
        total_purchases = sum(len(p['purchase_items']) for p in projects)

        conn.commit()
        print(f"프로젝트 데이터 {insert_count}건 삽입 완료")
        print(f"수금 데이터 {payment_count}건 삽입 완료")
        print(f"판매 품목 {total_sales}건 삽입 완료")
        print(f"매입 품목 {total_purchases}건 삽입 완료")

    except Exception as e:
        conn.rollback()
        print(f"오류: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    return insert_count


def date_to_week_key(date_str):
    """날짜를 월_주차 형식으로 변환 (예: 2026-01-15 -> 1_3)"""
    if not date_str:
        return None
    try:
        # 다양한 형식 처리
        if isinstance(date_str, str):
            # "2026-01-15" 또는 "ESD.01.15" 또는 "01.15" 형식
            cleaned = date_str.replace('ESD.', '').replace('ESD', '').strip()

            if '-' in cleaned and len(cleaned) >= 10:
                # 2026-01-15 형식
                parts = cleaned.split('-')
                month = int(parts[1])
                day = int(parts[2][:2])
            elif '.' in cleaned:
                # 01.15 또는 2026.01.15 형식
                parts = cleaned.split('.')
                if len(parts) >= 3 and len(parts[0]) == 4:
                    # 2026.01.15
                    month = int(parts[1])
                    day = int(parts[2][:2])
                elif len(parts) >= 2:
                    # 01.15
                    month = int(parts[0])
                    day = int(parts[1][:2])
                else:
                    return None
            elif '/' in cleaned:
                # 1/15 형식
                parts = cleaned.split('/')
                month = int(parts[0])
                day = int(parts[1][:2]) if len(parts) > 1 else 1
            else:
                return None

            # 주차 계산 (1-7일: 1주차, 8-14일: 2주차, ...)
            week = (day - 1) // 7 + 1
            if week > 5:
                week = 5
            return f"{month}_{week}"
    except:
        pass
    return None


def sync_weekly_from_sheet():
    """위클리 시트 데이터를 DB로 동기화"""
    with open(f'{SHEET_DATA_DIR}/{CURRENT_YEAR}Y_Weekly.json', 'r', encoding='utf-8') as f:
        sheet_data = json.load(f)

    rows = sheet_data['data']

    # 헤더 구조:
    # Row 0: 범례 (스킵)
    # Row 1: Pipeline No, 업체(프로젝트), 품목, 수량, 년도, 2026년...
    # Row 2: 월 정보
    # Row 3: 주차 정보
    # Row 4+: 실제 데이터
    # 주의: 컬럼 5-13은 비어있고, 실제 주차 데이터는 컬럼 14부터 시작

    if len(rows) < 5:
        print("헤더가 충분하지 않습니다")
        return 0

    months_row = rows[2]
    weeks_row = rows[3]

    # 프로젝트별 발주일 조회
    conn_temp = pymysql.connect(**DB_CONFIG)
    cursor_temp = conn_temp.cursor(pymysql.cursors.DictCursor)
    cursor_temp.execute("SELECT project_no, order_date FROM projects WHERE year = %s", (CURRENT_YEAR,))
    project_order_dates = {row['project_no']: row['order_date'] for row in cursor_temp.fetchall()}
    cursor_temp.close()
    conn_temp.close()
    print(f"프로젝트 발주일 로드: {len(project_order_dates)}건")

    # 주차 매핑 생성 (컬럼 인덱스 -> "월_주차" 형식) - 프론트엔드와 일치
    # 컬럼 14부터 시작 (5-13은 빈 컬럼)
    week_columns = {}
    for i in range(14, len(weeks_row)):
        month = months_row[i] if i < len(months_row) else ''
        week = weeks_row[i] if i < len(weeks_row) else ''
        if month and week and month.isdigit() and week.isdigit():
            week_columns[i] = f"{month}_{week}"  # e.g., "1_1", "1_2", "2_1"

    print(f"주차 컬럼 수: {len(week_columns)}")

    # 데이터 파싱
    weekly_items = []
    current_project_no = None
    current_customer_project = None

    for i in range(4, len(rows)):
        row = rows[i]

        # 값 추출
        project_no_cell = row[0].strip() if len(row) > 0 else ''
        customer_project_cell = row[1].strip() if len(row) > 1 else ''
        product_name = row[2].strip() if len(row) > 2 else ''
        quantity_cell = row[3] if len(row) > 3 else ''
        supplier = row[4].strip() if len(row) > 4 else ''

        # 프로젝트 번호 (병합 셀 고려)
        if project_no_cell:
            # 26-XX 형식만 추출
            match = re.match(PROJECT_NO_PATTERN, project_no_cell.split('\n')[0])
            if match:
                current_project_no = match.group(1)

        # 업체(프로젝트) (병합 셀 고려)
        if customer_project_cell:
            current_customer_project = customer_project_cell

        # 프로젝트 번호가 없거나 품목이 없으면 스킵
        if not current_project_no:
            continue

        # 빈 행 체크
        if not product_name and not supplier:
            continue

        # 수량 파싱
        quantity = clean_int(quantity_cell) or 1

        # 시트에서 ESD/입고 날짜 찾기 (가장 마지막 값이 있는 주차를 종료점으로)
        original_values = {}  # 원본 셀 값 저장
        max_week_key = None  # 가장 마지막 주차
        for col_idx, week_key in week_columns.items():
            if col_idx < len(row) and row[col_idx]:
                cell_value = row[col_idx].strip()
                if cell_value:
                    original_values[week_key] = cell_value
                    # 값이 있는 가장 마지막 주차 저장
                    if max_week_key is None:
                        max_week_key = week_key
                    else:
                        # 주차 비교 (예: 5_2 > 3_4)
                        cur_m, cur_w = map(int, week_key.split('_'))
                        max_m, max_w = map(int, max_week_key.split('_'))
                        if (cur_m > max_m) or (cur_m == max_m and cur_w > max_w):
                            max_week_key = week_key

        # 발주일에서 시작 주차 계산
        order_date = project_order_dates.get(current_project_no)
        start_week_key = None
        if order_date:
            start_week_key = date_to_week_key(str(order_date))

        # week_data 생성: 발주일 ~ 마지막 입력값 주차까지 모든 주차 채우기
        week_data = {}
        if start_week_key:
            # 종료 주차 결정: max_week_key가 있으면 사용, 없으면 발주일 + 21주
            if max_week_key:
                end_week_key = max_week_key
            else:
                # 예상 배송일이 없으면 발주일 + 21주
                start_m, start_w = map(int, start_week_key.split('_'))
                m, w = start_m, start_w
                # 21주 더하기
                for _ in range(21):
                    w += 1
                    if w > 5:
                        w = 1
                        m += 1
                    if m > 12:
                        m = 12
                        w = 5
                        break
                end_week_key = f"{m}_{w}"

            # 시작/종료 주차 파싱
            start_m, start_w = map(int, start_week_key.split('_'))
            end_m, end_w = map(int, end_week_key.split('_'))

            # 시작부터 끝까지 모든 주차 채우기
            m, w = start_m, start_w
            iterations = 0
            while iterations < 100:  # 무한루프 방지
                iterations += 1
                key = f"{m}_{w}"
                # 원본 값이 있으면 사용, 없으면 'bar' 표시
                week_data[key] = original_values.get(key, 'bar')

                # 종료 조건: 현재가 끝 주차이면 중단
                if m == end_m and w == end_w:
                    break

                # 다음 주차로
                w += 1
                if w > 5:  # 최대 5주차
                    w = 1
                    m += 1
                if m > 12:  # 12월 넘어가면 중단
                    break
        elif original_values:
            # 발주일이 없으면 원본 값만 사용
            week_data = original_values

        weekly_item = {
            'year': CURRENT_YEAR,
            'project_no': current_project_no,
            'customer_project': current_customer_project or '-',
            'product_name': product_name or '-',
            'quantity': quantity,
            'supplier': supplier or None,
            'notes': None,
            'week_data': json.dumps(week_data, ensure_ascii=False) if week_data else None,
        }

        weekly_items.append(weekly_item)

    print(f"파싱된 위클리 데이터: {len(weekly_items)}건")

    # DB 업데이트
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    try:
        # 번호(id) 유지: 같은 (프로젝트 번호, 품목) 줄은 고쳐 쓰고 시트에 없는 줄만 지움
        # 웹에서 넣은 메모(비고·막대·첫 주)와 웹에서 옮긴 주차 표시는 지킴 (주간 일정은 웹 → 시트로 보내는 기능이 없음)
        cursor.execute("SELECT id, project_no, product_name, week_data FROM weekly_schedule WHERE year = %s ORDER BY id", (CURRENT_YEAR,))
        old = defaultdict(list)
        for r in cursor.fetchall():
            old[(r['project_no'], r['product_name'])].append(r)

        insert_count = 0
        for w in weekly_items:
            rows = old.get((w['project_no'], w['product_name']))
            if rows:
                r = rows.pop(0)
                cursor.execute("""UPDATE weekly_schedule SET customer_project = %s, quantity = %s, supplier = %s, week_data = %s
                                  WHERE id = %s""", (w['customer_project'], w['quantity'], w['supplier'],
                                                     r['week_data'] or w['week_data'], r['id']))
            else:
                cursor.execute("""INSERT INTO weekly_schedule (year, project_no, customer_project, product_name,
                                  quantity, supplier, notes, week_data) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                               (w['year'], w['project_no'], w['customer_project'], w['product_name'],
                                w['quantity'], w['supplier'], w['notes'], w['week_data']))
            insert_count += 1
        gone = [r['id'] for rows in old.values() for r in rows]
        if gone:
            cursor.execute(f"DELETE FROM weekly_schedule WHERE id IN ({','.join(['%s'] * len(gone))})", gone)

        conn.commit()
        print(f"위클리 데이터 {insert_count}건 삽입 완료")

    except Exception as e:
        conn.rollback()
        print(f"오류: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    return insert_count


if __name__ == '__main__':
    print("=" * 60)
    print("구글시트 데이터 → DB 동기화")
    print("=" * 60)

    print("\n[1/3] 매입 데이터")
    purchase_count = sync_purchases_from_sheet()

    print("\n[2/3] 프로젝트 데이터")
    project_count = sync_projects_from_sheet()

    print("\n[3/3] 위클리 데이터")
    weekly_count = sync_weekly_from_sheet()

    print("\n" + "=" * 60)
    print("동기화 완료!")
    print(f"- 매입: {purchase_count}건")
    print(f"- 프로젝트: {project_count}건")
    print(f"- 위클리: {weekly_count}건")
    print("=" * 60)
