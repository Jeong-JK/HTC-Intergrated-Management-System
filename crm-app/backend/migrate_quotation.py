"""견적서/발주서 테이블 마이그레이션"""
from database import get_sales_connection

MIGRATION_SQL = """
-- 1. 견적서 헤더
CREATE TABLE IF NOT EXISTS quotations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    quotation_no    VARCHAR(50)    UNIQUE,
    company_id      INT            NOT NULL,
    contact_id      INT            NULL,
    company_name    VARCHAR(200)   NOT NULL,
    contact_name    VARCHAR(100)   DEFAULT '',
    contact_phone   VARCHAR(50)    DEFAULT '',
    contact_email   VARCHAR(200)   DEFAULT '',
    quotation_date  DATE           NOT NULL,
    valid_until     DATE           NULL,
    subtotal        DECIMAL(15,2)  DEFAULT 0,
    vat_rate        DECIMAL(5,2)   DEFAULT 10,
    vat_amt         DECIMAL(15,2)  DEFAULT 0,
    total           DECIMAL(15,2)  DEFAULT 0,
    status          VARCHAR(30)    DEFAULT '작성중',
    note            TEXT,
    created_at      DATETIME       DEFAULT NOW(),
    updated_at      DATETIME       DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 견적서 품목
CREATE TABLE IF NOT EXISTS quotation_items (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id    INT            NOT NULL,
    seq             INT            DEFAULT 1,
    item_id         INT            NULL,
    item_name       VARCHAR(200)   NOT NULL,
    description     VARCHAR(500)   DEFAULT '',
    quantity        INT            DEFAULT 1,
    unit_price      DECIMAL(15,2)  DEFAULT 0,
    amount          DECIMAL(15,2)  DEFAULT 0,
    note            VARCHAR(500)   DEFAULT '',
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 발주서 헤더
CREATE TABLE IF NOT EXISTS purchase_orders (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    po_no           VARCHAR(50)    UNIQUE,
    quotation_id    INT            NULL,
    company_id      INT            NOT NULL,
    contact_id      INT            NULL,
    company_name    VARCHAR(200)   NOT NULL,
    contact_name    VARCHAR(100)   DEFAULT '',
    contact_phone   VARCHAR(50)    DEFAULT '',
    contact_email   VARCHAR(200)   DEFAULT '',
    order_date      DATE           NOT NULL,
    delivery_due    DATE           NULL,
    subtotal        DECIMAL(15,2)  DEFAULT 0,
    vat_rate        DECIMAL(5,2)   DEFAULT 10,
    vat_amt         DECIMAL(15,2)  DEFAULT 0,
    total           DECIMAL(15,2)  DEFAULT 0,
    status          VARCHAR(30)    DEFAULT '발주',
    delivery_address TEXT,
    note            TEXT,
    created_at      DATETIME       DEFAULT NOW(),
    updated_at      DATETIME       DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 발주서 품목
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    po_id           INT            NOT NULL,
    seq             INT            DEFAULT 1,
    item_id         INT            NULL,
    item_name       VARCHAR(200)   NOT NULL,
    description     VARCHAR(500)   DEFAULT '',
    quantity        INT            DEFAULT 1,
    delivered_qty   INT            DEFAULT 0,
    unit_price      DECIMAL(15,2)  DEFAULT 0,
    amount          DECIMAL(15,2)  DEFAULT 0,
    note            VARCHAR(500)   DEFAULT '',
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

def run_migration():
    conn = get_sales_connection()
    try:
        with conn.cursor() as cur:
            for stmt in MIGRATION_SQL.strip().split(";"):
                # 주석 제거
                lines = [l for l in stmt.split('\n') if not l.strip().startswith('--')]
                stmt = '\n'.join(lines).strip()
                if stmt:
                    print(f"Executing: {stmt[:60]}...")
                    cur.execute(stmt)
        conn.commit()
        print("Migration completed successfully!")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
