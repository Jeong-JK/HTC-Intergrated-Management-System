# HTC Sales Pipeline Rules

**이 디렉터리는 영업 파이프라인(Pipeline) 관리 전용입니다.**

## 📋 범위
- 영업 기회 관리
- 거래처/담당자 관리
- 파이프라인 단계 추적
- 활동 이력 및 견적 관리

## 🗄️ Database Info
- **DB:** `htc_pipeline` (MySQL/MariaDB)
- **Host:** localhost
- **Ports:** Frontend 3001, Backend 8001
- **Config:** 환경변수는 `backend/.env` 파일에서 설정 (`.env.example` 참고)

### DB 접속 방법
```bash
cd /home/ec2-user/sales-app/backend

# 테이블 목록
python3 db_exec.py "SHOW TABLES;"

# 테이블 구조
python3 db_exec.py "DESC opportunities;"

# 데이터 조회
python3 db_exec.py "SELECT * FROM opportunities LIMIT 5;"

# 스키마 변경 (ALTER TABLE 시 database.py도 함께 수정 필수!)
python3 db_exec.py "ALTER TABLE opportunities ADD COLUMN new_col VARCHAR(100);"

# 데이터 수정
python3 db_exec.py "UPDATE opportunities SET stage='Closed Won' WHERE id=1;"
```

### DB 초기 생성
```bash
cd /home/ec2-user/sales-app/backend
mysql -u $DB_USER -p < create_pipeline_db.sql
```

**⚠️ CRITICAL: 빌드/재시작 명령어는 절대 AI가 실행하지 않음. 무슨 일이 있어도 사용자가 직접 실행. AI는 명령어만 제공.**

**빌드/재시작 명령어:**
- FE 빌드: `cd /home/ec2-user/sales-app/frontend && npm run build`
- BE 재시작: `sudo fuser -k 8001/tcp && cd /home/ec2-user/sales-app/backend && nohup python3 main.py > server.log 2>&1 &`

## 📂 Structure & Stack
- **Path:** `/home/ec2-user/sales-app/` (frontend/backend)
- **Stack:** FastAPI, React+Vite
- **Core Tables:** `accounts`, `contacts`, `pipeline_stages`, `opportunities`, `activities`, `products`, `opportunity_products`
- **Other Apps:**
  - Inventory: `/home/ec2-user/inventory-app/`
  - Partner CRM: `/home/ec2-user/crm-app/`

## 📊 주요 테이블
- `accounts` - 거래처
- `contacts` - 담당자
- `pipeline_stages` - 영업 단계
- `opportunities` - 영업 기회
- `activities` - 활동 이력
- `products` - 제품/서비스
- `opportunity_products` - 견적 항목

## 📝 Development Rules
- **DB 변경:** `ALTER TABLE` 명령어 및 `database.py` 스키마 동시 업데이트 필수
- **DO NOT** auto-build or auto-restart servers
- **ALWAYS** provide build/restart commands at the end of work
- User will manually execute the commands
- **빨간색 버튼/배지:** Tailwind 클래스(`bg-red-500`)가 아닌 **인라인 스타일 `backgroundColor: '#ef4444'` 사용 필수**. inventory-app의 AlertBell.jsx 패턴을 따라야 일관되게 렌더링됨.
