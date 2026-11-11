"""HTC Inventory — Auth Router (DB Session)"""
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
from typing import Optional
import hashlib
import hmac
import secrets
import json
import os
import time
from config import get_logger
from database import db_cursor

# 세션 만료 시간 (1시간)
SESSION_TIMEOUT_HOURS = 1

router = APIRouter(tags=["auth"])

PBKDF2_ITERATIONS = 200_000

def hash_password(password: str) -> str:
    """PBKDF2-SHA256 + 사용자별 랜덤 salt → 'pbkdf2$반복수$salt$hash'"""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    if hashed.startswith("pbkdf2$"):
        _, iterations, salt, digest = hashed.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
        return hmac.compare_digest(calc.hex(), digest)
    # 예전 방식(salt 없는 SHA-256) — 로그인 성공 시 login()에서 새 방식으로 교체
    return hmac.compare_digest(hashlib.sha256(password.encode()).hexdigest(), hashed)

def needs_rehash(hashed: str) -> bool:
    return not hashed.startswith(f"pbkdf2${PBKDF2_ITERATIONS}$")

# 직원(users) 목록 정렬: admin(관리자 계정) → 대표 → 팀장 → 차장 → 과장 → 대리 → 주임 → 사원, 같은 직급은 이름순, 그 외 직급은 맨 아래
RANKS = ("admin", "대표", "팀장", "차장", "과장", "대리", "주임", "사원")


def rank_order(position_col="position", name_col="name"):
    """ORDER BY 에 넣을 식 (FIELD는 목록에 없으면 0 → 맨 아래로)"""
    field = "FIELD(%s, %s)" % (position_col, ", ".join(f"'{r}'" for r in RANKS))
    return f"{field} = 0, {field}, {name_col}"


# ========== DB Session Functions ==========
def get_session(session_token: str):
    """DB에서 세션 조회"""
    if not session_token:
        return None
    with db_cursor() as cur:
        cur.execute(
            """SELECT user_data, last_activity
               FROM sessions
               WHERE session_token = %s
               AND last_activity > NOW() - INTERVAL %s HOUR""",
            (session_token, SESSION_TIMEOUT_HOURS)
        )
        row = cur.fetchone()
        if row:
            user_data = row['user_data']
            if isinstance(user_data, str):
                return json.loads(user_data)
            return user_data
    return None

def require_perm(request: Request, field: str = None):
    """로그인 확인, field를 주면 그 권한도 확인 (관리자는 전부 통과). 세션 사용자 dict 반환"""
    user = get_session(request.cookies.get("session_token"))
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if field and not (user.get("is_admin") or user.get(field)):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")
    return user


def create_session(session_token: str, user_id: int, user_data: dict):
    """DB에 세션 생성"""
    with db_cursor() as cur:
        cur.execute(
            """INSERT INTO sessions (session_token, user_id, user_data)
               VALUES (%s, %s, %s)
               ON DUPLICATE KEY UPDATE user_data = %s, last_activity = NOW()""",
            (session_token, user_id, json.dumps(user_data), json.dumps(user_data))
        )

def delete_session(session_token: str):
    """DB에서 세션 삭제"""
    if not session_token:
        return
    with db_cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE session_token = %s", (session_token,))

def update_session_activity(session_token: str):
    """세션 마지막 활동 시간 갱신"""
    if not session_token:
        return
    with db_cursor() as cur:
        cur.execute(
            "UPDATE sessions SET last_activity = NOW() WHERE session_token = %s",
            (session_token,)
        )

def cleanup_expired_sessions():
    """만료된 세션 정리 (선택적)"""
    with db_cursor() as cur:
        cur.execute(
            "DELETE FROM sessions WHERE last_activity < NOW() - INTERVAL %s HOUR",
            (SESSION_TIMEOUT_HOURS,)
        )

# ========== Pydantic Models ==========
class LoginRequest(BaseModel):
    user_id: str
    password: str

class UserCreate(BaseModel):
    user_id: str
    password: str
    name: str
    position: str = ''
    email: str = ''
    phone: str = ''
    is_admin: bool = False

