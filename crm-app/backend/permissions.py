"""라우터 공통 권한 확인 — 사용자 정보는 main.py의 AuthMiddleware가 request.state.user에 넣어 둠"""
from fastapi import HTTPException, Request


def require_perm(request: Request, field: str = None):
    """로그인 확인, field를 주면 그 권한도 확인 (관리자는 전부 통과). 사용자 dict 반환"""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if field and not (user.get("is_admin") or user.get(field)):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")
    return user
