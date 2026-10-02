#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Sheets 동기화 모듈
시트 데이터를 그대로 JSON으로 저장하여 완벽히 동일하게 표시
"""

import gspread
import pymysql
import json
import os
from datetime import datetime
from config import DB_HOST, DB_USER, DB_PASSWORD, DB_NAME

# 설정
CREDENTIALS_FILE = '/home/ec2-user/sales-app/backend/credentials.json'
SPREADSHEET_ID = '1QIogC0pcxcIQJGbXLH_Ta4EG6herT05RhCG4rwQnm6c'
DATA_DIR = '/home/ec2-user/sales-app/backend/sheet_data'

DB_CONFIG = {
    'host': DB_HOST,
    'user': DB_USER,
    'password': DB_PASSWORD,
    'db': DB_NAME,
    'charset': 'utf8mb4'
}

# 동기화할 시트 목록
SYNC_SHEETS = [
    '2026Y 매입',
    '2026Y 프로젝트',
    '2026Y Weekly'
]


def get_spreadsheet():
    """구글 스프레드시트 연결"""
    gc = gspread.service_account(filename=CREDENTIALS_FILE)
    return gc.open_by_key(SPREADSHEET_ID)


def ensure_data_dir():
    """데이터 디렉토리 생성"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


def get_sheet_merges(spreadsheet, sheet):
    """시트의 병합셀 정보를 가져옴"""
    try:
        meta = spreadsheet.fetch_sheet_metadata()
        if 'sheets' in meta:
            for s in meta['sheets']:
                if s.get('properties', {}).get('sheetId') == sheet.id:
                    return s.get('merges', [])
    except Exception as e:
        print(f"  → 병합셀 메타데이터 가져오기 실패: {e}")
    return []


def fill_merged_cells(data, merges):
    """병합된 셀의 값을 모든 병합 영역에 채우기

    merges 형식: [{'startRowIndex': 0, 'endRowIndex': 2, 'startColumnIndex': 0, 'endColumnIndex': 1}, ...]
    - startRowIndex, startColumnIndex: 0-indexed, inclusive
    - endRowIndex, endColumnIndex: 0-indexed, exclusive
    """
    for merge in merges:
        start_row = merge.get('startRowIndex', 0)
        end_row = merge.get('endRowIndex', start_row + 1)  # exclusive
        start_col = merge.get('startColumnIndex', 0)
        end_col = merge.get('endColumnIndex', start_col + 1)  # exclusive

        # 범위 체크
        if start_row >= len(data):
            continue
        if start_col >= len(data[start_row]):
            continue

        # 병합된 셀의 첫 번째 값 가져오기
        value = data[start_row][start_col] if start_col < len(data[start_row]) else ''

        # 병합 영역의 모든 셀에 값 채우기 (endRowIndex, endColumnIndex는 exclusive)
        for row_idx in range(start_row, min(end_row, len(data))):
            for col_idx in range(start_col, end_col):
                # 행의 열 수가 부족하면 확장
                while len(data[row_idx]) <= col_idx:
                    data[row_idx].append('')
                # 첫 번째 셀이 아닌 경우에만 값 복사
                if row_idx != start_row or col_idx != start_col:
                    data[row_idx][col_idx] = value

    return data


def sync_sheet_raw(sheet_name):
    """시트 데이터를 그대로 JSON으로 저장 (병합셀 처리 포함)"""
    print(f"[{sheet_name}] 동기화 중...")

    spreadsheet = get_spreadsheet()
    sheet = spreadsheet.worksheet(sheet_name)

    # 모든 데이터 가져오기
    all_values = sheet.get_all_values()

    # 병합된 셀 정보 가져오기
    merges = get_sheet_merges(spreadsheet, sheet)
    if merges:
        print(f"  → 병합셀 {len(merges)}개 발견")
        # 병합된 셀 값 채우기
        all_values = fill_merged_cells(all_values, merges)

    # 파일명 생성 (공백, 특수문자 제거)
    safe_name = sheet_name.replace(' ', '_').replace('/', '_')
    file_path = os.path.join(DATA_DIR, f'{safe_name}.json')

    # JSON으로 저장
    data = {
        'sheet_name': sheet_name,
        'synced_at': datetime.now().isoformat(),
        'row_count': len(all_values),
        'col_count': len(all_values[0]) if all_values else 0,
        'merges': merges,  # 병합 정보도 저장 (프론트엔드에서 시각적 병합 표시용)
        'data': all_values
    }

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"  → {len(all_values)}행 저장 완료")
    return len(all_values)


def sync_all_sheets():
    """모든 시트 동기화"""
    ensure_data_dir()

    print("=" * 60)
    print("Google Sheets 동기화 시작")
    print(f"시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    results = {}
    for sheet_name in SYNC_SHEETS:
        try:
            results[sheet_name] = sync_sheet_raw(sheet_name)
        except Exception as e:
            results[sheet_name] = f"오류: {e}"
            print(f"  → 오류: {e}")

    print("=" * 60)
    print("동기화 완료!")
    for name, result in results.items():
        print(f"  - {name}: {result}")
    print("=" * 60)

    return results


def get_sheet_data(sheet_name):
    """저장된 시트 데이터 읽기"""
    safe_name = sheet_name.replace(' ', '_').replace('/', '_')
    file_path = os.path.join(DATA_DIR, f'{safe_name}.json')

    if not os.path.exists(file_path):
        return None

    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_sync_status():
    """동기화 상태 확인"""
    status = {}
    for sheet_name in SYNC_SHEETS:
        data = get_sheet_data(sheet_name)
        if data:
            status[sheet_name] = {
                'synced_at': data['synced_at'],
                'row_count': data['row_count'],
                'col_count': data['col_count']
            }
        else:
            status[sheet_name] = None
    return status


# ============================================================
# 스프레드시트 쓰기 (DB → 구글시트)
# ============================================================
def write_to_sheet(sheet_name, row_index, col_index, value):
    """구글 시트 특정 셀에 값 쓰기"""
    spreadsheet = get_spreadsheet()
    sheet = spreadsheet.worksheet(sheet_name)
    sheet.update_cell(row_index, col_index, value)
    return True


def write_row_to_sheet(sheet_name, row_index, values):
    """구글 시트 특정 행에 값들 쓰기"""
    spreadsheet = get_spreadsheet()
    sheet = spreadsheet.worksheet(sheet_name)

    # A1 notation으로 범위 지정
    start_col = 'A'
    end_col = chr(ord('A') + len(values) - 1)
    range_notation = f'{start_col}{row_index}:{end_col}{row_index}'

    sheet.update(range_notation, [values])
    return True


def append_row_to_sheet(sheet_name, values):
    """구글 시트에 새 행 추가"""
    spreadsheet = get_spreadsheet()
    sheet = spreadsheet.worksheet(sheet_name)
    sheet.append_row(values)
    return True


def update_sheet_range(sheet_name, start_row, start_col, data):
    """구글 시트 범위 업데이트 (2D 배열)"""
    spreadsheet = get_spreadsheet()
    sheet = spreadsheet.worksheet(sheet_name)

    # 범위 계산
    end_row = start_row + len(data) - 1
    end_col = start_col + len(data[0]) - 1 if data else start_col

    start_col_letter = chr(ord('A') + start_col - 1)
    end_col_letter = chr(ord('A') + end_col - 1)
    range_notation = f'{start_col_letter}{start_row}:{end_col_letter}{end_row}'

    sheet.update(range_notation, data)
    return True


if __name__ == '__main__':
    sync_all_sheets()
