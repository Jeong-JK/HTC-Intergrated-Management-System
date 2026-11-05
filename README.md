# HTC Integrated Management System

통합 재고 / 영업 / 파트너 / 업무일지 관리 시스템

## 시스템 구성

| 앱 | 도메인 | 설명 | 포트 |
|---|---|---|---|
| **inventory-app** | `ims.hltac.com` | 메인 허브 (로그인, 게시판, 사용자 관리, Drive) | BE 8000 |
| 〃 | `inv.hltac.com` | 재고관리 | BE 8000 |
| 〃 | `cal.hltac.com` | 업무일지 캘린더 | BE 8000 |
| **sales-app** | `sales.hltac.com` | 영업 파이프라인 | BE 8001 |
| **crm-app** | `crm.hltac.com` | 파트너/고객 CRM | BE 8002 |

- 메인 허브·재고관리·업무일지는 **같은 앱(inventory-app)** 이며, 프론트엔드가 접속 도메인을 보고 화면을 나눕니다 (`frontend/src/site.js`).
- 로그인/세션은 inventory-app이 담당합니다. sales·crm은 요청마다 inventory-app의 `/api/auth/me`로 인증을 확인하고, 세션 쿠키는 `.hltac.com` 전체에서 공유됩니다.
- nginx가 도메인별로 각 백엔드에 연결하고, 각 백엔드는 빌드된 프론트엔드(`frontend/dist`)를 함께 서빙합니다.

```
브라우저 ─▶ nginx (HTTPS)
             ├─ ims / inv / cal.hltac.com ─▶ :8000 inventory-app ──┐
             ├─ sales.hltac.com           ─▶ :8001 sales-app ──────┼─▶ 인증 확인 (:8000)
             └─ crm.hltac.com             ─▶ :8002 crm-app ────────┘
                                              │
                                        MariaDB (htc_inventory / htc_pipeline / htc_sales)
```

## 기술 스택

### Backend
- **Framework:** FastAPI (Python)
- **Database:** MariaDB / MySQL
- **DB 접근:** PyMySQL (Raw SQL)

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **기타:** React Router, dayjs, lucide-react

## 디렉토리 구조

```
.
├── inventory-app/          # 메인 허브 + 재고관리 + 업무일지
│   ├── frontend/           # React + Vite
│   │   └── src/
│   │       ├── site.js         # 도메인별 화면 분기
│   │       ├── apps/           # 재고관리 레이아웃
│   │       ├── pages/          # 허브, 게시판, 사용자 관리, 업무일지 등
│   │       └── components/     # 공용 컴포넌트 (Common, MonthNav 등)
│   └── backend/            # FastAPI
│       └── routers/        # auth, items, rental, work_logs ...
├── sales-app/              # 영업 파이프라인
│   ├── frontend/
│   └── backend/            # Google Sheets 연동 포함
└── crm-app/                # 파트너 CRM
    ├── frontend/
    └── backend/            # Google Drive 연동 포함
```

## 주요 기능

### 메인 허브 (ims)
- 로그인 / 세션 관리 (1시간 미활동 시 자동 로그아웃)
- 게시판 (공지, 댓글, 알림)
- 사용자 관리 및 세부 권한 설정 (관리자)
- Admin Drive (관리자 전용 파일 저장소)

### 재고관리 (inv)
- 제품 재고 관리 (라디오, 안테나, 악세사리)
- 입출고 관리 및 이력 추적
- 대여/반납, 납품 관리
- 대여 캘린더 (월간, 년월 직접 입력, 스크롤 끝에서 휠로 달 이동)
- 랙 위치 관리, 반납 알림

### 업무일지 캘린더 (cal)
- 일일/기간별 업무일지 작성 (기간 지정 시 전체 기간에 일괄 적용)
- 월간 / 주간(월~금) / 일간 / 상세(직원별 한 달 목록) 보기
- 월간 캘린더에 날짜별 작성자 표시, 캘린더 상단에 당일 미작성자 표시

### Sales Pipeline (sales)
- 프로젝트 관리, 매입/매출 관리
- 견적 관리, 주간 스케줄 관리
- 마진율 자동 계산
- Google Sheets 연동 (시트 ↔ DB 동기화)

### CRM (crm)
- 업체 / 팀 / 담당자 관리
- 미팅 이력 관리
- Google Drive 연동

## 권한 체계

사용자 관리 화면에서 사용자별로 부여합니다. 관리자는 모든 권한을 가집니다. 권한은 로그인 시 세션에 저장되므로 **변경 후 다시 로그인해야 적용**됩니다.

| 영역 | 권한 |
|---|---|
| 공통 | 삭제 |
| Sales Pipeline | 접근, 매입/프로젝트/Weekly 수정·삭제 |
| CRM | 업체 추가·수정·삭제, 미팅 조회·추가·삭제, 이직 처리 |
| 업무일지 | 접근, 본인 일지 작성·수정·삭제, 업무일지관리자(다른 직원 일지 열람만) |

- 업무일지: 다른 직원 일지의 수정·삭제와 대리 작성은 관리자만 가능합니다. 권한 검사는 백엔드 API에서도 동일하게 수행합니다.

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
cd [app]/backend && pip install -r requirements.txt

# Frontend (각 앱별)
cd [app]/frontend && npm install
```

### 3. 데이터베이스
- 각 백엔드는 시작 시 필요한 테이블을 자동 생성합니다 (`CREATE TABLE IF NOT EXISTS`, 신규 권한 컬럼은 `ADD COLUMN IF NOT EXISTS`).
- sales-app 초기 스키마: `sales-app/backend/create_pipeline_db.sql`

### 4. 실행

```bash
# 개발
cd [app]/backend && uvicorn main:app --port [8000|8001|8002]
cd [app]/frontend && npm run dev          # /api 는 해당 백엔드로 프록시

# 운영: 프론트 빌드 후 백엔드가 frontend/dist 를 서빙
cd [app]/frontend && npm run build
```

> 프론트엔드를 다시 빌드한 뒤에는 브라우저 캐시 때문에 이전 화면이 보일 수 있습니다. 운영 nginx는 HTML 응답에 `Cache-Control: no-cache`를 붙여 새 빌드가 바로 반영되도록 설정되어 있습니다.

## 데이터베이스 구조

### htc_inventory (메인 허브 / 재고 / 업무일지)
- `users`, `sessions` - 사용자, 권한, 로그인 세션
- `items` - 제품 마스터
- `inbound` - 입고 기록
- `rental_history` - 대여 이력
- `delivery_history` - 납품 이력
- `posts`, `post_comments`, `post_reads`, `comment_notifications` - 게시판
- `work_log_masters`, `work_log_items` - 업무일지 (기간 묶음 / 항목)

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
