"""HTC Inventory — Posts Router"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import db_cursor

router = APIRouter(tags=["posts"])

# Import get_session from auth router (DB-based session)
from routers.auth import require_perm

class PostCreate(BaseModel):
    title: str
    content: str
    is_notice: bool = False

class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_notice: Optional[bool] = None

@router.get("/posts")
def get_posts(request: Request):
    """Get all posts with author information and read status"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        cur.execute("""
            SELECT p.id, p.user_id, p.title, p.content, p.is_notice, p.created_at, p.updated_at,
                   u.name as author_name, u.position as author_position,
                   IF(pr.user_id IS NOT NULL, 1, 0) as is_read
            FROM posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN post_reads pr ON p.id = pr.post_id AND pr.user_id = %s
            ORDER BY p.is_notice DESC, p.created_at DESC
        """, (user_id,))
        posts = cur.fetchall()

    return {"data": posts}

@router.get("/posts/unread/count")
def get_unread_count(request: Request):
    """Get count of unread posts for current user"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) as unread_count
            FROM posts p
            LEFT JOIN post_reads pr ON p.id = pr.post_id AND pr.user_id = %s
            WHERE pr.user_id IS NULL
        """, (user_id,))
        result = cur.fetchone()

    return {"unread_count": result['unread_count'] if result else 0}

@router.get("/posts/{post_id}")
def get_post(post_id: int, request: Request):
    """Get single post"""
    current_user = require_perm(request)

    with db_cursor() as cur:
        cur.execute("""
            SELECT p.id, p.user_id, p.title, p.content, p.created_at, p.updated_at,
                   u.name as author_name, u.position as author_position
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = %s
        """, (post_id,))
        post = cur.fetchone()

    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

    return post

@router.post("/posts")
def create_post(post: PostCreate, request: Request):
    """Create new post (logged in user)"""
    current_user = require_perm(request)

    user_id = current_user['id']

    # Only admin can create notice
    is_notice = post.is_notice if current_user.get('is_admin') else False

    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO posts (user_id, title, content, is_notice) VALUES (%s, %s, %s, %s)",
            (user_id, post.title, post.content, is_notice)
        )
        post_id = cur.lastrowid

    return {"id": post_id, "message": "게시글이 작성되었습니다"}

@router.put("/posts/{post_id}")
def update_post(post_id: int, post: PostUpdate, request: Request):
    """Update post (only author can update)"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        # Check if post exists and user is the author
        cur.execute("SELECT user_id FROM posts WHERE id = %s", (post_id,))
        existing_post = cur.fetchone()

        if not existing_post:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

        if existing_post['user_id'] != user_id and not current_user.get('is_admin'):
            raise HTTPException(status_code=403, detail="본인의 게시글만 수정할 수 있습니다")

        # Update post
        updates = []
        values = []

        if post.title is not None:
            updates.append("title = %s")
            values.append(post.title)

        if post.content is not None:
            updates.append("content = %s")
            values.append(post.content)

        # Only admin can update is_notice
        if post.is_notice is not None and current_user.get('is_admin'):
            updates.append("is_notice = %s")
            values.append(post.is_notice)

        if not updates:
            return {"message": "변경사항이 없습니다"}

        values.append(post_id)
        cur.execute(f"UPDATE posts SET {', '.join(updates)} WHERE id = %s", values)

    return {"message": "게시글이 수정되었습니다"}

