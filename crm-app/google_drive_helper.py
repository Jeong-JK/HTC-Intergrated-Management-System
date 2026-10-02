"""
google_drive_helper.py
──────────────────────
HTC Partner CRM — Google Drive OAuth2 연동 모듈

사용법:
  1. Google Cloud Console에서 OAuth2 클라이언트 ID 생성 후 JSON 다운로드
  2. 파일을 앱 폴더에 'htc_oauth_client.json' 으로 저장
  3. 앱 실행 시 자동으로 브라우저 구글 로그인 창이 열림
  4. 로그인 후 토큰은 'htc_token.json' 에 자동 저장 (이후 자동 로그인)

Cloud Console 설정:
  - API 및 서비스 → 라이브러리 → Google Drive API 사용 설정
  - API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 만들기
  - 애플리케이션 유형: '데스크톱 앱' 선택
  - 생성된 클라이언트 JSON 다운로드 → 'htc_oauth_client.json' 으로 저장

필요 패키지:
  pip install google-api-python-client google-auth google-auth-httplib2 google-auth-oauthlib
"""

import os
import sys
import mimetypes
import webbrowser
from pathlib import Path

# ── 설정 ────────────────────────────────────────────────────
# 앱 실행 폴더 기준으로 파일 경로 고정 (PyInstaller exe 대응)
def _app_dir() -> str:
    if hasattr(sys, '_MEIPASS'):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

OAUTH_CLIENT_FILE = os.path.join(_app_dir(), "htc_oauth_client.json")
TOKEN_FILE        = os.path.join(_app_dir(), "htc_token.json")

# 업로드 루트 경로: 공유드라이브 내 '통신사업팀/HTC_CRM/' 폴더
SHARED_DRIVE_NAME = "통신사업팀"               # 공유 드라이브 이름 (정확히 일치해야 함)
ROOT_FOLDER_PATH  = ["통신사업팀", "HTC_CRM"]  # 루트까지의 폴더 경로 (순서대로)

SCOPES = ["https://www.googleapis.com/auth/drive"]
# ────────────────────────────────────────────────────────────

_drive_service  = None
_root_folder_id = None   # 캐시: 'HTC_CRM' 폴더 ID


# ────────────────────────────────────────────────────────────
# 인증
# ────────────────────────────────────────────────────────────

def login() -> bool:
    """
    OAuth2 로그인 수행.
    - 토큰 캐시(htc_token.json)가 있으면 자동 로그인
    - 없거나 만료되면 브라우저 로그인 팝업
    반환: 성공 True / 실패 시 RuntimeError
    """
    global _drive_service

    try:
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build

        creds = None

        # 저장된 토큰 로드
        if os.path.exists(TOKEN_FILE):
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

        # 토큰 없거나 만료 → 재로그인
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(OAUTH_CLIENT_FILE):
                    raise FileNotFoundError(
                        f"OAuth 클라이언트 파일을 찾을 수 없습니다.\n"
                        f"앱 폴더에 '{OAUTH_CLIENT_FILE}' 파일을 넣어주세요.\n\n"
                        f"Google Cloud Console → API 및 서비스 → 사용자 인증 정보\n"
                        f"→ OAuth 2.0 클라이언트 ID (데스크톱 앱) → JSON 다운로드"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(OAUTH_CLIENT_FILE, SCOPES)
                creds = flow.run_local_server(port=0, open_browser=True)

            # 토큰 저장
            with open(TOKEN_FILE, "w") as f:
                f.write(creds.to_json())

        _drive_service = build("drive", "v3", credentials=creds, cache_discovery=False)
        return True

    except FileNotFoundError as e:
        raise RuntimeError(str(e))
    except Exception as e:
        raise RuntimeError(f"Google Drive 로그인 실패: {e}")


def logout():
    """로그아웃: 토큰 파일 삭제 및 서비스 초기화"""
    global _drive_service, _root_folder_id
    _drive_service  = None
    _root_folder_id = None
    if os.path.exists(TOKEN_FILE):
        os.remove(TOKEN_FILE)


def is_logged_in() -> bool:
    """현재 로그인 상태 확인"""
    return _drive_service is not None


def is_configured() -> bool:
    """OAuth 클라이언트 파일 존재 여부 확인"""
    return os.path.exists(OAUTH_CLIENT_FILE)


def _get_service():
    """서비스 객체 반환 (로그인 필수)"""
    if _drive_service is None:
        raise RuntimeError("Google Drive에 로그인되어 있지 않습니다.")
    return _drive_service


# ────────────────────────────────────────────────────────────
# 폴더 탐색 / 생성
# ────────────────────────────────────────────────────────────

def _find_shared_drive_id(name: str):
    """이름으로 공유 드라이브 ID 조회. 없으면 None 반환."""
    service = _get_service()
    result = service.drives().list(pageSize=50, fields="drives(id,name)").execute()
    for d in result.get("drives", []):
        if d["name"] == name:
            return d["id"]
    return None


def _get_or_create_folder(folder_name: str, parent_id: str, drive_id=None) -> str:
    """parent_id 아래에 folder_name 폴더가 없으면 생성, 있으면 기존 ID 반환"""
    service = _get_service()

    list_kwargs = dict(
        q=(
            f"name='{folder_name}' "
            f"and '{parent_id}' in parents "
            f"and mimeType='application/vnd.google-apps.folder' "
            f"and trashed=false"
        ),
        fields="files(id,name)",
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
    )
    if drive_id:
        list_kwargs["driveId"] = drive_id
        list_kwargs["corpora"] = "drive"

    results = service.files().list(**list_kwargs).execute()
    files = results.get("files", [])
    if files:
        return files[0]["id"]

    meta = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    }
    folder = service.files().create(
        body=meta, fields="id", supportsAllDrives=True
    ).execute()
    return folder["id"]


