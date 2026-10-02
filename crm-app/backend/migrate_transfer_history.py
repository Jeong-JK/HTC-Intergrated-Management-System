#!/usr/bin/env python3
"""
담당자 이직 이력 테이블 마이그레이션
- contact_transfer_history: 이직 시 이전 회사/팀 정보 저장
"""

from database import sales_db_cursor

def migrate():
    with sales_db_cursor() as cur:
        # contact_transfer_history 테이블 생성
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contact_transfer_history (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                contact_id      INT NOT NULL,
                from_company_id INT,
                from_company_name VARCHAR(255),
                from_team_id    INT,
                from_team_name  VARCHAR(255),
                to_company_id   INT,
                to_company_name VARCHAR(255),
                to_team_id      INT,
                to_team_name    VARCHAR(255),
                transferred_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                note            TEXT,
                FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                INDEX idx_contact_id (contact_id),
                INDEX idx_from_company (from_company_name),
                INDEX idx_transferred_at (transferred_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        print("✅ contact_transfer_history 테이블 생성 완료")

        # 테이블 구조 확인
        cur.execute("DESCRIBE contact_transfer_history")
        columns = cur.fetchall()
        print("\n📋 테이블 구조:")
        for col in columns:
            print(f"  - {col['Field']}: {col['Type']}")

if __name__ == "__main__":
    migrate()
