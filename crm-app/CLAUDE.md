# HTC Partner CRM (Web Porting)

## 🏗️ Build & Run Commands
- **Frontend (3002):** `cd /home/ec2-user/crm-app/frontend && npm run build`
- **Backend (8002):** `sudo fuser -k 8002/tcp && cd /home/ec2-user/crm-app/backend && nohup python3 main.py > server.log 2>&1 &`

## 🗄️ Database Info
- **DB:** `htc_sales` (MySQL)
- **Host:** localhost
- **Config:** 환경변수는 `backend/.env` 파일에서 설정 (`.env.example` 참고)
- **Python Migration:** Use `backend/database.py` functions (`get_sales_connection()`, `sales_db_cursor()`)
  - Example: `cd /home/ec2-user/crm-app/backend && python3 migrate_script.py`

## 📂 Structure & Stack
- **Path:** `/home/ec2-user/crm-app/` (frontend/backend)
- **Stack:** FastAPI, React+Vite
- **Core Tables:** `companies`, `teams`, `contacts`, `meetings`
- **Other Apps:**
  - Inventory: `/home/ec2-user/inventory-app/`
  - Sales Pipeline: `/home/ec2-user/sales-app/`

## 📝 Context & Rules
- **Objective:** Porting from PyQt6 (`htc-partner-crm-v2_0_7.py`) to Web.
- **Scope:** Partner/Customer relationship management, G-Drive integration.
- **Development:**
  - **DO NOT** auto-build or auto-restart servers
  - **ALWAYS** provide build/restart commands at the end of work
  - User will manually execute the commands
  - **명령어 제공 규칙:** 프론트엔드만 수정했으면 프론트 빌드 명령어만, 백엔드도 수정했으면 백엔드 재시작 명령어도 함께 제공
  - **빨간색 버튼/배지:** Tailwind 클래스(`bg-red-500`)가 아닌 **인라인 스타일 `backgroundColor: '#ef4444'` 사용 필수**. inventory-app의 AlertBell.jsx 패턴을 따라야 일관되게 렌더링됨.
