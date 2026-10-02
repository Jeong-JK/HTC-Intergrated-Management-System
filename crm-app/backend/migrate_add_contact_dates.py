"""
Add last_contact_date columns to contacts table
"""
import sys
sys.path.append('/home/ec2-user/crm-app/backend')

from database import get_sales_connection

def migrate():
    conn = get_sales_connection()
    try:
        with conn.cursor() as cur:
            print("Adding last_contact_date and last_contact_updated_at columns...")

            # Add columns
            cur.execute("""
                ALTER TABLE contacts
                ADD COLUMN last_contact_date DATETIME NULL COMMENT '마지막 연락 날짜 (미팅 외 연락)',
                ADD COLUMN last_contact_updated_at DATETIME NULL COMMENT '연락 날짜 갱신 시각',
                ADD INDEX idx_last_contact_date (last_contact_date)
            """)

            conn.commit()
            print("✓ Columns added successfully!")

            # Verify
            cur.execute("DESCRIBE contacts")
            columns = cur.fetchall()
            print("\nCurrent contacts table structure:")
            for col in columns:
                print(f"  - {col['Field']}: {col['Type']}")

    except Exception as e:
        conn.rollback()
        print(f"✗ Error: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
