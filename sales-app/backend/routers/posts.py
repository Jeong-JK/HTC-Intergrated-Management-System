from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from database import db_cursor

router = APIRouter(prefix="/posts", tags=["posts"])


class PostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=10000)

    @field_validator('title', 'content')
    @classmethod
    def strip_whitespace(cls, v):
        return v.strip() if v else v


class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=10000)

    @field_validator('title', 'content')
    @classmethod
    def strip_whitespace(cls, v):
        return v.strip() if v else v


class Post(BaseModel):
    id: int
    title: str
    content: str
    author: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("")
def get_posts():
    """모든 게시글 조회"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM posts ORDER BY created_at DESC")
        posts = cur.fetchall()
        return posts


@router.get("/{post_id}")
def get_post(post_id: int):
    """특정 게시글 조회"""
    with db_cursor() as cur:
        cur.execute("SELECT * FROM posts WHERE id = %s", (post_id,))
        post = cur.fetchone()
        if not post:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
        return post


@router.post("")
def create_post(post: PostCreate, request: Request):
    """새 게시글 작성"""
    user = request.state.user
    author = user.get('name', user.get('user_id', 'Unknown'))

    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO posts (title, content, author) VALUES (%s, %s, %s)",
            (post.title, post.content, author)
        )
        post_id = cur.lastrowid
        return {"id": post_id, "message": "게시글이 작성되었습니다"}


@router.put("/{post_id}")
def update_post(post_id: int, post: PostUpdate):
    """게시글 수정"""
    with db_cursor() as cur:
        cur.execute("SELECT id FROM posts WHERE id = %s", (post_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

        update_fields = []
        values = []
        if post.title is not None:
            update_fields.append("title = %s")
            values.append(post.title)
        if post.content is not None:
            update_fields.append("content = %s")
            values.append(post.content)

        if update_fields:
            values.append(post_id)
            query = f"UPDATE posts SET {', '.join(update_fields)} WHERE id = %s"
            cur.execute(query, values)

        return {"message": "게시글이 수정되었습니다"}


@router.delete("/{post_id}")
def delete_post(post_id: int):
    """게시글 삭제"""
    with db_cursor() as cur:
        cur.execute("SELECT id FROM posts WHERE id = %s", (post_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

        cur.execute("DELETE FROM posts WHERE id = %s", (post_id,))
        return {"message": "게시글이 삭제되었습니다"}
