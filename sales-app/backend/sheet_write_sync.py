#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DB → Google Sheets 동기화 모듈
웹에서 수정한 내용을 구글 시트에 반영
"""

import gspread
import re
from google_sheets_sync import get_spreadsheet

# 시트 이름
SHEET_PURCHASES = '2026Y 매입'
SHEET_PROJECTS = '2026Y 프로젝트'


def find_purchase_row(sheet, po_number, product_name):
    """매입 시트에서 PO번호 + 품목명으로 행 찾기

    Returns:
        (row_index, col_map) or (None, None) - row_index는 1-based
    """
    try:
        all_values = sheet.get_all_values()

        # 헤더 행 찾기 (PO가 있는 행)
        header_row_idx = None
        header = None
        for i, row in enumerate(all_values):
            if 'PO' in row:
                header_row_idx = i
                header = row
                break

        if header_row_idx is None:
            return None, None

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

        # 데이터 행에서 검색 (header_row_idx + 1부터)
        po_col = col_map.get('po')
        product_col = col_map.get('product_name')

        if po_col is None or product_col is None:
            return None, None

        for i in range(header_row_idx + 1, len(all_values)):
            row = all_values[i]
            if len(row) <= max(po_col, product_col):
                continue

            row_po = row[po_col].strip() if po_col < len(row) else ''
            row_product = row[product_col].strip() if product_col < len(row) else ''

            # PO번호와 품목명이 일치하면 찾음
            if row_po == po_number and row_product == product_name:
                # Google Sheets는 1-indexed
                return i + 1, col_map

        return None, col_map

    except Exception as e:
        print(f"find_purchase_row error: {e}")
        return None, None


def find_project_row(sheet, project_no):
    """프로젝트 시트에서 프로젝트 번호로 행 찾기

    Returns:
        (row_index, col_map) or (None, None) - row_index는 1-based
    """
    try:
        all_values = sheet.get_all_values()

        # 헤더 행 찾기 (No, 업체명이 있는 행)
        header_row_idx = None
        for i, row in enumerate(all_values):
            if 'No' in row and '업체명' in row:
                header_row_idx = i
                break

        if header_row_idx is None:
            return None, None

        # 고정 컬럼 매핑
        col_map = {
            'status': 0,
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

        # 데이터 행에서 검색
        no_col = col_map['no']

        for i in range(header_row_idx + 1, len(all_values)):
            row = all_values[i]
            if len(row) <= no_col:
                continue

            no_cell = row[no_col].strip() if no_col < len(row) else ''

            # 26-XX 형식의 프로젝트 번호 추출
            match = re.match(r'(26-\d+)', no_cell.split('\n')[0])
            if match and match.group(1) == project_no:
                return i + 1, col_map

        return None, col_map

    except Exception as e:
        print(f"find_project_row error: {e}")
        return None, None


def update_purchase_in_sheet(purchase_id, updated_data, current_data):
    """매입 데이터를 구글 시트에 업데이트

    Args:
        purchase_id: 매입 ID
        updated_data: 수정된 필드들 (dict)
        current_data: 현재 DB 데이터 (PO번호, 품목명 등 조회용)

    Returns:
        bool: 성공 여부
    """
    try:
        po_number = current_data.get('po_number', '')
        product_name = current_data.get('product_name', '')

        if not po_number or not product_name:
            print(f"Cannot find row: PO={po_number}, Product={product_name}")
            return False

        spreadsheet = get_spreadsheet()
        sheet = spreadsheet.worksheet(SHEET_PURCHASES)

        row_idx, col_map = find_purchase_row(sheet, po_number, product_name)

        if row_idx is None:
            print(f"Row not found: PO={po_number}, Product={product_name}")
            return False

        # 필드 매핑 (DB 필드 -> 시트 컬럼)
        field_to_col = {
            'po_number': 'po',
            'quote': 'quote',
            'oc': 'oc',
            'invoice': 'invoice',
            'request_number': 'request_number',
            'supplier': 'supplier',
            'project': 'project',
            'product_name': 'product_name',
            'quantity': 'quantity',
            'net_price': 'net_price',
            'amount': 'amount',
            'expected_date': 'expected_date',
            'received_status': 'received_status',
            'payment_date1': 'payment_date1',
            'payment_amount1': 'payment_amount1',
            'exchange_rate1': 'exchange_rate1',
            'payment_date2': 'payment_date2',
            'payment_amount2': 'payment_amount2',
            'exchange_rate2': 'exchange_rate2',
        }

        # 수정할 셀들 업데이트
        cells_to_update = []
        for db_field, value in updated_data.items():
            col_name = field_to_col.get(db_field)
            if col_name and col_name in col_map:
                col_idx = col_map[col_name] + 1  # 1-indexed
                # 날짜 형식 변환 (2026-01-15 -> 2026. 1. 15)
                if 'date' in db_field and value:
                    value = format_date_for_sheet(value)
                cells_to_update.append({
                    'row': row_idx,
                    'col': col_idx,
                    'value': value if value is not None else ''
                })

        # 배치 업데이트
        for cell in cells_to_update:
            sheet.update_cell(cell['row'], cell['col'], cell['value'])

        print(f"Updated {len(cells_to_update)} cells in sheet for purchase {purchase_id}")
        return True

    except Exception as e:
        print(f"update_purchase_in_sheet error: {e}")
        return False


def update_project_in_sheet(project_id, updated_data, current_data):
    """프로젝트 데이터를 구글 시트에 업데이트

    Args:
        project_id: 프로젝트 ID
        updated_data: 수정된 필드들 (dict)
        current_data: 현재 DB 데이터 (프로젝트 번호 등 조회용)

    Returns:
        bool: 성공 여부
    """
    try:
        project_no = current_data.get('project_no', '')

        if not project_no:
            print(f"Cannot find row: project_no={project_no}")
            return False

        spreadsheet = get_spreadsheet()
        sheet = spreadsheet.worksheet(SHEET_PROJECTS)

        row_idx, col_map = find_project_row(sheet, project_no)

        if row_idx is None:
            print(f"Row not found: project_no={project_no}")
            return False

        # 필드 매핑 (DB 필드 -> 시트 컬럼)
        field_to_col = {
            'customer': 'customer',
            'project_name': 'project_name',
            'delivery_date': 'delivery_date',
            'order_amount': 'order_amount',
            'payment_date': 'payment_date',
            'payment_amount': 'payment_amount',
            'status': 'status',
        }

        # 수정할 셀들 업데이트
        cells_to_update = []
        for db_field, value in updated_data.items():
            col_name = field_to_col.get(db_field)
            if col_name and col_name in col_map:
                col_idx = col_map[col_name] + 1  # 1-indexed
                # 날짜 형식 변환
                if 'date' in db_field and value:
                    value = format_date_for_sheet(value)
                # 금액 형식 변환
                if 'amount' in db_field and value:
                    value = format_amount_for_sheet(value)
                cells_to_update.append({
                    'row': row_idx,
                    'col': col_idx,
                    'value': value if value is not None else ''
                })

        # 배치 업데이트
        for cell in cells_to_update:
            sheet.update_cell(cell['row'], cell['col'], cell['value'])

        print(f"Updated {len(cells_to_update)} cells in sheet for project {project_id}")
        return True

    except Exception as e:
        print(f"update_project_in_sheet error: {e}")
        return False


def format_date_for_sheet(date_str):
    """날짜를 시트 형식으로 변환 (2026-01-15 -> 2026. 1. 15)"""
    if not date_str:
        return ''
    try:
        if isinstance(date_str, str) and '-' in date_str:
            parts = date_str.split('-')
            if len(parts) == 3:
                year, month, day = parts
                return f"{year}. {int(month)}. {int(day)}"
        return str(date_str)
    except:
        return str(date_str)


def format_amount_for_sheet(amount):
    """금액을 시트 형식으로 변환"""
    if amount is None:
        return ''
    try:
        # 정수면 쉼표 추가
        if isinstance(amount, (int, float)):
            if amount == int(amount):
                return f"{int(amount):,}"
            return f"{amount:,.2f}"
        return str(amount)
    except:
        return str(amount)


# 동기 비활성화 플래그 (시트 동기화 중 무한 루프 방지)
_sync_enabled = True


def disable_sheet_sync():
    """시트 동기화 비활성화"""
    global _sync_enabled
    _sync_enabled = False


def enable_sheet_sync():
    """시트 동기화 활성화"""
    global _sync_enabled
    _sync_enabled = True


def is_sheet_sync_enabled():
    """시트 동기화 활성화 여부"""
    return _sync_enabled


if __name__ == '__main__':
    # 테스트
    print("Sheet Write Sync Module")
    print("=" * 40)

    spreadsheet = get_spreadsheet()

    # 매입 시트에서 특정 행 찾기 테스트
    sheet = spreadsheet.worksheet(SHEET_PURCHASES)
    row_idx, col_map = find_purchase_row(sheet, 'PO-2601', 'Test Product')
    print(f"Purchase row: {row_idx}")
    print(f"Column map: {col_map}")
