"""HTC Inventory — Admin Drive Router"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from routers.auth import require_perm
from typing import List
import os
import shutil
from datetime import datetime

router = APIRouter(prefix="/drive", tags=["drive"])

# 설정
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "admin_drive")
MAX_STORAGE_BYTES = 1 * 1024 * 1024 * 1024  # 1GB

# 폴더 생성
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_folder_size(folder_path: str) -> int:
    """폴더 전체 크기 계산"""
    total = 0
    for entry in os.scandir(folder_path):
        if entry.is_file():
            total += entry.stat().st_size
    return total

def format_size(size_bytes: int) -> str:
    """바이트를 읽기 쉬운 형태로 변환"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

@router.get("/files")
async def list_files(request: Request):
    """파일 목록 조회"""
    require_perm(request, "is_admin")

    files = []
    if os.path.exists(UPLOAD_DIR):
        for entry in os.scandir(UPLOAD_DIR):
            if entry.is_file():
                stat = entry.stat()
                files.append({
                    "name": entry.name,
                    "size": stat.st_size,
                    "size_display": format_size(stat.st_size),
                    "uploaded_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
                })

    # 최신 파일이 위로
    files.sort(key=lambda x: x["uploaded_at"], reverse=True)

    # 용량 정보
    used = get_folder_size(UPLOAD_DIR)

    return {
        "files": files,
        "storage": {
            "used": used,
            "used_display": format_size(used),
            "max": MAX_STORAGE_BYTES,
            "max_display": format_size(MAX_STORAGE_BYTES),
            "percent": round(used / MAX_STORAGE_BYTES * 100, 1)
        }
    }

@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    """파일 업로드"""
    require_perm(request, "is_admin")

    # 용량 체크
    used = get_folder_size(UPLOAD_DIR)

    # 파일 내용 읽기
    content = await file.read()
    file_size = len(content)

    if used + file_size > MAX_STORAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"저장 공간이 부족합니다. (현재: {format_size(used)}, 최대: {format_size(MAX_STORAGE_BYTES)})"
        )

    # 파일명 중복 처리
    filename = file.filename
    filepath = os.path.join(UPLOAD_DIR, filename)

    if os.path.exists(filepath):
        name, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(filepath):
            filename = f"{name}_{counter}{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            counter += 1

    # 파일 저장
    with open(filepath, "wb") as f:
        f.write(content)

    return {"message": "업로드 완료", "filename": filename}

@router.get("/download/{filename}")
async def download_file(request: Request, filename: str):
    """파일 다운로드"""
    require_perm(request, "is_admin")

    filepath = os.path.join(UPLOAD_DIR, filename)

    # 경로 탈출 방지
    if not os.path.abspath(filepath).startswith(os.path.abspath(UPLOAD_DIR)):
        raise HTTPException(status_code=400, detail="잘못된 파일 경로")

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")

    return FileResponse(
        filepath,
        filename=filename,
        media_type="application/octet-stream"
    )

@router.delete("/delete/{filename}")
async def delete_file(request: Request, filename: str):
    """파일 삭제"""
    require_perm(request, "is_admin")

    filepath = os.path.join(UPLOAD_DIR, filename)

    # 경로 탈출 방지
    if not os.path.abspath(filepath).startswith(os.path.abspath(UPLOAD_DIR)):
        raise HTTPException(status_code=400, detail="잘못된 파일 경로")

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")

    os.remove(filepath)
    return {"message": "삭제 완료"}

@router.put("/rename/{filename}")
async def rename_file(request: Request, filename: str):
    """파일 이름 변경"""
    require_perm(request, "is_admin")

    body = await request.json()
    new_name = body.get("new_name", "").strip()

    if not new_name:
        raise HTTPException(status_code=400, detail="새 파일명을 입력해주세요")

    # 위험한 문자 제거
    for char in ['/', '\\', '..', '\0']:
        if char in new_name:
            raise HTTPException(status_code=400, detail="파일명에 사용할 수 없는 문자가 포함되어 있습니다")

    old_path = os.path.join(UPLOAD_DIR, filename)
    new_path = os.path.join(UPLOAD_DIR, new_name)

    # 경로 탈출 방지
    if not os.path.abspath(old_path).startswith(os.path.abspath(UPLOAD_DIR)):
        raise HTTPException(status_code=400, detail="잘못된 파일 경로")
    if not os.path.abspath(new_path).startswith(os.path.abspath(UPLOAD_DIR)):
        raise HTTPException(status_code=400, detail="잘못된 파일 경로")

    if not os.path.exists(old_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")

    if os.path.exists(new_path):
        raise HTTPException(status_code=400, detail="같은 이름의 파일이 이미 존재합니다")

    os.rename(old_path, new_path)
    return {"message": "이름 변경 완료", "new_name": new_name}
