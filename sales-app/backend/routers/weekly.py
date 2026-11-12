"""HTC Sales Pipeline — Weekly Schedule API"""
from fastapi import APIRouter, HTTPException, Request
from permissions import require_perm
from typing import Optional
from pydantic import BaseModel
from database import db_cursor
from config import CURRENT_YEAR
import json
import re

router = APIRouter(tags=["Weekly"])


# ============ Pydantic Models ============

class WeeklyScheduleCreate(BaseModel):
    year: int
    project_no: str
    customer_project: str
    product_name: str
    quantity: int = 1
    supplier: Optional[str] = None
    notes: Optional[str] = None
    week_data: Optional[dict] = None

class WeeklyScheduleUpdate(BaseModel):
    project_no: Optional[str] = None
    customer_project: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[int] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None
    week_data: Optional[dict] = None
    bar_note: Optional[str] = None
    first_week_note: Optional[str] = None

# ============ API Endpoints ============

@router.get("/weekly/project/{project_no}")
def get_project_items(project_no: str):
    """프로젝트 번호로 품목 정보 조회 (매입 품목 기준)"""
    with db_cursor() as cur:
        # 프로젝트 정보 조회
        cur.execute("""
            SELECT id, project_no, customer, project_name, supplier
            FROM projects
            WHERE project_no = %s
        """, (project_no,))
        project = cur.fetchone()

        if not project:
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")

        # 매입 품목에서 품목 정보 가져오기
        cur.execute("""
            SELECT product_name, quantity, supplier
            FROM purchase_items
            WHERE project_id = %s
        """, (project['id'],))
        purchase_items = cur.fetchall()

        items = []
        for item in purchase_items:
            items.append({
                'product_name': item['product_name'],
                'quantity': item['quantity'],
                'supplier': item['supplier'] or project['supplier']
            })

        return {
            'project_no': project['project_no'],
            'customer': project['customer'],
            'project_name': project['project_name'],
            'customer_project': f"{project['customer']}({project['project_name']})",
            'items': items
        }

@router.get("/weekly")
def get_weekly_schedules(year: int = CURRENT_YEAR, limit: int = 5000, offset: int = 0):
    """Weekly 일정 목록 조회 - weekly_schedule 테이블에서 조회"""
    with db_cursor() as cur:
        # weekly_schedule 테이블에서 가져오기 (프로젝트 상태 포함)
        cur.execute("""
            SELECT
                ws.id,
                ws.project_no,
                ws.customer_project,
                ws.product_name,
                ws.quantity,
                ws.supplier,
                ws.notes,
                ws.week_data,
                ws.first_week_note,
                ws.bar_note,
                p.status as project_status,
                'manual' as source
            FROM weekly_schedule ws
            LEFT JOIN projects p ON ws.project_no = p.project_no AND p.year = %s
            WHERE ws.year = %s
            ORDER BY ws.project_no, ws.id
        """, (year, year))
        manual_rows = cur.fetchall()

        results = []

        # weekly_schedule 데이터 추가
        for row in manual_rows:
            week_data = None
            if row['week_data']:
                try:
                    week_data = json.loads(row['week_data'])
                except json.JSONDecodeError:
                    pass
            results.append({
                'id': row['id'],
                'source': 'manual',
                'project_no': row['project_no'] or '',
                'po_number': '',
                'customer_project': row['customer_project'] or '',
                'product_name': row['product_name'] or '',
                'quantity': row['quantity'] or 0,
                'supplier': row['supplier'] or '',
                'expected_date': '',
                'received_status': '',
                'order_date': '',
                'bar_note': row.get('bar_note', ''),
                'first_week_note': row.get('first_week_note', ''),
                'project_status': row.get('project_status', ''),
                'bar_start_date': '',
                'bar_end_date': '',
                'notes': row['notes'] or '',
                'week_data': week_data,
                'purchase_item_id': None
            })

        # 정렬: project_no (26-01, 26-02, …, 27-01) 순서, 형식이 다르면 맨 뒤
        def sort_key(x):
            m = re.match(r'(\d{2})-(\d+)', x['project_no'] or '')
            return (0, int(m.group(1)), int(m.group(2)), x['id']) if m else (1, 0, 0, x['id'])
        results.sort(key=sort_key)

        return results[:limit]

@router.get("/weekly/{schedule_id}")
def get_weekly_schedule(schedule_id: int):
    """Weekly 일정 상세 조회"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM weekly_schedule WHERE id = %s", (schedule_id,))
        schedule = cur.fetchone()
        if not schedule:
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다")

        if schedule.get('week_data'):
            try:
                schedule['week_data'] = json.loads(schedule['week_data'])
            except json.JSONDecodeError:
                schedule['week_data'] = None

        return schedule

@router.post("/weekly")
def create_weekly_schedule(schedule: WeeklyScheduleCreate, request: Request):
    """Weekly 일정 생성"""
    require_perm(request, "can_edit_weekly")
    with db_cursor() as cur:
        week_data_json = json.dumps(schedule.week_data) if schedule.week_data else None

        cur.execute("""
            INSERT INTO weekly_schedule
            (year, project_no, customer_project, product_name, quantity, supplier, notes, week_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            schedule.year, schedule.project_no, schedule.customer_project,
            schedule.product_name, schedule.quantity, schedule.supplier,
            schedule.notes, week_data_json
        ))
        return {"id": cur.lastrowid, "message": "일정이 생성되었습니다"}

@router.put("/weekly/{schedule_id}")
def update_weekly_schedule(schedule_id: int, schedule: WeeklyScheduleUpdate, request: Request):
    """Weekly 일정 업데이트"""
    require_perm(request, "can_edit_weekly")
    with db_cursor() as cur:
        cur.execute("SELECT id FROM weekly_schedule WHERE id = %s", (schedule_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다")

        updates = []
        params = []
        for key, value in schedule.dict(exclude_unset=True).items():
            if key == 'week_data' and value is not None:
                updates.append(f"{key} = %s")
                params.append(json.dumps(value))
            else:
                updates.append(f"{key} = %s")
                params.append(value)

        if updates:
            params.append(schedule_id)
            query = f"UPDATE weekly_schedule SET {', '.join(updates)} WHERE id = %s"
            cur.execute(query, params)

        return {"message": "일정이 업데이트되었습니다"}

@router.delete("/weekly/{schedule_id}")
def delete_weekly_schedule(schedule_id: int, request: Request):
    """Weekly 일정 삭제"""
    require_perm(request, "can_delete_weekly")
    with db_cursor() as cur:
        cur.execute("DELETE FROM weekly_schedule WHERE id = %s", (schedule_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다")
        return {"message": "일정이 삭제되었습니다"}
