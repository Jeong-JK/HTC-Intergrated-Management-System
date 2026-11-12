"""권한 확인 테스트 — DB 연결을 막아 두고 실제 라우터만 붙여서 돌림 (실제 데이터 안 건드림)
실행: cd sales-app/backend && python3 test_permissions.py
결과 "DB" = 권한 확인을 통과해 DB 단계까지 갔다는 뜻
"""
import pymysql


class DBBlocked(Exception):
    pass


def blocked(*a, **k):
    raise DBBlocked


pymysql.connect = blocked  # 혹시 놓친 경로가 있어도 DB에 못 닿게

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from routers import projects, weekly, purchases, sheets

for m in (projects, weekly, purchases, sheets):
    m.db_cursor = blocked

USERS = {
    "admin": {"id": 1, "is_admin": True},
    "staff": {"id": 2, "is_admin": False},
    "pm": {"id": 3, "is_admin": False, "can_delete_project": True},
}

# main.py의 AuthMiddleware 대신: 헤더로 받은 사용자를 request.state.user에 넣음
app = FastAPI()


@app.middleware("http")
async def fake_auth(request: Request, call_next):
    who = request.headers.get("x-test-user")
    if who:
        request.state.user = USERS[who]
    return await call_next(request)


for m in (projects, weekly, purchases, sheets):
    app.include_router(m.router, prefix="/api")
client = TestClient(app)

CASES = [
    ("DELETE", "/api/projects/999999999", None, 401),
    ("DELETE", "/api/projects/999999999", "staff", 403),
    ("DELETE", "/api/projects/999999999", "pm", "DB"),
    ("DELETE", "/api/projects/999999999", "admin", "DB"),
    ("DELETE", "/api/weekly/999999999", "pm", 403),  # 프로젝트 삭제 권한만 있음
    ("DELETE", "/api/weekly/999999999", "admin", "DB"),
    # 매입: 예전엔 권한 확인이 없었음
    ("PUT", "/api/purchases/999999999", "staff", 403),
    ("PUT", "/api/purchases/999999999", "admin", "DB"),
    ("DELETE", "/api/purchases/999999999", "staff", 403),
    ("DELETE", "/api/purchases/999999999", "admin", "DB"),
    # 시트 → DB 동기화는 관리자만 (관리자는 실제 구글 시트를 부르므로 여기선 안 돌림)
    ("POST", "/api/sheets/sync", "staff", 403),
    ("POST", "/api/sheets/sync", "pm", 403),
]


def hit(method, url, who):
    headers = {"x-test-user": who} if who else {}
    try:
        body = {} if method in ("PUT", "POST") else None  # 빈 본문: 칸이 전부 선택인 수정 요청
        return client.request(method, url, headers=headers, json=body).status_code
    except DBBlocked:
        return "DB"


def test_permissions():
    fails = []
    for method, url, who, want in CASES:
        got = hit(method, url, who)
        print(f"{'OK  ' if got == want else 'FAIL'} {method} {url} [{who or '비로그인'}] → {got} (기대 {want})")
        if got != want:
            fails.append((method, url, who))
    assert not fails, fails


if __name__ == "__main__":
    test_permissions()
    print("전부 통과")
