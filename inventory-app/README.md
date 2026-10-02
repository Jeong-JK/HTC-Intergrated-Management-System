# HTC Inventory App

재고 관리 시스템

## 스택
- **Backend**: FastAPI + PyMySQL
- **Frontend**: React + Vite + Tailwind CSS
- **DB**: MariaDB (AWS EC2)

## 데이터베이스
- DB: `htc_inventory`
- 환경변수 설정: `backend/.env.example` 참고

## 포트 설정
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

## 로컬 개발

### 백엔드
```bash
cd backend
pip install -r requirements.txt
python main.py
# → http://localhost:8000
# → API 문서: http://localhost:8000/docs
```

### 프론트엔드
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173 (개발 모드)
```

## EC2 배포

### 프론트엔드 빌드
```bash
cd /home/ec2-user/inventory-app/frontend
npm run build
```

### 백엔드 실행
```bash
# 기존 프로세스 종료 후 실행
pkill -9 -f uvicorn
cd /home/ec2-user/inventory-app/backend
nohup python3 main.py > server.log 2>&1 &
```

## 주요 기능
| 기능 | 설명 |
|------|------|
| 재고현황 | 전체 장비 목록, 검색/필터, CSV 내보내기 |
| 장비 추가/수정 | 모든 필드 편집, 총금액 자동계산 |
| 입고 관리 | 엑셀 스타일 일괄 입력, 품명 자동완성 |
| 대여 등록/반납 | 대여자·목적·기간 관리, 반납 처리 |
| 납품 등록 | 납품처·수량·금액 기록 |
| 대여 캘린더 | 월별 대여 현황 시각화 |
| 통계 | 상태별·카테고리별 자산현황 |

## DB 스키마
- `items` — 장비 마스터
- `rental_history` — 대여이력
- `delivery_history` — 납품이력
- `inbound` — 입고 기록
- `companies` — 업체 정보
- `settings` — 드롭다운 설정값
