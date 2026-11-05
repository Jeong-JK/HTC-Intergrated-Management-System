"""권한 확인 테스트 — DB 연결을 막아 두고 돌림 (실제 데이터 안 건드림)
실행: cd inventory-app/backend && python3 test_permissions.py
결과 "DB" = 권한 확인을 통과해 DB 단계까지 갔다는 뜻
"""
import pymysql


class DBBlocked(Exception):
    pass


def blocked(*a, **k):
    raise DBBlocked


pymysql.connect = blocked  # 혹시 놓친 경로가 있어도 DB에 못 닿게

from fastapi.testclient import TestClient

import main
from routers import auth, delivery, items, posts, rental, work_logs

for m in (auth, delivery, items, posts, rental, work_logs):
    m.db_cursor = blocked

USERS = {
    "admin": {"id": 1, "is_admin": True},
    "staff": {"id": 2, "is_admin": False},
    "deleter": {"id": 3, "is_admin": False, "can_delete": True},
    "writer": {"id": 4, "is_admin": False, "can_access_worklog": True},
}
auth.get_session = USERS.get  # 쿠키값 = USERS 키

client = TestClient(main.app)

CASES = [
    ("DELETE", "/api/rentals/999999999", None, 401),
    ("DELETE", "/api/rentals/999999999", "staff", 403),
    ("DELETE", "/api/rentals/999999999", "deleter", "DB"),
    ("DELETE", "/api/rentals/999999999", "admin", "DB"),
    ("DELETE", "/api/items/999999999", "staff", 403),
    ("DELETE", "/api/items/999999999", "deleter", "DB"),
    ("DELETE", "/api/deliveries/999999999", "staff", 403),
    ("GET", "/api/auth/users", None, 401),
    ("GET", "/api/auth/users", "staff", 403),
    ("GET", "/api/auth/users", "admin", "DB"),
    ("GET", "/api/drive/files", None, 401),
    ("GET", "/api/drive/files", "deleter", 403),
    ("GET", "/api/posts", None, 401),
    ("GET", "/api/posts", "staff", "DB"),
    ("GET", "/api/work-logs/users", "staff", 403),   # 업무일지 접근권한 없음
    ("GET", "/api/work-logs/users", "writer", 403),  # 접근만 있고 관리 권한 없음
    ("GET", "/api/work-logs/users", "admin", "DB"),
    ("GET", "/api/work-logs/search?q=x", "staff", 403),   # 업무일지 접근권한 없음
    ("GET", "/api/work-logs/search?q=x", "writer", "DB"), # 접근권한만 있어도 본인 것 검색 가능
]


def hit(method, url, who):
    headers = {"cookie": f"session_token={who}"} if who else {}
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
