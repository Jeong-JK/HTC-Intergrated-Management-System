"""HTC Sales Pipeline — FastAPI Main"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
import os
import httpx

from config import APP_TITLE, APP_VERSION, CORS_ORIGINS, AUTH_SERVICE_URL, get_logger

logger = get_logger(__name__)
from database import init_db
from routers import projects, purchases, weekly, posts, sheets

app = FastAPI(title=APP_TITLE, version=APP_VERSION)

# 내부 API 호출용 (localhost), 리디렉션용 (외부 URL)
AUTH_API_URL = "http://localhost:8000"


def locked_response(request: Request, app_name: str, detail: str):
    """점검 모드: API는 423, 화면 요청은 메인허브로 (허브가 안내 문구 표시)"""
    from fastapi.responses import JSONResponse
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=423, content={"detail": detail})
    host = request.headers.get("host", "").split(":")[0]
    hub = "https://ims.hltac.com/" if "hltac.com" in host else f"http://{host}:8000/"
    return RedirectResponse(url=f"{hub}?locked={app_name}", status_code=302)


# 인증 체크 미들웨어
class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 정적 파일 요청 및 purchases API, webhook은 체크하지 않음
        if (request.url.path.startswith("/assets/") or
            request.url.path.endswith(".png") or
            request.url.path.startswith("/api/purchases") or
            request.url.path.startswith("/api/sheets/webhook/")):
            return await call_next(request)

        # 인증 체크
        session_token = request.cookies.get("session_token")

        if session_token:
            # inventory-app의 인증 API 호출 (내부 localhost 사용)
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{AUTH_API_URL}/api/auth/me",
                        params={"app": "sales"},  # 점검 모드 확인용
                        cookies={"session_token": session_token},
                        timeout=2.0
                    )
                    if response.status_code == 200:
                        # 인증 성공 - user 정보 저장
                        user_data = response.json()
                        user = user_data.get("user", {})
                        request.state.user = user

                        # Sales Pipeline 접근 권한 체크
                        # 관리자이거나 can_access_sales 권한이 있어야 접근 가능
                        if not user.get('is_admin') and not user.get('can_access_sales'):
                            from fastapi.responses import JSONResponse
                            if request.url.path.startswith("/api/"):
                                return JSONResponse(
                                    status_code=403,
                                    content={"detail": "권한이 없습니다. 관리자에게 문의하세요."}
                                )
                            # HTML 페이지 요청은 메인 허브(inventory-app)로 리다이렉트
                            return RedirectResponse(url=AUTH_SERVICE_URL, status_code=302)

                        return await call_next(request)
                    if response.status_code == 423:
                        return locked_response(request, "sales", response.json().get("detail"))
            except Exception as e:
                # 인증 서비스 연결 실패 시 로그 출력 (타임아웃, 네트워크 오류 등)
                logger.warning(f"인증 서비스 연결 실패: {e}")

        # 인증 실패 처리
        # API 요청은 401 에러 반환
        if request.url.path.startswith("/api/"):
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=401,
                content={"detail": "로그인이 필요합니다"}
            )

        # HTML 페이지 요청은 메인 허브(inventory-app)로 리다이렉트
        return RedirectResponse(url=AUTH_SERVICE_URL, status_code=302)

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

# 현재 사용자 정보 반환 API
@app.get("/api/auth/me")
def get_current_user(request: Request):
    user = getattr(request.state, 'user', None)
    if not user:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"detail": "로그인이 필요합니다"})
    return {"user": user}

app.include_router(purchases.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(weekly.router, prefix="/api")
app.include_router(posts.router, prefix="/api")
app.include_router(sheets.router, prefix="/api")

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
    uvicorn.run(app, host="0.0.0.0", port=8000)
