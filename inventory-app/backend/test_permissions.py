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
from routers import auth, delivery, items, maintenance, posts, rental, work_logs

for m in (auth, delivery, items, maintenance, posts, rental, work_logs):
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
    ("GET", "/api/maintenance", None, 401),
    ("PUT", "/api/maintenance/sales", "staff", 403),
]


def hit(method, url, who):
    headers = {"cookie": f"session_token={who}"} if who else {}
    try:
        body = {"locked": False} if method == "PUT" else None  # PUT은 본문 형식 검사가 권한보다 먼저라
        return client.request(method, url, headers=headers, json=body).status_code
    except DBBlocked:
        return "DB"


def test_maintenance_lock():
    """잠금 중: 관리자/허용 사용자(writer, id 4)만 통과, 다른 도메인(ims)은 영향 없음"""
    maintenance.load_rows = lambda: {"inventory": {"locked": True, "allowed_user_ids": [4]},
                                     "sales": {"locked": True, "allowed_user_ids": []}}
    def get(url, who, host="inv.hltac.com"):
        try:
            r = client.get(url, headers={"cookie": f"session_token={who}", "host": host})
        except DBBlocked:
            return "DB", None  # 점검 검사 통과 후 실제 API(DB)까지 감
        return r.status_code, r.json().get("detail") if r.status_code == 423 else None
    cases = [
        (("/api/items/constants", "staff"), (423, maintenance.LOCK_MESSAGE)),
        (("/api/items/constants", "admin"), (200, None)),
        (("/api/items/constants", "writer"), (200, None)),            # 허용 사용자
        (("/api/items/constants", "staff", "ims.hltac.com"), (200, None)),  # 허브 도메인은 안 막음
        (("/api/auth/me?app=sales", "staff", "localhost:8000"), (423, maintenance.LOCK_MESSAGE)),  # sales 미들웨어 경로
        (("/api/auth/me?app=crm", "staff", "localhost:8000"), ("DB", None)),  # crm은 안 잠김 → 통과
    ]
    fails = []
    for args, want in cases:
        got = get(*args)
        print(f"{'OK  ' if got == want else 'FAIL'} 점검모드 {args} → {got[0]} (기대 {want[0]})")
        if got != want:
            fails.append(args)
    assert not fails, fails


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
    test_maintenance_lock()
    print("전부 통과")
