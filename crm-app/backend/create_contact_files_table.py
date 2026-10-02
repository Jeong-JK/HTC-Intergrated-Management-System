"""Create contact_files table for Google Drive integration"""
import pymysql
from config import SALES_DB_HOST, SALES_DB_PORT, SALES_DB_USER, SALES_DB_PASSWORD, SALES_DB_NAME

def create_contact_files_table():
    conn = pymysql.connect(
        host=SALES_DB_HOST,
        port=SALES_DB_PORT,
        user=SALES_DB_USER,
        password=SALES_DB_PASSWORD,
        database=SALES_DB_NAME,
        charset="utf8mb4",
        autocommit=True
    )

    try:
        with conn.cursor() as cur:
            # contact_files 테이블 생성
            cur.execute("""
                CREATE TABLE IF NOT EXISTS contact_files (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    contact_id INT NOT NULL,
                    file_name VARCHAR(500) NOT NULL,
                    drive_file_id VARCHAR(200) NOT NULL,
                    web_view_link TEXT,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
                ) CHARACTER SET utf8mb4
            """)
            print("✅ contact_files 테이블이 생성되었습니다.")

            # 테이블 확인
            cur.execute("SHOW TABLES LIKE 'contact_files'")
            result = cur.fetchone()
            if result:
                print(f"✅ 테이블 확인: {result}")

    finally:
        conn.close()

if __name__ == "__main__":
    create_contact_files_table()
