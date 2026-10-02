"""Add quantity column to items table for accessories"""
import pymysql
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def migrate():
    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        autocommit=True,
    )

    try:
        with conn.cursor() as cur:
            # Check if column already exists
            cur.execute("""
                SELECT COUNT(*) as cnt
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = %s
                AND TABLE_NAME = 'items'
                AND COLUMN_NAME = 'quantity'
            """, (DB_NAME,))

            result = cur.fetchone()
            if result[0] > 0:
                print("✓ Column already exists. No migration needed.")
                return

            # Add quantity column
            print("Adding quantity column to items table...")
            cur.execute("""
                ALTER TABLE items
                ADD COLUMN quantity INT DEFAULT 1 AFTER status
            """)

            print("✓ Migration completed successfully!")

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
