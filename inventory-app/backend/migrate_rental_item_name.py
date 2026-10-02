"""Add item_name and description columns to rental_history table"""
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
            # Check if columns already exist
            cur.execute("""
                SELECT COUNT(*) as cnt
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = %s
                AND TABLE_NAME = 'rental_history'
                AND COLUMN_NAME = 'item_name'
            """, (DB_NAME,))

            result = cur.fetchone()
            if result[0] > 0:
                print("✓ Columns already exist. No migration needed.")
                return

            # Add columns
            print("Adding item_name and description columns to rental_history...")
            cur.execute("""
                ALTER TABLE rental_history
                ADD COLUMN item_name VARCHAR(200) DEFAULT '' AFTER item_id,
                ADD COLUMN description TEXT AFTER item_name
            """)

            print("✓ Migration completed successfully!")

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
