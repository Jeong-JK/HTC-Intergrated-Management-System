"""HTC Sales Pipeline — Database Layer"""
import pymysql
from pymysql.cursors import DictCursor
from contextlib import contextmanager
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def get_connection():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, charset="utf8mb4",
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


SCHEMA_SQL = """
-- 매입 관리
CREATE TABLE IF NOT EXISTS purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    po_number VARCHAR(100) NOT NULL,
    quote VARCHAR(100) DEFAULT NULL,
    oc VARCHAR(100) DEFAULT NULL,
    invoice VARCHAR(100) DEFAULT NULL,
    request_number VARCHAR(50) DEFAULT NULL,
    supplier VARCHAR(200) NOT NULL,
    project VARCHAR(300) DEFAULT NULL,
    project_id INT DEFAULT NULL COMMENT '프로젝트 ID (FK)',
    product_name VARCHAR(300) NOT NULL,
    quantity INT DEFAULT 1,
    net_price DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    amount DECIMAL(15,2) DEFAULT 0,
    expected_date VARCHAR(100) DEFAULT NULL,
    received_status VARCHAR(50) DEFAULT '미입고',
    payment_date1 VARCHAR(100) DEFAULT NULL,
    payment_amount1 DECIMAL(15,2) DEFAULT 0,
    exchange_rate1 DECIMAL(10,2) DEFAULT NULL,
    payment_date2 VARCHAR(100) DEFAULT NULL,
    payment_amount2 DECIMAL(15,2) DEFAULT 0,
    exchange_rate2 DECIMAL(10,2) DEFAULT NULL,
    bar_note VARCHAR(100) DEFAULT NULL,
    bar_start_date DATE DEFAULT NULL,
    bar_end_date DATE DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_year (year),
    INDEX idx_po_number (po_number),
    INDEX idx_supplier (supplier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 프로젝트
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    project_no VARCHAR(50) NOT NULL,
    customer VARCHAR(200) NOT NULL,
    project_name VARCHAR(300) NOT NULL,
    supplier VARCHAR(200) DEFAULT NULL,
    delivery_date VARCHAR(100) DEFAULT NULL,
    order_amount DECIMAL(15,2) DEFAULT 0,
    order_date VARCHAR(100) DEFAULT NULL COMMENT '업체 발주일',
    payment_date VARCHAR(100) DEFAULT NULL,
    payment_amount DECIMAL(15,2) DEFAULT 0,
    payment_status DECIMAL(5,4) DEFAULT NULL,
    status VARCHAR(50) DEFAULT '진행중',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_year (year),
    INDEX idx_project_no (project_no),
    INDEX idx_customer (customer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 수금 정보
CREATE TABLE IF NOT EXISTS project_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    payment_date DATE NOT NULL,
    payment_amount DECIMAL(15,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 판매 품목
CREATE TABLE IF NOT EXISTS sales_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    product_name VARCHAR(300) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(15,2) DEFAULT 0,
    total_price DECIMAL(15,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 프로젝트 매입
CREATE TABLE IF NOT EXISTS purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    po_number VARCHAR(100) DEFAULT NULL,
    supplier VARCHAR(200) NOT NULL,
    product_name VARCHAR(300) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price_usd DECIMAL(15,2) DEFAULT 0,
    unit_price_krw DECIMAL(15,2) DEFAULT 0,
    total_price_usd DECIMAL(15,2) DEFAULT 0,
    total_price_krw DECIMAL(15,2) DEFAULT 0,
    expected_date VARCHAR(100) DEFAULT NULL,
    received_status VARCHAR(50) DEFAULT '미입고',
    payment_status DECIMAL(5,4) DEFAULT NULL,
    exchange_rate DECIMAL(10,2) DEFAULT NULL,
    actual_order_date VARCHAR(100) DEFAULT NULL COMMENT '실제 발주일 (배송비 절감을 위해 다른 연도 물품과 함께 발주한 경우)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project (project_id),
    INDEX idx_po_number (po_number),
    INDEX idx_supplier (supplier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Weekly 일정
CREATE TABLE IF NOT EXISTS weekly_schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    project_no VARCHAR(50) NOT NULL,
    customer_project VARCHAR(300) NOT NULL,
    product_name VARCHAR(300) NOT NULL,
    quantity INT DEFAULT 1,
    supplier VARCHAR(200) DEFAULT NULL,
    notes TEXT,
    week_data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_year (year),
    INDEX idx_project_no (project_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
