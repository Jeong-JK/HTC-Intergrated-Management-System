"""contacts 테이블에 status 필드 추가 마이그레이션"""
from database import sales_db_cursor

def migrate():
    with sales_db_cursor() as cursor:
        # status 필드가 있는지 확인
        cursor.execute("SHOW COLUMNS FROM contacts LIKE 'status'")
        if cursor.fetchone():
            print("status 필드가 이미 존재합니다.")
            return

        # status 필드 추가 (기본값: 'active')
        cursor.execute("""
            ALTER TABLE contacts
            ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
        """)
        print("status 필드 추가 완료")

        # 인덱스 추가 (성능 최적화)
        cursor.execute("""
            CREATE INDEX idx_contacts_status ON contacts(status)
        """)
        print("status 인덱스 추가 완료")

if __name__ == "__main__":
    migrate()
    print("마이그레이션 완료!")
