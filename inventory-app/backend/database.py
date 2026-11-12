"""HTC Inventory — Database Layer v2"""
import pymysql
from pymysql.cursors import DictCursor
from contextlib import contextmanager
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
from config import SALES_DB_HOST, SALES_DB_PORT, SALES_DB_USER, SALES_DB_PASSWORD, SALES_DB_NAME

def get_connection():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
        init_command="SET time_zone='+09:00'"
    )

def get_sales_connection():
    """htc_sales DB 연결"""
    return pymysql.connect(
        host=SALES_DB_HOST, port=SALES_DB_PORT,
        user=SALES_DB_USER, password=SALES_DB_PASSWORD,
        database=SALES_DB_NAME, charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
        init_command="SET time_zone='+09:00'"
    )

@contextmanager
def db_cursor():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

@contextmanager
def sales_db_cursor():
    """htc_sales DB 커서"""
    conn = get_sales_connection()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       VARCHAR(50)    NOT NULL UNIQUE,
    password_hash VARCHAR(255)   NOT NULL,   -- pbkdf2$반복수$salt$hash
    name          VARCHAR(100)   NOT NULL,
    position      VARCHAR(50)    DEFAULT '',
    email         VARCHAR(100)   DEFAULT '',
    phone         VARCHAR(30)    DEFAULT '',
    is_admin      BOOLEAN        DEFAULT FALSE,
    -- 권한 설정 (기본값: 모두 FALSE)
    can_delete           BOOLEAN DEFAULT FALSE,  -- 공통: 모든 삭제 권한
    can_access_sales     BOOLEAN DEFAULT FALSE,  -- Sales: 접근 권한
    can_edit_purchase    BOOLEAN DEFAULT FALSE,  -- Sales: 매입 수정
    can_delete_purchase  BOOLEAN DEFAULT FALSE,  -- Sales: 매입 삭제
    can_edit_project     BOOLEAN DEFAULT FALSE,  -- Sales: 프로젝트 수정
    can_delete_project   BOOLEAN DEFAULT FALSE,  -- Sales: 프로젝트 삭제
    can_edit_weekly      BOOLEAN DEFAULT FALSE,  -- Sales: Weekly 수정
    can_delete_weekly    BOOLEAN DEFAULT FALSE,  -- Sales: Weekly 삭제
    can_add_company      BOOLEAN DEFAULT FALSE,  -- CRM: 업체 추가
    can_edit_company     BOOLEAN DEFAULT FALSE,  -- CRM: 업체 수정
    can_delete_company   BOOLEAN DEFAULT FALSE,  -- CRM: 업체 삭제
    can_view_meeting     BOOLEAN DEFAULT FALSE,  -- CRM: 미팅 조회
    can_add_meeting      BOOLEAN DEFAULT FALSE,  -- CRM: 미팅 추가
    can_delete_meeting   BOOLEAN DEFAULT FALSE,  -- CRM: 미팅 삭제
    can_edit_contact     BOOLEAN DEFAULT FALSE,  -- CRM: 담당자 정보 수정
    can_transfer_contact BOOLEAN DEFAULT FALSE,  -- CRM: 이직 처리
    created_at    DATETIME       DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS items (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    -- 위치 정보
    rack_no       VARCHAR(50)    DEFAULT '',   -- 렉선반번호
    box_no        VARCHAR(50)    DEFAULT '',   -- 박스번호
    -- 분류
    item_type     VARCHAR(20)    NOT NULL DEFAULT '라디오',  -- 라디오/안테나/악세사리
    category      VARCHAR(100)   DEFAULT '',   -- 세부 카테고리
    -- 품목 정보
    item_name     VARCHAR(200)   NOT NULL,
    description   TEXT,
    serial        VARCHAR(200)   DEFAULT '',
    ip            VARCHAR(50)    DEFAULT '',
    mac           VARCHAR(50)    DEFAULT '',
    -- 상태
    status        VARCHAR(30)    DEFAULT '데모',  -- 데모/새제품/대여중/납품예정/납품/분실/수리중/파손
    quantity      INT            DEFAULT 1,      -- 수량 (악세사리용)
    -- 라이센스
    license_key   VARCHAR(500)   DEFAULT '',
    -- 재무
    purchase_date DATE,
    unit_price    DECIMAL(15,2)  DEFAULT 0,
    exchange_rate DECIMAL(10,4)  DEFAULT 0,
    total_price   DECIMAL(15,2)  DEFAULT 0,
    -- 기타
    note          TEXT,
    created_at    DATETIME       DEFAULT NOW(),
    updated_at    DATETIME       DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inbound (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    item_id       INT            NULL,
    quantity      INT            DEFAULT 1,
    supplier      VARCHAR(200)   DEFAULT '',   -- 공급처
    inbound_date  DATE           NOT NULL,
    unit_price    DECIMAL(15,2)  DEFAULT 0,
    exchange_rate DECIMAL(10,4)  DEFAULT 0,
    note          TEXT,
    created_at    DATETIME       DEFAULT NOW(),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rental_history (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT            NULL,       -- 등록한 사용자
    item_id         INT            NULL,
    item_name       VARCHAR(200)   DEFAULT '', -- 품명 (item 삭제되어도 유지)
    description     TEXT,                      -- Serial/IP (item 삭제되어도 유지)
    borrower        VARCHAR(200)   NOT NULL,   -- 대여처/업체명
    contact_name    VARCHAR(100)   DEFAULT '', -- 담당자명
    contact_position VARCHAR(100)  DEFAULT '', -- 담당자 직급
    contact_phone   VARCHAR(50)    DEFAULT '', -- 전화번호
    purpose         VARCHAR(300)   DEFAULT '',
    quantity        INT            DEFAULT 1,
    rent_date       DATE           NOT NULL,
    expected_return DATE,
    returned_at     DATE,
    original_status VARCHAR(50)    DEFAULT '데모', -- 대여 당시 원래 상태 (새제품/데모)
    needs_check     TINYINT(1)     DEFAULT 0,   -- 확인필요 체크
    note            TEXT,
    created_at      DATETIME       DEFAULT NOW(),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS delivery_history (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT            NULL,       -- 등록한 사용자
    item_id       INT            NULL,
    item_name     VARCHAR(200)   DEFAULT '', -- 품명 (item 삭제되어도 유지)
    description   TEXT,                      -- 설명
    serial_ip     VARCHAR(200)   DEFAULT '', -- Serial/IP
    client        VARCHAR(200)   NOT NULL,   -- 납품처
    project_name  VARCHAR(200)   DEFAULT '', -- 프로젝트명
    contact_name  VARCHAR(100)   DEFAULT '', -- 담당자명
    contact_position VARCHAR(100) DEFAULT '', -- 담당자 직급
    contact_phone VARCHAR(50)    DEFAULT '', -- 전화번호
    quantity      INT            DEFAULT 1,
    unit_price    DECIMAL(15,2)  DEFAULT 0,
    delivery_date DATE           NULL,       -- 납품일 (미정 가능)
    status        VARCHAR(30)    DEFAULT '납품예정',  -- 납품예정/납품완료
    note          TEXT,
    created_at    DATETIME       DEFAULT NOW(),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS posts (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT            NOT NULL,
    title      VARCHAR(255)   NOT NULL,
    content    TEXT           NOT NULL,
    is_notice  BOOLEAN        DEFAULT FALSE,
    created_at DATETIME       DEFAULT NOW(),
    updated_at DATETIME       DEFAULT NOW() ON UPDATE NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_reads (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT      NOT NULL,
    user_id INT      NOT NULL,
    read_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_post_user (post_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_comments (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    post_id    INT      NOT NULL,
    user_id    INT      NOT NULL,
    content    TEXT     NOT NULL,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS work_log_masters (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT        NOT NULL,             -- 작성자
    start_date   DATE       NOT NULL,
    end_date     DATE       NOT NULL,             -- 단일 날짜면 start_date와 동일
    is_multi_day BOOLEAN    DEFAULT FALSE,
    created_at   DATETIME   DEFAULT NOW(),
    updated_at   DATETIME   DEFAULT NOW() ON UPDATE NOW(),
    INDEX idx_wlm_range (start_date, end_date),
    INDEX idx_wlm_user_range (user_id, start_date, end_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS work_log_items (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    master_id  BIGINT   NOT NULL,
    item_order INT      NOT NULL DEFAULT 1,
    content    TEXT     NOT NULL,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
    INDEX idx_wli_master (master_id, item_order),
    FOREIGN KEY (master_id) REFERENCES work_log_masters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS maintenance (
    sys_key          VARCHAR(20) PRIMARY KEY,   -- inventory / sales / crm / worklog
    locked           BOOLEAN     NOT NULL DEFAULT FALSE,
    allowed_user_ids TEXT,                      -- JSON 배열: 잠금 중에도 들어올 수 있는 사용자 id
    updated_at       DATETIME    DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 업무일지 권한 + 캘린더 색(#rrggbb, 없으면 화면에서 기본 팔레트) — 기존 users 테이블에 컬럼 추가, 이미 있으면 무시
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS can_access_worklog BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_write_worklog  BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_edit_worklog   BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_delete_worklog BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_manage_worklog BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS worklog_color      VARCHAR(7) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS worklog_hue        VARCHAR(20) DEFAULT NULL;

-- 업무일지별 캘린더 색: 작성자 계열(users.worklog_hue) 안의 단계 0~5 (NULL이면 기본 2)
ALTER TABLE work_log_masters
    ADD COLUMN IF NOT EXISTS color_shade TINYINT DEFAULT NULL;

-- 한 번에 작성했지만 기간이 달라 여러 줄이 된 일지 묶음 = 묶음 첫 줄 id (혼자면 NULL)
ALTER TABLE work_log_masters
    ADD COLUMN IF NOT EXISTS group_id BIGINT DEFAULT NULL,
    ADD INDEX IF NOT EXISTS idx_wlm_group (group_id);

-- 활동 로그(요약: 누가 언제 어디서 무엇을). 사용자를 지워도 기록이 남도록 FK 없음, 1년 보관
CREATE TABLE IF NOT EXISTS activity_logs (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    user_name  VARCHAR(50),
    sys_key    VARCHAR(20)  NOT NULL,   -- hub / inventory / worklog / sales / crm
    method     VARCHAR(10)  NOT NULL,   -- POST / PUT / DELETE / LOGIN
    path       VARCHAR(255) NOT NULL,
    ip         VARCHAR(45),
    created_at DATETIME     DEFAULT NOW(),
    INDEX idx_al_time (created_at),
    INDEX idx_al_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at DATETIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS can_view_activity_log BOOLEAN DEFAULT FALSE;

-- 활동 로그 상세: '홍길동 (현대로템) · 전화번호: 010-1 → 010-2' 처럼 한 줄
ALTER TABLE activity_logs
    ADD COLUMN IF NOT EXISTS detail TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ref_table VARCHAR(40) DEFAULT NULL,  -- 상세 창에서 현재 정보를 찾을 표/행
    ADD COLUMN IF NOT EXISTS ref_id BIGINT DEFAULT NULL;
"""

def init_db():
    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        charset="utf8mb4", autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4")
            cur.execute(f"USE `{DB_NAME}`")
            for stmt in SCHEMA_SQL.strip().split(";"):
                stmt = stmt.strip()
                # 주석 제거 후 실행
                lines = [l for l in stmt.split('\n') if not l.strip().startswith('--')]
                stmt = '\n'.join(lines).strip()
                if stmt:
                    cur.execute(stmt)
    finally:
        conn.close()
