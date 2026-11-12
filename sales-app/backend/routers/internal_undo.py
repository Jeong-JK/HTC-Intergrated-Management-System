"""재고 서버(활동 로그)가 부르는 되돌리기 — Sales 프로젝트는 구글 시트까지 맞춰야 해서 Sales 서버에서 실행"""
import hmac
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import db_cursor
from activity_client import audit, TOKEN_FILE
from sheet_write_sync import update_project_in_sheet, is_sheet_sync_enabled

router = APIRouter(tags=["internal"])
logger = logging.getLogger(__name__)


class UndoIn(BaseModel):
    data: dict
    force: bool = False


@router.post("/internal/undo")
def internal_undo(body: UndoIn, request: Request):
    if not hmac.compare_digest(request.headers.get("x-activity-token", ""), TOKEN_FILE.read_text().strip()):
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    try:
        inverse, sheet = audit.undo(db_cursor, "sales", body.data, body.force)
    except audit.UndoConflict as e:
        raise HTTPException(status_code=409, detail=str(e))
    except audit.UndoError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if sheet and sheet["updated"] and is_sheet_sync_enabled():
        try:
            update_project_in_sheet(sheet["id"], sheet["updated"], sheet["current"])
        except Exception as e:  # DB 는 이미 되돌림 — 시트만 실패
            logger.warning(f"되돌리기 후 시트 반영 실패: {e}")
    return {"inverse": inverse}
