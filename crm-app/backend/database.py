"""HTC Inventory — Database Layer v2"""
import pymysql
from pymysql.cursors import DictCursor
from contextlib import contextmanager
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
from config import SALES_DB_HOST, SALES_DB_PORT, SALES_DB_USER, SALES_DB_PASSWORD, SALES_DB_NAME

def get_connection():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
        init_command="SET time_zone='+09:00'"
    )

def get_sales_connection():
    """htc_sales DB 연결"""
    return pymysql.connect(
        host=SALES_DB_HOST, port=SALES_DB_PORT,
        user=SALES_DB_USER, password=SALES_DB_PASSWORD,
        database=SALES_DB_NAME, charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
        init_command="SET time_zone='+09:00'"
    )

@contextmanager
def db_cursor():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

@contextmanager
def sales_db_cursor():
    """htc_sales DB 커서"""
    conn = get_sales_connection()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS items (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    -- 위치 정보
    rack_no       VARCHAR(50)    DEFAULT '',   -- 렉선반번호
    box_no        VARCHAR(50)    DEFAULT '',   -- 박스번호
    -- 분류
    item_type     VARCHAR(20)    NOT NULL DEFAULT '라디오',  -- 라디오/안테나/악세사리
    category      VARCHAR(100)   DEFAULT '',   -- 세부 카테고리
    grade         VARCHAR(20)    DEFAULT '새제품',  -- 새제품/데모
    -- 품목 정보
    item_name     VARCHAR(200)   NOT NULL,
    description   TEXT,
    serial        VARCHAR(200)   DEFAULT '',
    ip            VARCHAR(50)    DEFAULT '',
    mac           VARCHAR(50)    DEFAULT '',
    -- 상태
    status        VARCHAR(30)    DEFAULT '재고',  -- 재고/대여중/납품예정/납품/분실/수리중
    -- 라이센스
    license_key   VARCHAR(500)   DEFAULT '',
    -- 재무
    purchase_date DATE,
    unit_price    DECIMAL(15,2)  DEFAULT 0,
    exchange_rate DECIMAL(10,4)  DEFAULT 1.0,
    total_price   DECIMAL(15,2)  DEFAULT 0,
    -- 기타
    note          TEXT,
    created_at    DATETIME       DEFAULT NOW(),
    updated_at    DATETIME       DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inbound (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    item_id       INT            NULL,
    quantity      INT            DEFAULT 1,
    supplier      VARCHAR(200)   DEFAULT '',   -- 공급처
    inbound_date  DATE           NOT NULL,
    unit_price    DECIMAL(15,2)  DEFAULT 0,
    exchange_rate DECIMAL(10,4)  DEFAULT 1.0,
    note          TEXT,
    created_at    DATETIME       DEFAULT NOW(),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rental_history (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    item_id         INT            NULL,
    borrower        VARCHAR(200)   NOT NULL,   -- 대여처/업체명
    contact_name    VARCHAR(100)   DEFAULT '', -- 담당자명
    contact_phone   VARCHAR(50)    DEFAULT '', -- 전화번호
    purpose         VARCHAR(300)   DEFAULT '',
    quantity        INT            DEFAULT 1,
    rent_date       DATE           NOT NULL,
    expected_return DATE,
    returned_at     DATE,
    note            TEXT,
    created_at      DATETIME       DEFAULT NOW(),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS delivery_history (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    item_id       INT            NULL,
    item_name     VARCHAR(200)   DEFAULT '', -- 품명 (item 삭제되어도 유지)
    client        VARCHAR(200)   NOT NULL,   -- 납품처
    project_name  VARCHAR(200)   DEFAULT '', -- 프로젝트명
    contact_name  VARCHAR(100)   DEFAULT '', -- 담당자명
    contact_phone VARCHAR(50)    DEFAULT '', -- 전화번호
    quantity      INT            DEFAULT 1,
    unit_price    DECIMAL(15,2)  DEFAULT 0,
    delivery_date DATE           NOT NULL,
    status        VARCHAR(30)    DEFAULT '납품예정',  -- 납품예정/납품완료
    note          TEXT,
    created_at    DATETIME       DEFAULT NOW(),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

def init_db():
    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        charset="utf8mb4", autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4")
            cur.execute(f"USE `{DB_NAME}`")
            for stmt in SCHEMA_SQL.strip().split(";"):
                stmt = stmt.strip()
                # 주석 제거 후 실행
                lines = [l for l in stmt.split('\n') if not l.strip().startswith('--')]
                stmt = '\n'.join(lines).strip()
                if stmt:
                    cur.execute(stmt)
    finally:
        conn.close()
