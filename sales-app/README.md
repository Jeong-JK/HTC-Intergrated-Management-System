# HTC Sales Pipeline

영업 파이프라인 관리 시스템

## 데이터베이스
- DB: `htc_pipeline` (신규 생성 필요)
- 환경변수 설정: `backend/.env.example`을 참고하여 `backend/.env` 파일 생성

### DB 생성하기
```bash
cd /home/ec2-user/sales-app/backend
mysql -u root -p < create_pipeline_db.sql
```

## 포트 설정
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:8001`

## 실행 명령어

### 프론트엔드
```bash
cd /home/ec2-user/sales-app/frontend
npm install  # 최초 1회만
npm run build
```

### 백엔드
```bash
# 기존 프로세스 종료 후 실행
pkill -9 -f "uvicorn.*8001"
cd /home/ec2-user/sales-app/backend
nohup python3 main.py > server.log 2>&1 &
```

## 주요 기능 (예정)
- 영업 기회 관리 (Opportunities)
- 거래처 관리 (Accounts)
- 담당자 관리 (Contacts)
- 파이프라인 단계 관리
- 활동 이력 추적
- 제품/견적 관리

## DB 테이블 구조
- `accounts` - 거래처
- `contacts` - 담당자
- `pipeline_stages` - 영업 단계
- `opportunities` - 영업 기회
- `activities` - 활동 이력
- `products` - 제품/서비스
- `opportunity_products` - 견적 항목