def _get_root_folder_id() -> str:
    """
    '통신사업팀/HTC_CRM/' 폴더 ID를 반환 (캐시)
    공유 드라이브 → 통신사업팀 → HTC_CRM 순서로 탐색/생성
    공유 드라이브가 없으면 내 드라이브에 HTC_CRM 폴더 생성
    """
    global _root_folder_id
    if _root_folder_id:
        return _root_folder_id

    drive_id = _find_shared_drive_id(SHARED_DRIVE_NAME)

    if drive_id:
        # 공유 드라이브 내 HTC_CRM 폴더 탐색/생성
        # ROOT_FOLDER_PATH[0] == "통신사업팀" 은 드라이브 자체이므로 스킵
        current_id = drive_id
        for folder_name in ROOT_FOLDER_PATH[1:]:
            current_id = _get_or_create_folder(folder_name, current_id, drive_id)
    else:
        # 공유 드라이브 없음 → 내 드라이브에 전체 경로 생성
        current_id = "root"
        for folder_name in ROOT_FOLDER_PATH:
            current_id = _get_or_create_folder(folder_name, current_id)

    _root_folder_id = current_id
    return _root_folder_id


# ────────────────────────────────────────────────────────────
# 파일 업로드 / 삭제
# ────────────────────────────────────────────────────────────

def upload_file(
    local_path: str,
    company_name: str,
    team_name: str,
    contact_name: str,
) -> dict:
    """
    파일을 Drive에 업로드하고 {'file_id', 'file_name', 'web_view_link'} 반환

    Drive 폴더 구조:
      통신사업팀/HTC_CRM/
        └─ {company_name}/
              └─ {team_name}/
                    └─ {contact_name}/
                          └─ 파일.jpg
    """
    service = _get_service()
    root_id  = _get_root_folder_id()
    drive_id = _find_shared_drive_id(SHARED_DRIVE_NAME)

    company_folder_id = _get_or_create_folder(company_name,  root_id,           drive_id)
    team_folder_id    = _get_or_create_folder(team_name,     company_folder_id, drive_id)
    contact_folder_id = _get_or_create_folder(contact_name,  team_folder_id,    drive_id)

    file_name = os.path.basename(local_path)
    mime_type, _ = mimetypes.guess_type(local_path)
    mime_type = mime_type or "application/octet-stream"

    from googleapiclient.http import MediaFileUpload
    media    = MediaFileUpload(local_path, mimetype=mime_type, resumable=True)
    meta     = {"name": file_name, "parents": [contact_folder_id]}
    uploaded = service.files().create(
        body=meta,
        media_body=media,
        fields="id,name,webViewLink",
        supportsAllDrives=True,
    ).execute()

    return {
        "file_id":       uploaded["id"],
        "file_name":     uploaded["name"],
        "web_view_link": uploaded.get("webViewLink", ""),
    }


def delete_file(file_id: str) -> bool:
    """Drive에서 파일 삭제. 성공 시 True."""
    try:
        _get_service().files().delete(
            fileId=file_id, supportsAllDrives=True
        ).execute()
        return True
    except Exception:
        return False


# ────────────────────────────────────────────────────────────
# 유틸
# ────────────────────────────────────────────────────────────

def get_contact_folder_url(company_name: str, team_name: str, contact_name: str) -> str:
    """
    담당자 폴더의 드라이브 URL 반환.
    폴더가 없으면 빈 문자열 반환 (생성은 하지 않음).
    """
    try:
        root_id  = _get_root_folder_id()
        drive_id = _find_shared_drive_id(SHARED_DRIVE_NAME)

        def _find_folder(name, parent_id):
            service = _get_service()
            kwargs = dict(
                q=(f"name='{name}' and '{parent_id}' in parents "
                   f"and mimeType='application/vnd.google-apps.folder' and trashed=false"),
                fields="files(id)",
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            )
            if drive_id:
                kwargs["driveId"] = drive_id
                kwargs["corpora"]  = "drive"
            res = service.files().list(**kwargs).execute()
            files = res.get("files", [])
            return files[0]["id"] if files else None

        company_id = _find_folder(company_name, root_id)
        if not company_id:
            return ""
        team_id = _find_folder(team_name, company_id)
        if not team_id:
            return ""
        contact_id = _find_folder(contact_name, team_id)
        if not contact_id:
            return ""

        return f"https://drive.google.com/drive/folders/{contact_id}"
    except Exception:
        return ""


def open_in_browser(web_view_link: str):
    """기본 브라우저로 Drive 파일 링크 열기"""
    if web_view_link:
        webbrowser.open(web_view_link)


def get_file_icon(file_name: str) -> str:
    """파일 확장자에 따른 이모지 아이콘 반환"""
    ext = Path(file_name).suffix.lower()
    icons = {
        ".jpg": "🖼", ".jpeg": "🖼", ".png": "🖼", ".gif": "🖼", ".webp": "🖼", ".bmp": "🖼",
        ".pdf": "📄",
        ".doc": "📝", ".docx": "📝",
        ".xls": "📊", ".xlsx": "📊",
        ".ppt": "📑", ".pptx": "📑",
        ".zip": "🗜", ".rar": "🗜", ".7z": "🗜",
        ".mp4": "🎬", ".mov": "🎬", ".avi": "🎬",
        ".mp3": "🎵", ".wav": "🎵",
    }
    return icons.get(ext, "📎")