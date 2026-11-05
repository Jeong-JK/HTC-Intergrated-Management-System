"""권한 확인 테스트 — DB 연결을 막아 두고 실제 라우터만 붙여서 돌림 (실제 데이터 안 건드림)
실행: cd crm-app/backend && python3 test_permissions.py
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

from routers import crm_companies, meetings, teams

for m in (crm_companies, meetings, teams):
    m.sales_db_cursor = blocked

USERS = {
    "admin": {"id": 1, "is_admin": True},
    "staff": {"id": 2, "is_admin": False},
    "viewer": {"id": 3, "is_admin": False, "can_view_meeting": True},
    "editor": {"id": 4, "is_admin": False, "can_delete_company": True},
}

# main.py의 AuthMiddleware 대신: 헤더로 받은 사용자를 request.state.user에 넣음
app = FastAPI()


@app.middleware("http")
async def fake_auth(request: Request, call_next):
    who = request.headers.get("x-test-user")
    if who:
        request.state.user = USERS[who]
    return await call_next(request)


for m in (crm_companies, meetings, teams):
    app.include_router(m.router, prefix="/api")
client = TestClient(app)

CASES = [
    ("GET", "/api/meetings", None, 401),
    ("GET", "/api/meetings", "staff", 403),
    ("GET", "/api/meetings", "viewer", "DB"),
    ("DELETE", "/api/meetings/999999999", "viewer", 403),  # 보기만 가능
    ("DELETE", "/api/meetings/999999999", "admin", "DB"),
    ("DELETE", "/api/teams/999999999", "staff", 403),
    ("DELETE", "/api/teams/999999999", "editor", "DB"),
    ("DELETE", "/api/crm/companies/999999999", "viewer", 403),
    ("DELETE", "/api/crm/companies/999999999", "editor", "DB"),
]


def hit(method, url, who):
    headers = {"x-test-user": who} if who else {}
    try:
        return client.request(method, url, headers=headers).status_code
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
