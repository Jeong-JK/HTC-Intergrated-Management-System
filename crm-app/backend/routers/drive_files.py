"""HTC CRM — Google Drive Files Router"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from database import sales_db_cursor

router = APIRouter(prefix="/drive-files", tags=["drive-files"])


class ContactFileCreate(BaseModel):
    contact_id: int
    file_name: str
    drive_file_id: str
    web_view_link: Optional[str] = None


@router.post("/contact")
def create_contact_file(file: ContactFileCreate):
    """담당자에 파일 메타데이터 저장"""
    with sales_db_cursor() as cur:
        # 담당자 존재 확인
        cur.execute("SELECT id FROM contacts WHERE id = %s", (file.contact_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Contact not found")

        cur.execute(
            """INSERT INTO contact_files (contact_id, file_name, drive_file_id, web_view_link)
               VALUES (%s, %s, %s, %s)""",
            (file.contact_id, file.file_name, file.drive_file_id, file.web_view_link)
        )
        new_id = cur.lastrowid
        cur.execute(
            "SELECT * FROM contact_files WHERE id = %s",
            (new_id,)
        )
        return cur.fetchone()


@router.get("/contact/{contact_id}")
def list_contact_files(contact_id: int):
    """담당자의 파일 목록 조회"""
    with sales_db_cursor() as cur:
        cur.execute(
            """SELECT * FROM contact_files
               WHERE contact_id = %s
               ORDER BY uploaded_at DESC""",
            (contact_id,)
        )
        return cur.fetchall()


@router.delete("/contact/{file_id}")
def delete_contact_file(file_id: int):
    """담당자 파일 메타데이터 삭제"""
    with sales_db_cursor() as cur:
        cur.execute("DELETE FROM contact_files WHERE id = %s", (file_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "File not found")
    return {"ok": True}


@router.get("/folder-url")
def get_folder_url(company_name: str, team_name: str, contact_name: str):
    """
    담당자 폴더 URL 생성
    실제 폴더 존재 여부는 프론트엔드에서 확인
    """
    # 간단하게 검색용 URL 반환
    # 실제 폴더 ID는 프론트엔드에서 Google Drive API로 찾기
    search_query = f"{company_name} {team_name} {contact_name}".replace(" ", "+")
    return {
        "search_url": f"https://drive.google.com/drive/search?q={search_query}",
        "company_name": company_name,
        "team_name": team_name,
        "contact_name": contact_name
    }