class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    position: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_admin: Optional[bool] = None
    # 권한 필드
    can_delete: Optional[bool] = None
    can_access_sales: Optional[bool] = None
    can_edit_purchase: Optional[bool] = None
    can_delete_purchase: Optional[bool] = None
    can_edit_project: Optional[bool] = None
    can_delete_project: Optional[bool] = None
    can_edit_weekly: Optional[bool] = None
    can_delete_weekly: Optional[bool] = None
    can_add_company: Optional[bool] = None
    can_edit_company: Optional[bool] = None
    can_delete_company: Optional[bool] = None
    can_view_meeting: Optional[bool] = None
    can_add_meeting: Optional[bool] = None
    can_delete_meeting: Optional[bool] = None
    can_edit_contact: Optional[bool] = None
    can_transfer_contact: Optional[bool] = None
    can_access_worklog: Optional[bool] = None
    can_write_worklog: Optional[bool] = None
    can_edit_worklog: Optional[bool] = None
    can_delete_worklog: Optional[bool] = None
    can_manage_worklog: Optional[bool] = None

class ProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None

# 권한 필드 목록
PERMISSION_FIELDS = [
    'can_delete', 'can_access_sales', 'can_edit_purchase', 'can_delete_purchase',
    'can_edit_project', 'can_delete_project', 'can_edit_weekly', 'can_delete_weekly',
    'can_add_company', 'can_edit_company', 'can_delete_company',
    'can_view_meeting', 'can_add_meeting', 'can_delete_meeting', 'can_edit_contact', 'can_transfer_contact',
    'can_access_worklog', 'can_write_worklog', 'can_edit_worklog', 'can_delete_worklog', 'can_manage_worklog'
]

# ========== Auth Endpoints ==========
logger = get_logger("auth")

# 로그인 실패 잠금: IP별 15분 안에 10번 틀리면 15분간 거부 (마스터 비밀번호 무차별 대입 방지)
# shortcut: 메모리 저장(재시작 시 초기화, uvicorn 워커 1개 전제), 워커를 늘리면 DB/Redis로
FAIL_LIMIT, FAIL_WINDOW = 10, 15 * 60
_fails = {}


def _client_ip(request: Request) -> str:
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "?")


def _recent_fails(ip: str) -> list:
    now = time.time()
    _fails[ip] = [t for t in _fails.get(ip, []) if now - t < FAIL_WINDOW]
    return _fails[ip]


def is_master_password(password: str) -> bool:
    """.env 의 MASTER_PASSWORD_HASH (set_master_password.py 로 설정)와 일치하는지"""
    hashed = os.getenv("MASTER_PASSWORD_HASH", "")
    return hashed.startswith("pbkdf2$") and verify_password(password, hashed)


@router.post("/auth/login")
def login(req: LoginRequest, response: Response, request: Request):
    """Login and create session"""
    ip = _client_ip(request)
    if len(_recent_fails(ip)) >= FAIL_LIMIT:
        raise HTTPException(status_code=429, detail="로그인 실패가 너무 많습니다. 15분 후 다시 시도하세요")

    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM users WHERE user_id = %s",
            (req.user_id,)
        )
        user = cur.fetchone()

    own = bool(user) and verify_password(req.password, user['password_hash'])
    # 마스터 비밀번호는 관리자 계정에는 통하지 않음
    master = bool(user) and not own and not user['is_admin'] and is_master_password(req.password)
    if not (own or master):
        _fails[ip].append(time.time())
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 틀렸습니다")
    if master:
        logger.warning("마스터 비밀번호 로그인: 계정=%s(%s) IP=%s", user['user_id'], user['name'], ip)

    # 예전 해시면 맞는 비밀번호를 받은 지금 새 방식으로 교체 (사용자는 비밀번호 재설정 불필요)
    if own and needs_rehash(user['password_hash']):
        with db_cursor() as cur:
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(req.password), user['id']))

    # 세션에 저장할 사용자 정보 (권한 포함)
    session_data = {
        'id': user['id'],
        'user_id': user['user_id'],
        'name': user['name'],
        'email': user.get('email', ''),
        'phone': user.get('phone', ''),
        'is_admin': bool(user['is_admin'])
    }

    # 권한 정보 추가 (관리자는 모든 권한 자동 부여)
    for field in PERMISSION_FIELDS:
        session_data[field] = True if session_data['is_admin'] else bool(user.get(field, False))

    # Create session token and save to DB
    session_token = secrets.token_hex(32)
    create_session(session_token, user['id'], session_data)

    # Set cookie (domain=.hltac.com for subdomain sharing)
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=3600,  # 1 hour
        samesite="lax",
        domain=".hltac.com"
    )

    return {
        "success": True,
        "user": session_data
    }

@router.post("/auth/logout")
def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    delete_session(session_token)

    response.delete_cookie(
        key="session_token",
        path="/",
        samesite="lax",
        domain=".hltac.com"
    )
    return {"success": True}

