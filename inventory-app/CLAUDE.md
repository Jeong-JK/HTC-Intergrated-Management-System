# HTC Inventory Rules

## 🗄️ Database Info
- **DB:** `htc_inventory` (MySQL/MariaDB) + `htc_sales` (업체/담당자 자동완성용)
- **Tables:** items, rental_history, delivery_history, inbound

### DB 접속 방법
```bash
cd /home/ec2-user/inventory-app/backend

# 테이블 목록
python3 db_exec.py "SHOW TABLES;"

# 테이블 구조
python3 db_exec.py "DESC rental_history;"

# 데이터 조회
python3 db_exec.py "SELECT * FROM rental_history LIMIT 5;"

# 스키마 변경 (ALTER TABLE 시 database.py도 함께 수정 필수!)
python3 db_exec.py "ALTER TABLE rental_history ADD COLUMN new_col VARCHAR(100);"

# 데이터 수정
python3 db_exec.py "UPDATE items SET status='데모' WHERE id=1;"
```

**⚠️ CRITICAL: 빌드/재시작 명령어는 절대 AI가 실행하지 않음. 무슨 일이 있어도 사용자가 직접 실행. AI는 명령어만 제공.**

**빌드/재시작 명령어:**
- FE 빌드: `cd /home/ec2-user/inventory-app/frontend && npm run build`
- BE 재시작: `sudo fuser -k 8000/tcp && cd /home/ec2-user/inventory-app/backend && nohup python3 main.py > server.log 2>&1 &`

[cite_start]**Stack:** FastAPI, React+Vite 

**Key Features & Rules:**
1. [cite_start]**DB 변경:** `ALTER TABLE` 명령어 및 `database.py` 스키마 동시 업데이트 필수 [cite: 3]
2. [cite_start]**용어:** 반드시 "대여 이력", "납품 이력" 사용 ("내역" 금지) [cite: 3]
3. **Serial/IP:** 서로 다른 개념. Serial 자동입력 절대 불가. [cite_start]IP는 품명 선택 시 종속된 드롭다운으로 표시 [cite: 3, 4]
4. **대여(OutRental) 특징:** 단가/환율 필드 없음. [cite_start]업체/담당자/연락처, 대여사유, 대여/반납일(미정 버튼). item_id 없이 품명만으로 저장 가능. [cite: 2, 3]
5. **입고(Inbound) 특징:** 단가/환율 필수. 공급처, 입고일 필요. [cite_start]엑셀 스타일 일괄 입력(Enter 이동), 품명 자동완성 [cite: 2, 3]
6. **빨간색 알림 배지:** Tailwind 클래스(`bg-red-500`)가 아닌 **인라인 스타일 `backgroundColor: '#ef4444'` 사용 필수**. AlertBell.jsx 패턴을 따라야 일관되게 렌더링됨.
7. **Admin Drive:** 사용자가 "어드민드라이브에 올려" 또는 "Drive에 저장해" 요청 시, AI가 직접 `/home/ec2-user/inventory-app/backend/uploads/admin_drive/` 폴더에 파일 생성. (최대 1GB)