@router.delete("/posts/{post_id}")
def delete_post(post_id: int, request: Request):
    """Delete post (only author or admin can delete)"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        # Check if post exists and user is the author
        cur.execute("SELECT user_id FROM posts WHERE id = %s", (post_id,))
        existing_post = cur.fetchone()

        if not existing_post:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

        if existing_post['user_id'] != user_id and not current_user.get('is_admin'):
            raise HTTPException(status_code=403, detail="본인의 게시글만 삭제할 수 있습니다")

        cur.execute("DELETE FROM posts WHERE id = %s", (post_id,))

    return {"message": "게시글이 삭제되었습니다"}

@router.post("/posts/{post_id}/read")
def mark_post_as_read(post_id: int, request: Request):
    """Mark post as read for current user"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        # Check if post exists
        cur.execute("SELECT id FROM posts WHERE id = %s", (post_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

        # Insert or update read record (using INSERT IGNORE to avoid duplicate key error)
        cur.execute(
            "INSERT IGNORE INTO post_reads (post_id, user_id) VALUES (%s, %s)",
            (post_id, user_id)
        )

    return {"message": "읽음 처리되었습니다"}

# ==================== Comments ====================

class CommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[int] = None

class CommentUpdate(BaseModel):
    content: str

@router.get("/posts/{post_id}/comments")
def get_comments(post_id: int, request: Request):
    """Get all comments for a post with reply hierarchy"""
    current_user = require_perm(request)

    with db_cursor() as cur:
        cur.execute("""
            SELECT c.id, c.post_id, c.parent_comment_id, c.user_id, c.content, c.created_at, c.updated_at,
                   u.name as author_name, u.position as author_position
            FROM post_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = %s
            ORDER BY
                COALESCE(c.parent_comment_id, c.id) ASC,
                c.parent_comment_id IS NOT NULL ASC,
                c.id ASC
        """, (post_id,))
        comments = cur.fetchall()

    return {"data": comments}

@router.post("/posts/{post_id}/comments")
def create_comment(post_id: int, comment: CommentCreate, request: Request):
    """Create a new comment or reply"""
    print(f"[DEBUG] 댓글 생성 요청: post_id={post_id}, content={comment.content}, parent_comment_id={comment.parent_comment_id}")

    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        # Check if post exists and get author
        cur.execute("SELECT id, user_id FROM posts WHERE id = %s", (post_id,))
        post = cur.fetchone()
        if not post:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

        # If this is a reply, check parent comment exists
        parent_comment_author_id = None
        if comment.parent_comment_id:
            cur.execute("SELECT id, user_id FROM post_comments WHERE id = %s AND post_id = %s",
                       (comment.parent_comment_id, post_id))
            parent_comment = cur.fetchone()
            if not parent_comment:
                raise HTTPException(status_code=404, detail="원 댓글을 찾을 수 없습니다")
            parent_comment_author_id = parent_comment['user_id']

        # Insert comment
        cur.execute(
            "INSERT INTO post_comments (post_id, parent_comment_id, user_id, content) VALUES (%s, %s, %s, %s)",
            (post_id, comment.parent_comment_id, user_id, comment.content)
        )
        comment_id = cur.lastrowid

        # 알림 생성
        post_author_id = post['user_id']

        # 1. 글 작성자에게 알림 (본인 제외)
        if post_author_id != user_id:
            cur.execute(
                "INSERT INTO comment_notifications (post_id, comment_id, parent_comment_id, recipient_id, commenter_id) VALUES (%s, %s, %s, %s, %s)",
                (post_id, comment_id, comment.parent_comment_id, post_author_id, user_id)
            )

        # 2. 대댓글인 경우: 원 댓글 작성자에게도 알림 (본인 제외, 글 작성자 중복 제외)
        if parent_comment_author_id and parent_comment_author_id != user_id and parent_comment_author_id != post_author_id:
            cur.execute(
                "INSERT INTO comment_notifications (post_id, comment_id, parent_comment_id, recipient_id, commenter_id) VALUES (%s, %s, %s, %s, %s)",
                (post_id, comment_id, comment.parent_comment_id, parent_comment_author_id, user_id)
            )

    return {"id": comment_id, "message": "댓글이 작성되었습니다" if not comment.parent_comment_id else "답글이 작성되었습니다"}

@router.put("/posts/{post_id}/comments/{comment_id}")
def update_comment(post_id: int, comment_id: int, comment: CommentUpdate, request: Request):
    """Update a comment (only author can update)"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        # Check if comment exists and user is the author
        cur.execute("SELECT user_id FROM post_comments WHERE id = %s AND post_id = %s", (comment_id, post_id))
        existing_comment = cur.fetchone()

        if not existing_comment:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")

        if existing_comment['user_id'] != user_id and not current_user.get('is_admin'):
            raise HTTPException(status_code=403, detail="본인의 댓글만 수정할 수 있습니다")

        cur.execute(
            "UPDATE post_comments SET content = %s WHERE id = %s",
            (comment.content, comment_id)
        )

    return {"message": "댓글이 수정되었습니다"}

@router.delete("/posts/{post_id}/comments/{comment_id}")
def delete_comment(post_id: int, comment_id: int, request: Request):
    """Delete a comment (only author or admin can delete)"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        # Check if comment exists and user is the author
        cur.execute("SELECT user_id FROM post_comments WHERE id = %s AND post_id = %s", (comment_id, post_id))
        existing_comment = cur.fetchone()

        if not existing_comment:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")

        if existing_comment['user_id'] != user_id and not current_user.get('is_admin'):
            raise HTTPException(status_code=403, detail="본인의 댓글만 삭제할 수 있습니다")

        cur.execute("DELETE FROM post_comments WHERE id = %s", (comment_id,))

    return {"message": "댓글이 삭제되었습니다"}


# ==================== Comment Notifications ====================

@router.get("/notifications/comments")
def get_comment_notifications(request: Request):
    """Get comment notifications for current user"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        cur.execute("""
            SELECT cn.id, cn.post_id, cn.comment_id, cn.parent_comment_id, cn.is_read, cn.created_at,
                   p.title as post_title,
                   u.name as commenter_name,
                   c.content as comment_content,
                   pc.content as parent_comment_content
            FROM comment_notifications cn
            JOIN posts p ON cn.post_id = p.id
            JOIN users u ON cn.commenter_id = u.id
            JOIN post_comments c ON cn.comment_id = c.id
            LEFT JOIN post_comments pc ON cn.parent_comment_id = pc.id
            WHERE cn.recipient_id = %s
            ORDER BY cn.created_at DESC
            LIMIT 50
        """, (user_id,))
        notifications = cur.fetchall()

    return {"data": notifications}


@router.get("/notifications/comments/unread/count")
def get_unread_comment_notifications_count(request: Request):
    """Get count of unread comment notifications"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) as unread_count
            FROM comment_notifications
            WHERE recipient_id = %s AND is_read = 0
        """, (user_id,))
        result = cur.fetchone()

    return {"unread_count": result['unread_count'] if result else 0}


@router.post("/notifications/comments/{notification_id}/read")
def mark_notification_as_read(notification_id: int, request: Request):
    """Mark a notification as read"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        cur.execute(
            "UPDATE comment_notifications SET is_read = 1 WHERE id = %s AND recipient_id = %s",
            (notification_id, user_id)
        )

    return {"message": "알림을 읽음 처리했습니다"}


@router.post("/notifications/comments/read-all")
def mark_all_notifications_as_read(request: Request):
    """Mark all notifications as read"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        cur.execute(
            "UPDATE comment_notifications SET is_read = 1 WHERE recipient_id = %s",
            (user_id,)
        )

    return {"message": "모든 알림을 읽음 처리했습니다"}


@router.delete("/notifications/comments/read")
def delete_read_notifications(request: Request):
    """Delete all read notifications"""
    current_user = require_perm(request)

    user_id = current_user['id']

    with db_cursor() as cur:
        cur.execute(
            "DELETE FROM comment_notifications WHERE recipient_id = %s AND is_read = 1",
            (user_id,)
        )
        deleted_count = cur.rowcount

    return {"message": f"읽은 알림 {deleted_count}개가 삭제되었습니다", "deleted_count": deleted_count}
