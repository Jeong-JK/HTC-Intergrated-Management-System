"""Google Sheets 동기화 API 라우터"""
from fastapi import APIRouter, HTTPException, Request
import hmac
import os
from pydantic import BaseModel
from typing import Optional, List, Any
import sys
import re
sys.path.append('/home/ec2-user/sales-app/backend')

from google_sheets_sync import (
    sync_all_sheets,
    sync_sheet_raw,
    get_sheet_data,
    get_sync_status,
    write_to_sheet,
    write_row_to_sheet,
    update_sheet_range,
    SYNC_SHEETS
)
from database import db_cursor
from sheet_write_sync import disable_sheet_sync, enable_sheet_sync
from config import get_logger, CURRENT_YEAR, PROJECT_NO_PATTERN
from sync_db_from_sheets import sync_purchases_from_sheet, sync_projects_from_sheet, sync_weekly_from_sheet

logger = get_logger(__name__)

router = APIRouter(prefix="/sheets", tags=["sheets"])

# 웹훅 키: .env 에 SHEET_WEBHOOK_TOKEN 을 넣으면 Apps Script 주소 끝에 ?token=… 이 있어야만 받음 (없으면 지금처럼 열림)
WEBHOOK_TOKEN = os.getenv("SHEET_WEBHOOK_TOKEN", "")


def _require_admin(request: Request):
    """시트 → DB 덮어쓰기는 관리자만"""
    user = getattr(request.state, "user", None) or {}
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="동기화는 관리자만 할 수 있습니다")


class CellUpdate(BaseModel):
    row: int
    col: int
    value: str


class RowUpdate(BaseModel):
    row: int
    values: List[str]


class RangeUpdate(BaseModel):
    start_row: int
    start_col: int
    data: List[List[str]]


class SheetWebhook(BaseModel):
    sheet_name: str
    row: int
    col: int
    value: Any
    old_value: Optional[Any] = None


@router.get("/status")
def get_sheets_status():
    """모든 시트의 동기화 상태 조회"""
    return get_sync_status()


@router.get("/list")
def get_sheet_list():
    """동기화 가능한 시트 목록"""
    return {"sheets": SYNC_SHEETS}


@router.get("/{sheet_name}")
def get_sheet(sheet_name: str):
    """특정 시트 데이터 조회"""
    # URL 디코딩된 시트 이름으로 데이터 조회
    data = get_sheet_data(sheet_name)
    if data is None:
        raise HTTPException(status_code=404, detail=f"시트 '{sheet_name}' 데이터를 찾을 수 없습니다. 먼저 동기화를 실행하세요.")
    return data


@router.post("/sync")
def sync_sheets(request: Request):
    """모든 시트 동기화 (구글 → 로컬 JSON → DB) — 관리자만"""
    _require_admin(request)
    try:
        # 1단계: 구글 시트 → JSON 파일 동기화 — 하나라도 못 받아오면 예전 사본으로 DB 를 덮어쓰지 않게 여기서 멈춤
        results = sync_all_sheets()
        failed = [n for n, r in results.items() if isinstance(r, str)]
        if failed:
            raise HTTPException(status_code=500, detail=f"시트를 받아오지 못해 DB 는 그대로 뒀습니다: {', '.join(failed)} — {results[failed[0]]}")

        # 2단계: JSON → DB 동기화 (자동)
        db_results = {}
        try:
            db_results['purchases'] = sync_purchases_from_sheet()
            db_results['projects'] = sync_projects_from_sheet()
            db_results['weekly'] = sync_weekly_from_sheet()
            logger.info(f"DB 동기화 완료: {db_results}")
        except Exception as db_err:
            logger.error(f"DB 동기화 오류: {db_err}")
            done = ", ".join(db_results) or "없음"
            raise HTTPException(status_code=500, detail=f"시트는 받아왔지만 DB 반영 중 오류가 났습니다 (반영된 것: {done}) — {db_err}")

        return {
            "success": True,
            "message": "동기화 완료 (시트 → DB)",
            "results": results,
            "db_sync": db_results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"동기화 오류: {str(e)}")


