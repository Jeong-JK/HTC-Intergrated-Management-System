"""HTC Inventory — Settings Router"""
from fastapi import APIRouter
from database import db_cursor
from config import STATUSES, CATEGORIES

router = APIRouter(prefix="/settings", tags=["settings"])

INIT_SQL = """
CREATE TABLE IF NOT EXISTS app_settings (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    type     VARCHAR(50)  NOT NULL,
    value    VARCHAR(200) NOT NULL,
    sort_order INT DEFAULT 0,
    UNIQUE KEY uq_type_value (type, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

def ensure_table():
    with db_cursor() as cur:
        cur.execute(INIT_SQL)

def get_values(cur, type_key, default_list):
    cur.execute("SELECT value FROM app_settings WHERE type=%s ORDER BY sort_order, value", (type_key,))
    rows = cur.fetchall()
    if rows:
        return [r["value"] for r in rows]
    # 없으면 기본값을 DB에 저장 후 반환
    for i, v in enumerate(default_list):
        cur.execute("INSERT IGNORE INTO app_settings (type, value, sort_order) VALUES (%s,%s,%s)", (type_key, v, i))
    return default_list

@router.get("")
def get_all_settings():
    ensure_table()
    with db_cursor() as cur:
        # 위치/박스는 오직 app_settings에 등록된 것만 사용 (items 테이블에서 자동으로 가져오지 않음)
        return {
            "rack":              get_values(cur, "rack",              []),
            "box":               get_values(cur, "box",               []),
            "category_라디오":   get_values(cur, "category_라디오",   CATEGORIES["라디오"]),
            "category_안테나":   get_values(cur, "category_안테나",   CATEGORIES["안테나"]),
            "category_악세사리": get_values(cur, "category_악세사리", CATEGORIES["악세사리"]),
            "status":            get_values(cur, "status",            STATUSES),
        }

@router.put("/{type}/order")
def reorder_setting(type: str, body: dict):
    values = body.get("values", [])
    ensure_table()
    with db_cursor() as cur:
        for i, v in enumerate(values):
            # 없으면 INSERT, 있으면 UPDATE
            cur.execute("""
                INSERT INTO app_settings (type, value, sort_order)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE sort_order=%s
            """, (type, v, i, i))
    return {"ok": True}

@router.post("/{type}/{value}")
def add_setting(type: str, value: str):
    ensure_table()
    with db_cursor() as cur:
        cur.execute("SELECT MAX(sort_order) as mx FROM app_settings WHERE type=%s", (type,))
        mx = cur.fetchone()["mx"] or 0
        cur.execute("INSERT IGNORE INTO app_settings (type, value, sort_order) VALUES (%s,%s,%s)", (type, value, mx+1))
    return {"ok": True}

@router.put("/{type}/{value}")
def update_setting(type: str, value: str, body: dict):
    new_value = body.get("new_value", "").strip()
    if not new_value: return {"ok": False}
    ensure_table()
    with db_cursor() as cur:
        cur.execute("UPDATE app_settings SET value=%s WHERE type=%s AND value=%s", (new_value, type, value))
    return {"ok": True}

@router.delete("/{type}/{value}")
def delete_setting(type: str, value: str):
    ensure_table()
    with db_cursor() as cur:
        cur.execute("DELETE FROM app_settings WHERE type=%s AND value=%s", (type, value))
    return {"ok": True}
