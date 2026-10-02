-- HTC Sales Pipeline DB 생성 스크립트
-- 실행 방법: mysql -u root -p < create_pipeline_db.sql

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS htc_pipeline CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE htc_pipeline;

-- ==================== 1. 매입 관리 (Purchase Management) ====================
-- 엑셀 "2026Y 매입" 시트
CREATE TABLE IF NOT EXISTS purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL COMMENT '연도 (2025, 2026)',
    po_number VARCHAR(100) NOT NULL COMMENT 'PO 발주서 번호',
    quote VARCHAR(100) DEFAULT NULL COMMENT 'Quote 번호',
    oc VARCHAR(100) DEFAULT NULL COMMENT 'OC 번호',
    invoice VARCHAR(100) DEFAULT NULL COMMENT 'Invoice 번호',
    request_number VARCHAR(50) DEFAULT NULL COMMENT '품의번호',
    supplier VARCHAR(200) NOT NULL COMMENT '공급사',
    project VARCHAR(300) DEFAULT NULL COMMENT 'Project (Customer_PJT)',
    product_name VARCHAR(300) NOT NULL COMMENT '품목명',
    quantity INT DEFAULT 1 COMMENT '수량',
    net_price DECIMAL(15,2) DEFAULT 0 COMMENT '단가',
    currency VARCHAR(10) DEFAULT 'USD' COMMENT '통화',
    amount DECIMAL(15,2) DEFAULT 0 COMMENT '금액',
    expected_date VARCHAR(100) DEFAULT NULL COMMENT '입고예정일',
    received_status VARCHAR(50) DEFAULT '미입고' COMMENT '입고여부',

    -- 송금 정보
    payment_date1 VARCHAR(100) DEFAULT NULL COMMENT '송금일1',
    payment_amount1 DECIMAL(15,2) DEFAULT 0 COMMENT '송금액1',
    exchange_rate1 DECIMAL(10,2) DEFAULT NULL COMMENT '환율1',
    payment_date2 VARCHAR(100) DEFAULT NULL COMMENT '송금일2',
    payment_amount2 DECIMAL(15,2) DEFAULT 0 COMMENT '송금액2',
    exchange_rate2 DECIMAL(10,2) DEFAULT NULL COMMENT '환율2',

    -- Weekly 바 정보
    bar_note VARCHAR(100) DEFAULT NULL COMMENT '바 노트',
    bar_start_date DATE DEFAULT NULL COMMENT '바 시작일',
    bar_end_date DATE DEFAULT NULL COMMENT '바 종료일',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_year (year),
    INDEX idx_po_number (po_number),
    INDEX idx_supplier (supplier),
    INDEX idx_project (project),
    INDEX idx_received (received_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='매입 관리';

-- ==================== 2. 프로젝트 관리 (Project Management) ====================
-- 엑셀 "2026Y 프로젝트" 시트
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL COMMENT '연도 (2025, 2026)',
    project_no VARCHAR(50) NOT NULL COMMENT '프로젝트 번호 (예: 26-01)',
    customer VARCHAR(200) NOT NULL COMMENT '업체명',
    project_name VARCHAR(300) NOT NULL COMMENT '프로젝트명',
    supplier VARCHAR(200) DEFAULT NULL COMMENT '공급사',
    delivery_date VARCHAR(100) DEFAULT NULL COMMENT '납기요청일',
    order_amount DECIMAL(15,2) DEFAULT 0 COMMENT '수주금액',
    order_date VARCHAR(100) DEFAULT NULL COMMENT '업체 발주일',
    payment_date VARCHAR(100) DEFAULT NULL COMMENT '수금일',
    payment_amount DECIMAL(15,2) DEFAULT 0 COMMENT '수금액',
    payment_status DECIMAL(5,4) DEFAULT NULL COMMENT '수금 진행률',
    status VARCHAR(50) DEFAULT '진행중' COMMENT '프로젝트 상태',
    notes TEXT COMMENT '비고',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_year (year),
    INDEX idx_project_no (project_no),
    INDEX idx_customer (customer),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='프로젝트';

-- 프로젝트 수금 정보
CREATE TABLE IF NOT EXISTS project_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    payment_date DATE NOT NULL COMMENT '수금일',
    payment_amount DECIMAL(15,2) NOT NULL COMMENT '수금액',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='수금 정보';

-- 판매 품목 (매출)
CREATE TABLE IF NOT EXISTS sales_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    product_name VARCHAR(300) NOT NULL COMMENT '품목명',
    quantity INT DEFAULT 1 COMMENT '수량',
    unit_price DECIMAL(15,2) DEFAULT 0 COMMENT '단가',
    total_price DECIMAL(15,2) DEFAULT 0 COMMENT '총금액',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='판매 품목';

-- 매입 품목 (프로젝트별)
CREATE TABLE IF NOT EXISTS purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    po_number VARCHAR(100) DEFAULT NULL COMMENT '매입(발주서)',
    supplier VARCHAR(200) NOT NULL COMMENT '공급사',
    product_name VARCHAR(300) NOT NULL COMMENT '품목명',
    quantity INT DEFAULT 1 COMMENT '수량',
    unit_price_usd DECIMAL(15,2) DEFAULT 0 COMMENT '단가($)',
    unit_price_krw DECIMAL(15,2) DEFAULT 0 COMMENT '단가(₩)',
    total_price_usd DECIMAL(15,2) DEFAULT 0 COMMENT '총금액($)',
    total_price_krw DECIMAL(15,2) DEFAULT 0 COMMENT '총금액(₩)',
    expected_date VARCHAR(100) DEFAULT NULL COMMENT '입고예정일',
    received_status VARCHAR(50) DEFAULT '미입고' COMMENT '입고여부',
    payment_status DECIMAL(5,4) DEFAULT NULL COMMENT '송금현황',
    exchange_rate DECIMAL(10,2) DEFAULT NULL COMMENT '평균환율',
    actual_order_date VARCHAR(100) DEFAULT NULL COMMENT '실제 발주일 (배송비 절감을 위해 다른 연도 물품과 함께 발주한 경우)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project (project_id),
    INDEX idx_po_number (po_number),
    INDEX idx_supplier (supplier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='프로젝트 매입';

-- ==================== 3. Weekly 일정 관리 ====================
-- 엑셀 "2026Y Weekly" 시트
CREATE TABLE IF NOT EXISTS weekly_schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL COMMENT '연도',
    project_no VARCHAR(50) NOT NULL COMMENT '프로젝트 번호',
    customer_project VARCHAR(300) NOT NULL COMMENT '업체(프로젝트)',
    product_name VARCHAR(300) NOT NULL COMMENT '품목',
    quantity INT DEFAULT 1 COMMENT '수량',
    supplier VARCHAR(200) DEFAULT NULL COMMENT '공급사',
    notes TEXT COMMENT '특이사항',
    week_data JSON COMMENT '주차별 데이터',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_year (year),
    INDEX idx_project_no (project_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Weekly 일정';

-- 완료 메시지
SELECT 'htc_pipeline DB 생성 완료!' AS message;
