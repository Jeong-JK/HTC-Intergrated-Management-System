# HTC Integrated Management System

통합 재고/영업/파트너 관리 시스템

## 시스템 구성

| 앱 | 설명 | 포트 |
|---|---|---|
| **inventory-app** | 재고 관리 시스템 | FE: 3000, BE: 8000 |
| **sales-app** | 영업 파이프라인 관리 | FE: 3001, BE: 8001 |
| **crm-app** | 파트너/고객 CRM | FE: 3002, BE: 8002 |

## 기술 스택

### Backend
- **Framework:** FastAPI (Python)
- **Database:** MariaDB/MySQL
- **ORM:** PyMySQL (Raw SQL)

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **State:** React Hooks

## 디렉토리 구조

```
htc-system/
├── inventory-app/          # 재고 관리
│   ├── frontend/           # React + Vite
│   └── backend/            # FastAPI
├── sales-app/              # 영업 파이프라인
│   ├── frontend/
│   └── backend/
├── crm-app/                # 파트너 CRM
│   ├── frontend/
│   └── backend/
└── database/               # DB 스키마
```

## 주요 기능

### Inventory App (재고 관리)
- 제품 재고 관리 (라디오, 안테나, 악세사리)
- 입출고 관리 및 이력 추적
- 대여/반납 관리
- 납품 관리
- 랙 위치 관리
- 실시간 알림 시스템

### Sales App (영업 파이프라인)
- 프로젝트 관리
- 매입/매출 관리
- 견적 관리
- 주간 스케줄 관리
- 마진율 자동 계산

### CRM App (파트너 관리)
- 업체/담당자 관리
- 미팅 이력 관리
- Google Drive 연동
- 컨택 관리

## 설치 및 실행

### 1. 환경 설정
각 앱의 `backend/.env.example`을 참고하여 `.env` 파일 생성:

```bash
cp inventory-app/backend/.env.example inventory-app/backend/.env
cp sales-app/backend/.env.example sales-app/backend/.env
cp crm-app/backend/.env.example crm-app/backend/.env
```

### 2. 의존성 설치

```bash
# Backend (각 앱별)
cd inventory-app/backend && pip install -r requirements.txt
cd sales-app/backend && pip install -r requirements.txt
cd crm-app/backend && pip install -r requirements.txt

# Frontend (각 앱별)
cd inventory-app/frontend && npm install
cd sales-app/frontend && npm install
cd crm-app/frontend && npm install
```

### 3. 데이터베이스 설정
```bash
# DB 생성 (sales-app 예시)
mysql -u root -p < sales-app/backend/create_pipeline_db.sql
```

### 4. 실행

```bash
# Backend
cd [app]/backend && python main.py

# Frontend (개발)
cd [app]/frontend && npm run dev

# Frontend (빌드)
cd [app]/frontend && npm run build
```

## 데이터베이스 구조

### htc_inventory (재고)
- `items` - 제품 마스터
- `rental_history` - 대여 이력
- `delivery_history` - 납품 이력
- `inbound_records` - 입고 기록

### htc_pipeline (영업)
- `projects` - 프로젝트
- `purchases` - 매입
- `purchase_items` - 매입 상세
- `sales_items` - 판매 상세
- `weekly_schedule` - 주간 스케줄

### htc_sales (CRM)
- `companies` - 업체
- `contacts` - 담당자
- `meetings` - 미팅

## 스크린샷

<img width="946" height="607" alt="image" src="https://github.com/user-attachments/assets/014863f5-ef98-432c-b16c-46c6e589688c" />


## 라이선스

Private - All Rights Reserved
