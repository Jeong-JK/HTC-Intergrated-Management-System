"""
대여 시스템 DB 마이그레이션 스크립트

기존 구조:
- rental_headers (reg_date, company, contact_person, contact_phone, ...)

새로운 구조:
- companies (company_name, contact_person, contact_phone)
- rental_headers (company_id, rent_date, expected_return, actual_return, ...)
"""
import pymysql
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def migrate():
    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        autocommit=False,
    )

    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            print("=== 대여 시스템 마이그레이션 시작 ===\n")

            # 1. 기존 rental_headers 백업
            print("1. 기존 rental_headers 백업 중...")
            cur.execute("DROP TABLE IF EXISTS rental_headers_backup")
            cur.execute("""
                CREATE TABLE rental_headers_backup
                SELECT * FROM rental_headers
            """)
            conn.commit()
            print("   ✓ 백업 완료\n")

            # 2. companies 테이블 생성
            print("2. companies 테이블 생성 중...")
            cur.execute("DROP TABLE IF EXISTS companies")
            cur.execute("""
                CREATE TABLE companies (
                    id              INT AUTO_INCREMENT PRIMARY KEY,
                    company_name    VARCHAR(200)   NOT NULL UNIQUE,
                    contact_person  VARCHAR(100)   DEFAULT '',
                    contact_phone   VARCHAR(50)    DEFAULT '',
                    created_at      DATETIME       DEFAULT NOW(),
                    updated_at      DATETIME       DEFAULT NOW() ON UPDATE NOW()
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            conn.commit()
            print("   ✓ companies 테이블 생성 완료\n")

            # 3. 기존 rental_headers에서 unique한 업체 정보 추출하여 companies에 삽입
            print("3. 업체 정보 마이그레이션 중...")
            cur.execute("""
                SELECT DISTINCT company, contact_person, contact_phone
                FROM rental_headers_backup
                WHERE company IS NOT NULL AND company != ''
                ORDER BY company
            """)
            companies = cur.fetchall()

            for comp in companies:
                cur.execute("""
                    INSERT INTO companies (company_name, contact_person, contact_phone)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        contact_person = VALUES(contact_person),
                        contact_phone = VALUES(contact_phone)
                """, (comp['company'], comp['contact_person'] or '', comp['contact_phone'] or ''))

            conn.commit()
            print(f"   ✓ {len(companies)}개 업체 마이그레이션 완료\n")

            # 4. rental_items의 FK 제약조건 임시 제거
            print("4. rental_items FK 제약조건 임시 제거...")
            cur.execute("ALTER TABLE rental_items DROP FOREIGN KEY rental_items_ibfk_1")
            conn.commit()
            print("   ✓ FK 제약조건 제거 완료\n")

            # 5. 새로운 rental_headers 테이블 생성
            print("5. 새 rental_headers 테이블 생성 중...")
            cur.execute("DROP TABLE IF EXISTS rental_headers")
            cur.execute("""
                CREATE TABLE rental_headers (
                    id              INT AUTO_INCREMENT PRIMARY KEY,
                    company_id      INT            NOT NULL,
                    rent_date       DATE           NOT NULL,
                    expected_return DATE,
                    actual_return   DATE,
                    purpose         TEXT,
                    status          VARCHAR(30)    DEFAULT '대여중',
                    created_at      DATETIME       DEFAULT NOW(),
                    updated_at      DATETIME       DEFAULT NOW() ON UPDATE NOW(),
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            conn.commit()
            print("   ✓ 새 rental_headers 테이블 생성 완료\n")

            # 6. 기존 데이터를 새 테이블로 마이그레이션
            print("6. 대여 데이터 마이그레이션 중...")
            cur.execute("SELECT * FROM rental_headers_backup ORDER BY id")
            old_rentals = cur.fetchall()

            migrated_count = 0
            for rental in old_rentals:
                # 업체 ID 찾기
                cur.execute(
                    "SELECT id FROM companies WHERE company_name = %s",
                    (rental['company'],)
                )
                company = cur.fetchone()

                if not company:
                    print(f"   ⚠ 경고: 업체 '{rental['company']}'를 찾을 수 없습니다. 건너뜁니다.")
                    continue

                company_id = company['id']

                # 새 테이블에 삽입 (id 유지)
                cur.execute("""
                    INSERT INTO rental_headers
                    (id, company_id, rent_date, expected_return, actual_return, purpose, status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    rental['id'],
                    company_id,
                    rental['rent_date'],
                    rental['expected_return'],
                    None,  # actual_return은 status가 '반납완료'일 때 expected_return 또는 현재 날짜로 설정
                    rental['purpose'],
                    rental['status'],
                    rental['created_at'],
                    rental['updated_at']
                ))
                migrated_count += 1

            conn.commit()
            print(f"   ✓ {migrated_count}개 대여 기록 마이그레이션 완료\n")

            # 7. rental_items FK 제약조건 재설정
            print("7. rental_items FK 제약조건 재설정...")
            cur.execute("""
                ALTER TABLE rental_items
                ADD CONSTRAINT rental_items_ibfk_1
                FOREIGN KEY (rental_header_id) REFERENCES rental_headers(id) ON DELETE CASCADE
            """)
            conn.commit()
            print("   ✓ FK 제약조건 재설정 완료\n")

            # 8. AUTO_INCREMENT 값 재설정
            print("8. AUTO_INCREMENT 값 재설정...")
            cur.execute("SELECT MAX(id) as max_id FROM rental_headers")
            max_id = cur.fetchone()['max_id'] or 0
            cur.execute(f"ALTER TABLE rental_headers AUTO_INCREMENT = {max_id + 1}")
            conn.commit()
            print(f"   ✓ AUTO_INCREMENT = {max_id + 1} 설정 완료\n")

            print("=== 마이그레이션 완료! ===")
            print(f"총 {len(companies)}개 업체, {migrated_count}개 대여 기록이 마이그레이션되었습니다.")
            print("\n백업 테이블 'rental_headers_backup'은 수동으로 확인 후 삭제하세요.")

    except Exception as e:
        print(f"\n❌ 에러 발생: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
