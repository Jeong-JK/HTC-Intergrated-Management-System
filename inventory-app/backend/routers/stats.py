"""HTC Inventory — Stats Router v2"""
from fastapi import APIRouter
from database import db_cursor

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary")
def summary():
    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as total, SUM(total_price) as total_value FROM items")
        overview = cur.fetchone()
        cur.execute("SELECT status, COUNT(*) as cnt FROM items GROUP BY status")
        by_status = cur.fetchall()
        cur.execute("SELECT item_type, COUNT(*) as cnt, SUM(total_price) as value FROM items GROUP BY item_type")
        by_type = cur.fetchall()
        cur.execute("SELECT COUNT(*) as cnt FROM rental_history WHERE returned_at IS NULL")
        active_rentals = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*) as cnt FROM rental_history WHERE returned_at IS NULL AND expected_return < CURDATE()")
        overdue = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*) as cnt FROM delivery_history WHERE status='납품예정'")
        pending_delivery = cur.fetchone()["cnt"]
    return {
        "overview":         overview,
        "by_status":        by_status,
        "by_type":          by_type,
        "active_rentals":   active_rentals,
        "overdue":          overdue,
        "pending_delivery": pending_delivery,
    }
