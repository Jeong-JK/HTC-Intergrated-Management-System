"""Create initial admin user"""
import hashlib
import pymysql
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_admin():
    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, charset="utf8mb4",
        autocommit=True,
    )

    try:
        with conn.cursor() as cur:
            # Create users table if not exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id            INT AUTO_INCREMENT PRIMARY KEY,
                    user_id       VARCHAR(50)    NOT NULL UNIQUE,
                    password_hash VARCHAR(64)    NOT NULL,
                    name          VARCHAR(100)   NOT NULL,
                    is_admin      BOOLEAN        DEFAULT FALSE,
                    created_at    DATETIME       DEFAULT NOW()
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # Check if admin exists
            cur.execute("SELECT id FROM users WHERE user_id = 'admin'")
            if cur.fetchone():
                print("Admin user already exists")
                return

            # Create admin user
            password_hash = hash_password('admin123')
            cur.execute(
                "INSERT INTO users (user_id, password_hash, name, is_admin) VALUES (%s, %s, %s, %s)",
                ('admin', password_hash, '관리자', True)
            )
            print("Admin user created successfully!")
            print("  ID: admin")
            print("  Password: admin123")
            print("  Please change the password after first login!")
    finally:
        conn.close()

if __name__ == "__main__":
    create_admin()
