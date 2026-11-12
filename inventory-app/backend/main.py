"""HTC Inventory — FastAPI Main v2"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import httpx
from bs4 import BeautifulSoup
import re
from datetime import datetime, timedelta

from config import APP_TITLE, APP_VERSION, CORS_ORIGINS, PIPELINE_DB_HOST, PIPELINE_DB_USER, PIPELINE_DB_PASSWORD, PIPELINE_DB_NAME
from database import init_db
from routers import items, rental, delivery, stats, inbound, rack, settings, companies, alerts, auth, posts, drive, work_logs, maintenance, ops, activity
import audit
from database import db_cursor

# 환율 캐시 (1시간마다 갱신)
exchange_rate_cache = {"rate": None, "updated": None}

import pymysql
from pymysql.cursors import DictCursor

app = FastAPI(title=APP_TITLE, version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 점검 모드: inv/cal 도메인의 API와, sales/crm 미들웨어가 부르는 /api/auth/me?app=xxx 를 막음
LOCK_HOSTS = {"inv": "inventory", "cal": "worklog"}
OPEN_PATHS = ("/api/maintenance", "/api/auth/login", "/api/auth/logout")


@app.middleware("http")
async def maintenance_guard(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and not path.startswith(OPEN_PATHS):
        system = request.query_params.get("app") if path == "/api/auth/me" else None
        system = system or LOCK_HOSTS.get(request.headers.get("host", "").split(".")[0])
        if system:
            msg = await run_in_threadpool(maintenance.blocked_message, system, request.cookies.get("session_token"))
            if msg:
                return JSONResponse(status_code=423, content={"detail": msg})
    return await call_next(request)


# 활동 로그: 성공한 추가/수정/삭제를 세션 주인 이름으로 기록 (기록 실패해도 응답은 그대로)
@app.middleware("http")
async def activity_logger(request: Request, call_next):
    path = request.url.path
    snap = None
    if request.method in activity.WRITE_METHODS:
        try:  # 상세('무엇을 무엇으로')용으로 처리 전 대상 행 기억
            snap = await run_in_threadpool(audit.before, db_cursor, "inventory", request.method, path)
        except Exception as e:
            print(f"활동 로그 상세 준비 실패: {e}")
    response = await call_next(request)
    if activity.should_log(request.method, path, response.status_code):
        ip = request.headers.get("x-real-ip") or (request.client.host if request.client else None)
        try:
            detail, ref_table, ref_id, undo_data = (await run_in_threadpool(audit.after, db_cursor, snap)
                                                    if snap else (None, None, None, None))
            await run_in_threadpool(activity.record_session, request.cookies.get("session_token"),
                                    activity.inventory_system(path), request.method, path, ip, detail, ref_table, ref_id,
                                    undo_data)
        except Exception as e:
            print(f"활동 로그 기록 실패: {e}")
    return response


@app.on_event("startup")
def startup():
    init_db()

app.include_router(items.router,     prefix="/api")
app.include_router(rental.router,    prefix="/api")
app.include_router(delivery.router,  prefix="/api")
app.include_router(stats.router,     prefix="/api")
app.include_router(inbound.router,   prefix="/api")
app.include_router(rack.router,      prefix="/api")
app.include_router(settings.router,  prefix="/api")
app.include_router(companies.router, prefix="/api")
app.include_router(alerts.router,    prefix="/api")
app.include_router(auth.router,      prefix="/api")
app.include_router(posts.router,     prefix="/api")
app.include_router(drive.router,     prefix="/api")
app.include_router(work_logs.router, prefix="/api")
app.include_router(maintenance.router, prefix="/api")
app.include_router(ops.router, prefix="/api")
app.include_router(activity.router, prefix="/api")

# 환율 API (exchangerate-api.com 사용)
@app.get("/api/exchange-rate")
async def get_exchange_rate():
    global exchange_rate_cache

    # 캐시가 있고 1시간 이내면 캐시 반환
    if exchange_rate_cache["rate"] and exchange_rate_cache["updated"]:
        if datetime.now() - exchange_rate_cache["updated"] < timedelta(hours=1):
            return {"rate": exchange_rate_cache["rate"], "cached": True}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("https://api.exchangerate-api.com/v4/latest/USD")
            if response.status_code == 200:
                data = response.json()
                rate = data["rates"].get("KRW")
                if rate:
                    exchange_rate_cache["rate"] = round(rate, 2)
                    exchange_rate_cache["updated"] = datetime.now()
                    return {"rate": round(rate, 2), "cached": False}

        return {"rate": exchange_rate_cache.get("rate", 1400), "cached": True, "fallback": True}
    except Exception as e:
        print(f"환율 조회 실패: {e}")
        return {"rate": exchange_rate_cache.get("rate", 1400), "cached": True, "error": str(e)}

# Sales Pipeline 통계 (DB 직접 조회)
@app.get("/api/sales-stats")
def get_sales_stats(year: int = 2026):
    try:
        conn = pymysql.connect(
            host=PIPELINE_DB_HOST,
            user=PIPELINE_DB_USER,
            password=PIPELINE_DB_PASSWORD,
            database=PIPELINE_DB_NAME,
            charset="utf8mb4",
            cursorclass=DictCursor
        )
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(DISTINCT id) as total_projects,
                    COALESCE(SUM(order_amount), 0) as total_order_amount
                FROM projects
                WHERE year = %s
            """, (year,))
            result = cur.fetchone()
        conn.close()
        return {
            "total_projects": result["total_projects"],
            "total_order_amount": float(result["total_order_amount"])
        }
    except Exception as e:
        print(f"Sales stats 조회 실패: {e}")
        return {"total_order_amount": 0, "error": str(e)}

STATIC_DIR = os.path.join(os.path.dirname(__file__), "../frontend/dist")
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=f"{STATIC_DIR}/assets"), name="assets")

    @app.get("/logo.png")
    def serve_logo():
        logo_path = os.path.join(STATIC_DIR, "logo.png")
        if os.path.exists(logo_path):
            return FileResponse(logo_path, media_type="image/png")
        return FileResponse(f"{STATIC_DIR}/index.html")

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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
