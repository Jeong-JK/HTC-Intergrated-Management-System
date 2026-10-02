#!/usr/bin/env python3
"""
HTC Sales Pipeline DB 명령 실행 도구
사용법: python3 db_exec.py "SQL 쿼리"
예시: python3 db_exec.py "SHOW TABLES;"
"""
import sys
import pymysql
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def main():
    if len(sys.argv) < 2:
        print("사용법: python3 db_exec.py \"SQL 쿼리\"")
        print('예시: python3 db_exec.py "SHOW TABLES;"')
        sys.exit(1)

    sql = sys.argv[1]

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
            cur.execute(sql)

            # SELECT 쿼리인 경우 결과 출력
            if sql.strip().upper().startswith('SELECT') or sql.strip().upper().startswith('SHOW') or sql.strip().upper().startswith('DESC'):
                results = cur.fetchall()
                if results:
                    for row in results:
                        print(row)
                else:
                    print("(결과 없음)")
            else:
                print(f"✓ 실행 완료 (영향받은 행: {cur.rowcount})")
    except Exception as e:
        print(f"✗ 오류: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