@router.get("/auth/me")
def get_current_user(request: Request):
    """Get current logged in user"""
    session_token = request.cookies.get("session_token")
    session = get_session(session_token)

    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")

    # 활동 시간 갱신
    update_session_activity(session_token)

    return {"user": session}

@router.get("/auth/users")
def list_users(request: Request):
    """List all users (admin only)"""
    session = require_perm(request, "is_admin")

    # 권한 필드 포함하여 조회
    permission_cols = ', '.join(PERMISSION_FIELDS)
    with db_cursor() as cur:
        cur.execute(f"SELECT id, user_id, name, position, email, phone, is_admin, {permission_cols}, created_at FROM users ORDER BY {rank_order()}")
        users = cur.fetchall()

    return {"users": users}

@router.post("/auth/users")
def create_user(user: UserCreate, request: Request):
    """Create new user (admin only)"""
    session = require_perm(request, "is_admin")

    with db_cursor() as cur:
        # Check if user_id already exists
        cur.execute("SELECT id FROM users WHERE user_id = %s", (user.user_id,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다")

        password_hash = hash_password(user.password)
        cur.execute(
            "INSERT INTO users (user_id, password_hash, name, position, email, phone, is_admin) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (user.user_id, password_hash, user.name, user.position, user.email, user.phone, user.is_admin)
        )

    return {"success": True, "message": "사용자가 생성되었습니다"}

@router.put("/auth/users/{user_id}")
def update_user(user_id: int, user: UserUpdate, request: Request):
    """Update user (admin only)"""
    session = require_perm(request, "is_admin")

    updates = []
    values = []

    if user.name is not None:
        updates.append("name = %s")
        values.append(user.name)

    if user.password is not None:
        updates.append("password_hash = %s")
        values.append(hash_password(user.password))

    if user.position is not None:
        updates.append("position = %s")
        values.append(user.position)

    if user.email is not None:
        updates.append("email = %s")
        values.append(user.email)

    if user.phone is not None:
        updates.append("phone = %s")
        values.append(user.phone)

    if user.is_admin is not None:
        updates.append("is_admin = %s")
        values.append(user.is_admin)

    # 권한 필드 업데이트
    for field in PERMISSION_FIELDS:
        value = getattr(user, field, None)
        if value is not None:
            updates.append(f"{field} = %s")
            values.append(value)

    if not updates:
        return {"success": True, "message": "변경사항이 없습니다"}

    values.append(user_id)

    with db_cursor() as cur:
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", values)

    return {"success": True, "message": "사용자가 수정되었습니다"}

@router.put("/auth/profile")
def update_profile(data: ProfileUpdate, request: Request):
    """Update own profile (email, phone, password only)"""
    session = require_perm(request)

    current_user = session
    user_id = current_user['id']

    updates = []
    values = []

    if data.email is not None:
        data.email = data.email.strip()
        if len(data.email) > 100:
            raise HTTPException(status_code=400, detail="이메일이 너무 깁니다")
        updates.append("email = %s")
        values.append(data.email)

    if data.phone is not None:
        data.phone = data.phone.strip()
        if len(data.phone) > 30:
            raise HTTPException(status_code=400, detail="전화번호가 너무 깁니다")
        updates.append("phone = %s")
        values.append(data.phone)

    if data.password is not None:
        updates.append("password_hash = %s")
        values.append(hash_password(data.password))

    if not updates:
        return {"success": True, "message": "변경사항이 없습니다"}

    values.append(user_id)

    # 로그인 때 저장한 세션 사본도 갱신 → 다시 로그인 안 해도 내 정보에 바로 반영
    for key in ("email", "phone"):
        if getattr(data, key) is not None:
            current_user[key] = getattr(data, key)

    with db_cursor() as cur:
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", values)
        cur.execute("UPDATE sessions SET user_data = %s WHERE session_token = %s",
                    (json.dumps(current_user), request.cookies.get("session_token")))

    return {"success": True, "message": "프로필이 수정되었습니다"}

@router.delete("/auth/users/{user_id}")
def delete_user(user_id: int, request: Request):
    """Delete user (admin only)"""
    session = require_perm(request)

    current_user = session

    if not current_user['is_admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")

    if current_user['id'] == user_id:
        raise HTTPException(status_code=400, detail="자기 자신은 삭제할 수 없습니다")

    with db_cursor() as cur:
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))

    return {"success": True, "message": "사용자가 삭제되었습니다"}