@router.post("/sync/{sheet_name}")
def sync_single_sheet(sheet_name: str, request: Request):
    """특정 시트만 동기화 (JSON + DB) — 관리자만"""
    _require_admin(request)
    if sheet_name not in SYNC_SHEETS:
        raise HTTPException(status_code=400, detail=f"'{sheet_name}'은(는) 동기화 대상 시트가 아닙니다.")
    try:
        # 1단계: 구글 시트 → JSON
        row_count = sync_sheet_raw(sheet_name)

        # 2단계: JSON → DB (해당 시트만)
        db_count = 0
        try:
            if '매입' in sheet_name:
                db_count = sync_purchases_from_sheet()
            elif '프로젝트' in sheet_name:
                db_count = sync_projects_from_sheet()
            elif 'Weekly' in sheet_name or '위클리' in sheet_name:
                db_count = sync_weekly_from_sheet()
            logger.info(f"DB 동기화 완료: {sheet_name} = {db_count}건")
        except Exception as db_err:
            logger.error(f"DB 동기화 오류: {db_err}")
            raise HTTPException(status_code=500, detail=f"시트는 받아왔지만 DB 반영 중 오류가 났습니다 — {db_err}")

        return {
            "success": True,
            "sheet_name": sheet_name,
            "row_count": row_count,
            "db_count": db_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"동기화 오류: {str(e)}")


