# HTC Partner CRM

파트너/고객 관계 관리 시스템 (v2.0.7 웹 버전)

## 데이터베이스
- DB: `htc_sales` (기존 DB 사용)
- 환경변수 설정: `backend/.env.example` 참고

## 포트 설정
- Frontend: `http://localhost:3002`
- Backend: `http://localhost:8002`

## 실행 명령어

### 프론트엔드
```bash
cd /home/ec2-user/crm-app/frontend
npm install  # 최초 1회만
npm run build
```

### 백엔드
```bash
# 기존 프로세스 종료 후 실행
pkill -9 -f "uvicorn.*8002"
cd /home/ec2-user/crm-app/backend
nohup python3 main.py > server.log 2>&1 &
```

## 주요 기능
- 업체 관리 (Companies)
- 팀 관리 (Teams)
- 담당자 관리 (Contacts)
- 미팅 이력 관리
- Google Drive 연동 (옵션)

## DB 테이블 구조
- `companies` - 업체 정보
- `teams` - 팀 정보
- `contacts` - 담당자 정보
- 기타 미팅, 활동 관련 테이블

## 참고
- 기존 PyQt6 데스크톱 버전: `htc-partner-crm-v2_0_7.py`
- 웹 버전으로 포팅 진행 중
