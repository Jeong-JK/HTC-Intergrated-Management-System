#!/usr/bin/env python3
"""외래키 제약조건 마이그레이션: CASCADE → SET NULL"""
import pymysql
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def migrate():
    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, charset="utf8mb4",
        autocommit=False
    )

    try:
        with conn.cursor() as cur:
            # 1. 기존 외래키 이름 확인
            cur.execute("""
                SELECT CONSTRAINT_NAME, TABLE_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA=%s AND REFERENCED_TABLE_NAME='items'
            """, (DB_NAME,))
            constraints = cur.fetchall()

            print("현재 외래키 제약조건:")
            for constraint in constraints:
                print(f"  - {constraint[1]}: {constraint[0]}")

            # 2. inbound 테이블 수정
            print("\n[1/3] inbound 테이블 외래키 수정...")
            inbound_fk = [c[0] for c in constraints if c[1] == 'inbound']
            if inbound_fk:
                cur.execute(f"ALTER TABLE inbound DROP FOREIGN KEY {inbound_fk[0]}")
                print(f"  - 기존 외래키 {inbound_fk[0]} 삭제 완료")

            cur.execute("ALTER TABLE inbound MODIFY COLUMN item_id INT NULL")
            print("  - item_id 컬럼을 NULL 허용으로 변경 완료")

            cur.execute("""
                ALTER TABLE inbound
                ADD CONSTRAINT fk_inbound_item
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
            """)
            print("  - 새 외래키 (ON DELETE SET NULL) 추가 완료")

            # 3. rental_history 테이블 수정
            print("\n[2/3] rental_history 테이블 외래키 수정...")
            rental_fk = [c[0] for c in constraints if c[1] == 'rental_history']
            if rental_fk:
                cur.execute(f"ALTER TABLE rental_history DROP FOREIGN KEY {rental_fk[0]}")
                print(f"  - 기존 외래키 {rental_fk[0]} 삭제 완료")

            cur.execute("ALTER TABLE rental_history MODIFY COLUMN item_id INT NULL")
            print("  - item_id 컬럼을 NULL 허용으로 변경 완료")

            cur.execute("""
                ALTER TABLE rental_history
                ADD CONSTRAINT fk_rental_item
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
            """)
            print("  - 새 외래키 (ON DELETE SET NULL) 추가 완료")

            # 4. delivery_history 테이블 수정
            print("\n[3/3] delivery_history 테이블 외래키 수정...")
            delivery_fk = [c[0] for c in constraints if c[1] == 'delivery_history']
            if delivery_fk:
                cur.execute(f"ALTER TABLE delivery_history DROP FOREIGN KEY {delivery_fk[0]}")
                print(f"  - 기존 외래키 {delivery_fk[0]} 삭제 완료")

            cur.execute("ALTER TABLE delivery_history MODIFY COLUMN item_id INT NULL")
            print("  - item_id 컬럼을 NULL 허용으로 변경 완료")

            cur.execute("""
                ALTER TABLE delivery_history
                ADD CONSTRAINT fk_delivery_item
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
            """)
            print("  - 새 외래키 (ON DELETE SET NULL) 추가 완료")

            conn.commit()
            print("\n✅ 마이그레이션 완료!")
            print("이제 재고 삭제 시 입고/대여/납품 기록이 유지됩니다 (item_id는 NULL로 변경됨)")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ 에러 발생: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
