"""HTC Inventory — Auth Router (DB Session)"""
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
from typing import Optional
import hashlib
import secrets
import json
from database import db_cursor

# 세션 만료 시간 (1시간)
SESSION_TIMEOUT_HOURS = 1

router = APIRouter(tags=["auth"])

def hash_password(password: str) -> str:
    """SHA-256 hash for password"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

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

class ProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None

# 권한 필드 목록
PERMISSION_FIELDS = [
    'can_delete', 'can_access_sales', 'can_edit_purchase', 'can_delete_purchase',
    'can_edit_project', 'can_delete_project', 'can_edit_weekly', 'can_delete_weekly',
    'can_add_company', 'can_edit_company', 'can_delete_company',
    'can_view_meeting', 'can_add_meeting', 'can_delete_meeting', 'can_edit_contact', 'can_transfer_contact'
]

# ========== Auth Endpoints ==========
@router.post("/auth/login")
def login(req: LoginRequest, response: Response):
    """Login and create session"""
    with db_cursor() as cur:
        cur.execute(
            "SELECT * FROM users WHERE user_id = %s",
            (req.user_id,)
        )
        user = cur.fetchone()

    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 틀렸습니다")

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
    session_token = request.cookies.get("session_token")
    session = get_session(session_token)

    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")

    if not session['is_admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")

    # 권한 필드 포함하여 조회
    permission_cols = ', '.join(PERMISSION_FIELDS)
    with db_cursor() as cur:
        cur.execute(f"SELECT id, user_id, name, position, email, phone, is_admin, {permission_cols}, created_at FROM users ORDER BY id")
        users = cur.fetchall()

    return {"users": users}

@router.post("/auth/users")
def create_user(user: UserCreate, request: Request):
    """Create new user (admin only)"""
    session_token = request.cookies.get("session_token")
    session = get_session(session_token)

    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")

    if not session['is_admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")

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
    session_token = request.cookies.get("session_token")
    session = get_session(session_token)

    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")

    if not session['is_admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")

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
    session_token = request.cookies.get("session_token")
    session = get_session(session_token)

    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")

    current_user = session
    user_id = current_user['id']

    updates = []
    values = []

    if data.email is not None:
        updates.append("email = %s")
        values.append(data.email)

    if data.phone is not None:
        updates.append("phone = %s")
        values.append(data.phone)

    if data.password is not None:
        updates.append("password_hash = %s")
        values.append(hash_password(data.password))

    if not updates:
        return {"success": True, "message": "변경사항이 없습니다"}

    values.append(user_id)

    with db_cursor() as cur:
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", values)

    return {"success": True, "message": "프로필이 수정되었습니다"}

@router.delete("/auth/users/{user_id}")
def delete_user(user_id: int, request: Request):
    """Delete user (admin only)"""
    session_token = request.cookies.get("session_token")
    session = get_session(session_token)

    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")

    current_user = session

    if not current_user['is_admin']:
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")

    if current_user['id'] == user_id:
        raise HTTPException(status_code=400, detail="자기 자신은 삭제할 수 없습니다")

    with db_cursor() as cur:
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))

    return {"success": True, "message": "사용자가 삭제되었습니다"}
