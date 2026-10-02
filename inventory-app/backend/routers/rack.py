"""HTC Inventory — Rack/Box Router"""
from fastapi import APIRouter
from database import db_cursor

router = APIRouter(prefix="/rack", tags=["rack"])

@router.get("")
def get_racks():
    with db_cursor() as cur:
        cur.execute("SELECT DISTINCT rack_no FROM items WHERE rack_no IS NOT NULL AND rack_no != '' ORDER BY rack_no")
        racks = [r["rack_no"] for r in cur.fetchall()]
        cur.execute("SELECT DISTINCT box_no FROM items WHERE box_no IS NOT NULL AND box_no != '' ORDER BY box_no")
        boxes = [r["box_no"] for r in cur.fetchall()]
    return {"racks": racks, "boxes": boxes}

@router.put("/item/{item_id}")
def update_rack(item_id: int, body: dict):
    rack_no = body.get("rack_no", "")
    box_no  = body.get("box_no", "")
    with db_cursor() as cur:
        cur.execute("UPDATE items SET rack_no=%s, box_no=%s WHERE id=%s", (rack_no, box_no, item_id))
        cur.execute("SELECT id, rack_no, box_no FROM items WHERE id=%s", (item_id,))
        return cur.fetchone()
