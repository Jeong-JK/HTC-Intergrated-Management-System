"""HTC Partner CRM — FastAPI Main"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
import os
import httpx

from config import APP_TITLE, APP_VERSION, CORS_ORIGINS
from database import init_db
from routers import crm_companies, teams, contacts, meetings, dashboard, drive_files, google_drive
from routers import quotations, purchase_orders, inventory_items

app = FastAPI(title=APP_TITLE, version=APP_VERSION)

# 인증 체크 미들웨어
class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 정적 파일 요청은 체크하지 않음
        if request.url.path.startswith("/assets/") or request.url.path.endswith(".png"):
            return await call_next(request)

        # 인증 체크
        session_token = request.cookies.get("session_token")
        print(f"[DEBUG] Path: {request.url.path}, Cookie: {session_token[:20] if session_token else 'None'}...")

        if session_token:
            # inventory-app의 인증 API 호출
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        "http://localhost:8000/api/auth/me",
                        cookies={"session_token": session_token},
                        timeout=2.0
                    )
                    print(f"[DEBUG] Auth response: {response.status_code}")
                    if response.status_code == 200:
                        # 인증 성공 - user 정보 저장
                        user_data = response.json()
                        request.state.user = user_data.get("user", {})
                        return await call_next(request)
            except Exception as e:
                print(f"[DEBUG] Auth error: {e}")
                pass

        # 인증 실패 처리
        # API 요청은 401 에러 반환
        if request.url.path.startswith("/api/"):
            from fastapi.responses import JSONResponse
            print(f"[DEBUG] Returning 401 for {request.url.path}")
            return JSONResponse(
                status_code=401,
                content={"detail": "로그인이 필요합니다"}
            )

        # HTML 페이지 요청은 메인 허브(ims.hltac.com)로 리다이렉트
        host = request.headers.get("host", "").split(":")[0]
        if "hltac.com" in host:
            redirect_url = "http://ims.hltac.com/"
        else:
            # 로컬 환경에서는 8000 포트로 리다이렉트
            redirect_url = f"http://{host.split(':')[0]}:8000/"
        return RedirectResponse(url=redirect_url, status_code=302)

app.add_middleware(AuthMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

# CRM 전용 라우터
app.include_router(crm_companies.router, prefix="/api")
app.include_router(teams.router,         prefix="/api")
app.include_router(contacts.router,      prefix="/api")
app.include_router(meetings.router,      prefix="/api")
app.include_router(dashboard.router,     prefix="/api")
app.include_router(drive_files.router,   prefix="/api")
app.include_router(google_drive.router,  prefix="/api")
app.include_router(quotations.router,    prefix="/api")
app.include_router(purchase_orders.router, prefix="/api")
app.include_router(inventory_items.router, prefix="/api")

STATIC_DIR = os.path.join(os.path.dirname(__file__), "../frontend/dist")
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=f"{STATIC_DIR}/assets"), name="assets")

    @app.get("/HTC_logo.png")
    def serve_htc_logo():
        htc_logo_path = os.path.join(STATIC_DIR, "HTC_logo.png")
        if os.path.exists(htc_logo_path):
            return FileResponse(htc_logo_path, media_type="image/png")
        return FileResponse(f"{STATIC_DIR}/index.html")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(f"{STATIC_DIR}/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
