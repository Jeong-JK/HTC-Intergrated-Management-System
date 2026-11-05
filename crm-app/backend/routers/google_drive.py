"""HTC CRM — Google Drive OAuth & Upload Router"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from permissions import require_perm
from fastapi.responses import RedirectResponse, JSONResponse
from typing import Optional
import os
import pickle
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
from google.auth.transport.requests import Request as GoogleRequest
import io

from config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_SCOPES
)

router = APIRouter(prefix="/google", tags=["google-drive"])

# 토큰 저장 디렉토리
TOKEN_DIR = "/home/ec2-user/crm-app/backend/tokens"
os.makedirs(TOKEN_DIR, exist_ok=True)


def get_token_path(user_id: str) -> str:
    """사용자별 토큰 파일 경로"""
    return os.path.join(TOKEN_DIR, f"token_{user_id}.pickle")


def get_flow():
    """OAuth Flow 생성"""
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI]
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )


def get_credentials(user_id: str):
    """저장된 인증 정보 로드"""
    token_path = get_token_path(user_id)
    if not os.path.exists(token_path):
        return None

    with open(token_path, 'rb') as token:
        creds = pickle.load(token)

    # 토큰 갱신 필요시
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        with open(token_path, 'wb') as token:
            pickle.dump(creds, token)

    return creds


def save_credentials(user_id: str, creds):
    """인증 정보 저장"""
    token_path = get_token_path(user_id)
    with open(token_path, 'wb') as token:
        pickle.dump(creds, token)


def find_shared_drive(service, drive_name="통신사업팀"):
    """Shared Drive ID 찾기"""
    try:
        results = service.drives().list(pageSize=50, fields='drives(id,name)').execute()
        drives = results.get('drives', [])
        for drive in drives:
            if drive['name'] == drive_name:
                return drive['id']
        return None
    except Exception:
        return None


def find_or_create_folder(service, folder_name, parent_id, drive_id=None):
    """폴더 찾기 또는 생성"""
    # 기존 폴더 검색
    search_query = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    search_params = {
        'q': search_query,
        'fields': 'files(id,name)',
        'includeItemsFromAllDrives': True,
        'supportsAllDrives': True
    }

    if drive_id:
        search_params['driveId'] = drive_id
        search_params['corpora'] = 'drive'

    results = service.files().list(**search_params).execute()
    files = results.get('files', [])

    if files:
        return files[0]['id']

    # 폴더 생성
    folder_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }

    folder = service.files().create(
        body=folder_metadata,
        fields='id',
        supportsAllDrives=True
    ).execute()

    return folder['id']


async def create_folder_hierarchy(service, company_name, team_name, contact_name):
    """폴더 계층 생성: 통신사업팀/한림퓨리텍 자료/HTC_CRM/Company/Team/Contact"""
    # Shared Drive 찾기
    drive_id = find_shared_drive(service, "통신사업팀")

    if drive_id:
        # Shared Drive의 한림퓨리텍 자료/HTC_CRM 폴더
        parent_id = find_or_create_folder(service, "한림퓨리텍 자료", drive_id, drive_id)
        root_id = find_or_create_folder(service, "HTC_CRM", parent_id, drive_id)
    else:
        # My Drive에 생성
        root_id = find_or_create_folder(service, "통신사업팀", "root", None)
        root_id = find_or_create_folder(service, "한림퓨리텍 자료", root_id, None)
        root_id = find_or_create_folder(service, "HTC_CRM", root_id, None)

    # 회사 폴더
    company_id = find_or_create_folder(service, company_name, root_id, drive_id)

    # 팀 폴더
    team_id = find_or_create_folder(service, team_name, company_id, drive_id)

    # 연락처 폴더
    contact_id = find_or_create_folder(service, contact_name, team_id, drive_id)

    return contact_id


@router.get("/auth")
def google_auth(request: Request):
    """Google OAuth 인증 시작"""
    user = require_perm(request)

    flow = get_flow()

    # PKCE 비활성화를 위해 code_verifier 제거
    flow.code_verifier = None

    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )

    # state를 세션에 저장 (간단하게 쿠키 사용)
    response = RedirectResponse(url=authorization_url)
    response.set_cookie("oauth_state", state, httponly=True, samesite="lax")
    response.set_cookie("oauth_user_id", user.get("user_id", ""), httponly=True, samesite="lax")
    return response


@router.get("/callback")
def google_callback(request: Request, code: str, state: str):
    """Google OAuth 콜백"""
    stored_state = request.cookies.get("oauth_state")
    user_id = request.cookies.get("oauth_user_id")

    if not stored_state or stored_state != state:
        raise HTTPException(400, "Invalid state parameter")

    if not user_id:
        raise HTTPException(400, "User ID not found")

    try:
        # Flow 재생성 및 토큰 교환
        flow = get_flow()
        flow.fetch_token(code=code)
        creds = flow.credentials

        save_credentials(user_id, creds)

        # CRM 페이지로 리다이렉트
        response = RedirectResponse(url="https://crm.hltac.com/", status_code=302)
        response.delete_cookie("oauth_state")
        response.delete_cookie("oauth_user_id")
        return response
    except Exception as e:
        import traceback
        print(f"[ERROR] OAuth callback failed: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(500, f"OAuth error: {str(e)}")


@router.get("/auth-status")
def check_auth_status(request: Request):
    """Google Drive 인증 상태 확인"""
    user = require_perm(request)

    user_id = user.get("user_id")
    creds = get_credentials(user_id)

    return {
        "authenticated": creds is not None and creds.valid,
        "user_id": user_id
    }


@router.post("/upload")
async def upload_to_drive(
    request: Request,
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    contact_id: Optional[int] = Form(None),
    company_name: Optional[str] = Form(None),
    team_name: Optional[str] = Form(None),
    contact_name: Optional[str] = Form(None)
):
    """파일을 Google Drive에 업로드 (자동 폴더 생성 지원)"""
    user = require_perm(request)

    user_id = user.get("user_id")
    creds = get_credentials(user_id)

    if not creds:
        raise HTTPException(401, "Google Drive 인증이 필요합니다")

    try:
        # Google Drive API 서비스 생성
        service = build('drive', 'v3', credentials=creds)

        # 폴더 계층 생성 (company_name, team_name, contact_name 제공시)
        target_folder_id = folder_id
        if company_name and team_name and contact_name:
            target_folder_id = await create_folder_hierarchy(service, company_name, team_name, contact_name)

        # 파일 메타데이터
        file_metadata = {
            'name': file.filename,
        }

        if target_folder_id:
            file_metadata['parents'] = [target_folder_id]

        # 파일 업로드
        file_content = await file.read()
        media = MediaIoBaseUpload(
            io.BytesIO(file_content),
            mimetype=file.content_type or 'application/octet-stream',
            resumable=True
        )

        uploaded_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink, mimeType',
            supportsAllDrives=True
        ).execute()

        # contact_id가 있으면 DB에 메타데이터 저장
        if contact_id:
            from database import sales_db_cursor
            with sales_db_cursor() as cur:
                cur.execute(
                    """INSERT INTO contact_files (contact_id, file_name, drive_file_id, web_view_link)
                       VALUES (%s, %s, %s, %s)""",
                    (contact_id, uploaded_file['name'], uploaded_file['id'], uploaded_file.get('webViewLink'))
                )

        return {
            "success": True,
            "file": {
                "id": uploaded_file['id'],
                "name": uploaded_file['name'],
                "webViewLink": uploaded_file.get('webViewLink'),
                "mimeType": uploaded_file.get('mimeType')
            }
        }

    except Exception as e:
        raise HTTPException(500, f"Upload error: {str(e)}")


@router.post("/create-folder")
def create_folder(
    request: Request,
    name: str = Form(...),
    parent_folder_id: Optional[str] = Form(None)
):
    """Google Drive에 폴더 생성"""
    user = require_perm(request)

    user_id = user.get("user_id")
    creds = get_credentials(user_id)

    if not creds:
        raise HTTPException(401, "Google Drive 인증이 필요합니다")

    try:
        service = build('drive', 'v3', credentials=creds)

        file_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder'
        }

        if parent_folder_id:
            file_metadata['parents'] = [parent_folder_id]

        folder = service.files().create(
            body=file_metadata,
            fields='id, name, webViewLink'
        ).execute()

        return {
            "success": True,
            "folder": {
                "id": folder['id'],
                "name": folder['name'],
                "webViewLink": folder.get('webViewLink')
            }
        }

    except Exception as e:
        raise HTTPException(500, f"Folder creation error: {str(e)}")


@router.get("/folder-url")
def get_folder_url(
    request: Request,
    company_name: str,
    team_name: str,
    contact_name: str
):
    """연락처 폴더 URL 가져오기"""
    user = require_perm(request)

    user_id = user.get("user_id")
    creds = get_credentials(user_id)

    if not creds:
        raise HTTPException(401, "Google Drive 인증이 필요합니다")

    try:
        service = build('drive', 'v3', credentials=creds)

        # Shared Drive 찾기
        drive_id = find_shared_drive(service, "통신사업팀")

        if drive_id:
            parent_id = find_or_create_folder(service, "한림퓨리텍 자료", drive_id, drive_id)
            root_id = find_or_create_folder(service, "HTC_CRM", parent_id, drive_id)
        else:
            root_id = find_or_create_folder(service, "통신사업팀", "root", None)
            root_id = find_or_create_folder(service, "한림퓨리텍 자료", root_id, None)
            root_id = find_or_create_folder(service, "HTC_CRM", root_id, None)

        # 폴더 찾기 (생성하지 않음)
        def find_folder_only(folder_name, parent_id):
            search_query = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            search_params = {
                'q': search_query,
                'fields': 'files(id)',
                'includeItemsFromAllDrives': True,
                'supportsAllDrives': True
            }

            if drive_id:
                search_params['driveId'] = drive_id
                search_params['corpora'] = 'drive'

            results = service.files().list(**search_params).execute()
            files = results.get('files', [])
            return files[0]['id'] if files else None

        company_id = find_folder_only(company_name, root_id)
        if not company_id:
            return {"url": ""}

        team_id = find_folder_only(team_name, company_id)
        if not team_id:
            return {"url": ""}

        contact_id = find_folder_only(contact_name, team_id)
        if not contact_id:
            return {"url": ""}

        return {"url": f"https://drive.google.com/drive/folders/{contact_id}"}

    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")


@router.get("/search")
def search_files(
    request: Request,
    query: str,
    folder_id: Optional[str] = None
):
    """Google Drive 파일 검색"""
    user = require_perm(request)

    user_id = user.get("user_id")
    creds = get_credentials(user_id)

    if not creds:
        raise HTTPException(401, "Google Drive 인증이 필요합니다")

    try:
        service = build('drive', 'v3', credentials=creds)

        # 검색 쿼리 구성
        search_query = f"name contains '{query}'"
        if folder_id:
            search_query += f" and '{folder_id}' in parents"

        results = service.files().list(
            q=search_query,
            spaces='drive',
            fields='files(id, name, mimeType, webViewLink, createdTime)',
            pageSize=20
        ).execute()

        return {
            "files": results.get('files', [])
        }

    except Exception as e:
        raise HTTPException(500, f"Search error: {str(e)}")