@router.put("/{sheet_name}/cell")
def update_cell(sheet_name: str, update: CellUpdate):
    """구글 시트 특정 셀 업데이트"""
    try:
        write_to_sheet(sheet_name, update.row, update.col, update.value)
        # 로컬 데이터도 동기화
        sync_sheet_raw(sheet_name)
        return {
            "success": True,
            "message": f"셀({update.row}, {update.col}) 업데이트 완료"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업데이트 오류: {str(e)}")


@router.put("/{sheet_name}/row")
def update_row(sheet_name: str, update: RowUpdate):
    """구글 시트 특정 행 업데이트"""
    try:
        write_row_to_sheet(sheet_name, update.row, update.values)
        # 로컬 데이터도 동기화
        sync_sheet_raw(sheet_name)
        return {
            "success": True,
            "message": f"행 {update.row} 업데이트 완료"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업데이트 오류: {str(e)}")


@router.put("/{sheet_name}/range")
def update_range(sheet_name: str, update: RangeUpdate):
    """구글 시트 범위 업데이트"""
    try:
        update_sheet_range(sheet_name, update.start_row, update.start_col, update.data)
        # 로컬 데이터도 동기화
        sync_sheet_raw(sheet_name)
        return {
            "success": True,
            "message": "범위 업데이트 완료"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업데이트 오류: {str(e)}")


@router.post("/webhook/sheet-update")
def sheet_update_webhook(webhook: SheetWebhook, token: str = ""):
    """구글 시트에서 직접 수정 시 Apps Script가 호출하는 webhook"""
    if WEBHOOK_TOKEN and not hmac.compare_digest(token, WEBHOOK_TOKEN):
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    try:
        logger.info(f"Webhook received: {webhook.sheet_name}, row={webhook.row}, col={webhook.col}, value={webhook.value}")

        # 무한 루프 방지: 이 업데이트는 시트에 다시 쓰지 않음
        disable_sheet_sync()

        try:
            # 줄이 추가/이동됐을 수 있어 매번 최신 시트를 받아 그 줄을 찾음 (실패하면 저장된 사본)
            fresh = False
            if webhook.sheet_name in SYNC_SHEETS:
                try:
                    sync_sheet_raw(webhook.sheet_name)
                    fresh = True
                except Exception as e:
                    logger.warning(f"시트 새로 읽기 실패 — 저장된 사본 사용: {e}")
            sheet_data = get_sheet_data(webhook.sheet_name)
            if not sheet_data:
                return {"success": False, "message": "시트 데이터를 찾을 수 없습니다"}

            rows = sheet_data['data']
            r, c = webhook.row - 1, webhook.col - 1
            if fresh and 0 <= r < len(rows):
                # 수식 칸은 수식 글자 대신 시트에 보이는 계산 결과를 씀
                webhook.value = rows[r][c] if c < len(rows[r]) else ''
            elif str(webhook.value or '').lstrip().startswith('='):
                return {"success": False, "message": "수식 값은 시트를 다시 읽을 수 없어 반영하지 않았습니다"}

            # 매입 시트 처리
            if '매입' in webhook.sheet_name:
                result = update_purchase_from_webhook(rows, webhook)
                return result

            # 프로젝트 시트 처리
            elif '프로젝트' in webhook.sheet_name:
                result = update_project_from_webhook(rows, webhook)
                return result

            else:
                return {"success": False, "message": f"알 수 없는 시트: {webhook.sheet_name}"}

        finally:
            # 다시 활성화
            enable_sheet_sync()

    except Exception as e:
        logger.error(f"Webhook error: {e}")
        enable_sheet_sync()
        raise HTTPException(status_code=500, detail=str(e))


def update_purchase_from_webhook(rows, webhook):
    """매입 시트 webhook 처리"""
    # 헤더 행 찾기
    header_row_idx = None
    for i, row in enumerate(rows):
        if 'PO' in row:
            header_row_idx = i
            break

    if header_row_idx is None:
        return {"success": False, "message": "헤더를 찾을 수 없습니다"}

    header = rows[header_row_idx]

    # 컬럼 매핑
    col_map = {}
    for i, h in enumerate(header):
        if h == 'PO': col_map[i] = 'po_number'
        elif h == 'Quote': col_map[i] = 'quote'
        elif h == 'OC': col_map[i] = 'oc'
        elif h == 'Invoice': col_map[i] = 'invoice'
        elif '품의번호' in h: col_map[i] = 'request_number'
        elif h == 'Supplier': col_map[i] = 'supplier'
        elif 'Project' in h: col_map[i] = 'project'
        elif h == 'Products': col_map[i] = 'product_name'
        elif "Q'ty" in h or 'qty' in h.lower(): col_map[i] = 'quantity'
        elif 'Net Price' in h: col_map[i] = 'net_price'
        elif h == 'Amount': col_map[i] = 'amount'
        elif 'Expected' in h: col_map[i] = 'expected_date'
        elif '입고' in h: col_map[i] = 'received_status'
        elif '송금일1' in h: col_map[i] = 'payment_date1'
        elif '송금액1' in h: col_map[i] = 'payment_amount1'
        elif '환율1' in h: col_map[i] = 'exchange_rate1'
        elif '송금일2' in h: col_map[i] = 'payment_date2'
        elif '송금액2' in h: col_map[i] = 'payment_amount2'
        elif '환율2' in h: col_map[i] = 'exchange_rate2'

    # 변경된 컬럼이 어떤 필드인지 확인 (0-indexed로 변환)
    col_idx = webhook.col - 1
    if col_idx not in col_map:
        return {"success": False, "message": f"컬럼 {webhook.col}은 매핑되지 않았습니다"}

    field_name = col_map[col_idx]

    # 해당 행 데이터 읽기 (0-indexed로 변환)
    row_idx = webhook.row - 1
    if row_idx <= header_row_idx or row_idx >= len(rows):
        return {"success": False, "message": "데이터 행이 아닙니다"}

    row_data = rows[row_idx]

    # PO번호와 품목명 찾기
    po_col = next((i for i, f in col_map.items() if f == 'po_number'), None)
    product_col = next((i for i, f in col_map.items() if f == 'product_name'), None)

    if po_col is None or product_col is None:
        return {"success": False, "message": "PO 또는 품목명 컬럼을 찾을 수 없습니다"}

    po_number = row_data[po_col].strip() if po_col < len(row_data) else ''
    product_name = row_data[product_col].strip() if product_col < len(row_data) else ''

    if not po_number or not product_name:
        return {"success": False, "message": "PO번호 또는 품목명이 없습니다"}

    # 같은 (PO, 품목)이 여러 줄이면 시트에서 몇 번째인지로 DB 줄을 고름 (동기화가 시트 순서대로 번호를 매김)
    nth = sum(1 for prev in rows[header_row_idx + 1:row_idx]
              if po_col < len(prev) and product_col < len(prev)
              and prev[po_col].strip() == po_number and prev[product_col].strip() == product_name)

    # DB에서 찾아서 업데이트
    with db_cursor() as cur:
        # 레코드 찾기 (올해 것만)
        cur.execute("""
            SELECT id FROM purchases
            WHERE po_number = %s AND product_name = %s AND year = %s
            ORDER BY id
        """, (po_number, product_name, CURRENT_YEAR))

        found = cur.fetchall()
        purchase = found[nth] if nth < len(found) else (found[0] if found else None)
        if not purchase:
            return {"success": False, "message": f"매입을 찾을 수 없습니다: PO={po_number}, 품목={product_name}"}

        # 값 변환
        db_value = convert_value_for_db(field_name, webhook.value)

        # 업데이트
        cur.execute(f"UPDATE purchases SET {field_name} = %s WHERE id = %s", (db_value, purchase['id']))

        logger.info(f"Updated purchase {purchase['id']}: {field_name} = {db_value}")

        return {
            "success": True,
            "message": f"매입 업데이트 완료: {field_name}",
            "purchase_id": purchase['id']
        }


def update_project_from_webhook(rows, webhook):
    """프로젝트 시트 webhook 처리"""
    # 헤더 행 찾기
    header_row_idx = None
    for i, row in enumerate(rows):
        if 'No' in row and '업체명' in row:
            header_row_idx = i
            break

    if header_row_idx is None:
        return {"success": False, "message": "헤더를 찾을 수 없습니다"}

    # 컬럼 매핑 (고정 인덱스)
    col_map = {
        0: 'status',
        1: 'no',
        2: 'customer',
        3: 'project_name',
        4: 'delivery_date',
        5: 'order_amount',
        6: 'payment_date',
        7: 'payment_amount',
        8: 'payment_status',
    }

    # 변경된 컬럼이 어떤 필드인지 확인 (0-indexed로 변환)
    col_idx = webhook.col - 1
    if col_idx not in col_map:
        return {"success": False, "message": f"컬럼 {webhook.col}은 프로젝트 기본 필드가 아닙니다"}

    field_name = col_map[col_idx]

    # 해당 행 데이터 읽기 (0-indexed로 변환)
    row_idx = webhook.row - 1
    if row_idx <= header_row_idx or row_idx >= len(rows):
        return {"success": False, "message": "데이터 행이 아닙니다"}

    row_data = rows[row_idx]

    # 프로젝트 번호 찾기 (컬럼 1)
    if len(row_data) <= 1:
        return {"success": False, "message": "프로젝트 번호가 없습니다"}

    no_cell = row_data[1].strip()
    match = re.match(PROJECT_NO_PATTERN, no_cell.split('\n')[0])
    if not match:
        return {"success": False, "message": f"프로젝트 번호를 찾을 수 없습니다: {no_cell}"}

    project_no = match.group(1)

    # DB에서 찾아서 업데이트
    with db_cursor() as cur:
        # 레코드 찾기
        cur.execute("SELECT id FROM projects WHERE project_no = %s AND year = %s", (project_no, CURRENT_YEAR))
        project = cur.fetchone()

        if not project:
            return {"success": False, "message": f"프로젝트를 찾을 수 없습니다: {project_no}"}

        # 값 변환
        db_value = convert_value_for_db(field_name, webhook.value)

        # status, no는 무시 (DB 필드 아님)
        if field_name in ['status', 'no']:
            return {"success": True, "message": f"{field_name} 필드는 업데이트하지 않습니다"}

        # 업데이트
        cur.execute(f"UPDATE projects SET {field_name} = %s WHERE id = %s", (db_value, project['id']))

        logger.info(f"Updated project {project['id']}: {field_name} = {db_value}")

        return {
            "success": True,
            "message": f"프로젝트 업데이트 완료: {field_name}",
            "project_id": project['id']
        }


def convert_value_for_db(field_name, value):
    """시트 값을 DB 값으로 변환"""
    if value is None or value == '':
        return None

    # 입금률: "100%" → 1.0, "0.5" → 0.5
    if field_name == 'payment_status':
        m = re.search(r'(-?\d+(?:\.\d+)?)\s*%', str(value))
        if m:
            return float(m.group(1)) / 100
        try:
            return float(str(value).replace(',', ''))
        except ValueError:
            return None

    # 날짜 필드
    if 'date' in field_name:
        # "2026. 1. 15" → "2026-01-15"
        cleaned = str(value).strip()
        match = re.match(r'(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})', cleaned)
        if match:
            year, month, day = match.groups()
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        return str(value)

    # 금액/숫자 필드
    if field_name in ['quantity', 'net_price', 'amount', 'order_amount',
                      'payment_amount', 'exchange_rate1', 'exchange_rate2',
                      'payment_amount1', 'payment_amount2']:
        # "$1,234" → 1234
        cleaned = re.sub(r'[^\d.\-]', '', str(value).replace(',', ''))
        if cleaned == '' or cleaned == '-':
            return None
        try:
            if field_name == 'quantity':
                return int(float(cleaned))
            return float(cleaned)
        except:
            return None

    # 문자열
    return str(value).strip()
