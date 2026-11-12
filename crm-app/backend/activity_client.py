"""활동 로그: 저장/수정/삭제 요청을 재고 서버(활동 로그 보관)에 알림. 실패해도 원래 요청엔 영향 없음"""
import logging
from pathlib import Path
import httpx

logger = logging.getLogger(__name__)
TOKEN_FILE = Path.home() / ".config" / "htc" / "activity_token"  # 재고 서버가 만든 서버끼리 키
WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")


async def report_activity(request, system, status):
    if request.method not in WRITE_METHODS or status >= 400 or not request.url.path.startswith("/api/"):
        return
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "http://localhost:8000/api/activity/record", timeout=1.5,
                headers={"X-Activity-Token": TOKEN_FILE.read_text().strip()},
                json={"session_token": request.cookies.get("session_token"), "system": system,
                      "method": request.method, "path": request.url.path, "status": status,
                      "ip": request.headers.get("x-real-ip") or (request.client.host if request.client else None)},
            )
    except Exception as e:
        logger.warning(f"활동 로그 전송 실패: {e}")
