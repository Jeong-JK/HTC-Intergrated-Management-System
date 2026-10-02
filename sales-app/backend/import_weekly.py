"""2026Y Weekly HTML 파일을 파싱하여 weekly_schedule 테이블에 삽입"""
from bs4 import BeautifulSoup
import re
import json
from database import db_cursor

# CSS 클래스별 막대 색상 (회색 제외)
BAR_COLORS = {
    # 청록 계열
    's46': '#d0e0e3', 's47': '#d0e0e3', 's50': '#d0e0e3', 's51': '#d0e0e3',
    's43': '#a2c4c9',
    # 파랑 계열
    's65': '#9fc5e8', 's66': '#9fc5e8', 's67': '#9fc5e8',
    's52': '#a4c2f4', 's53': '#c9daf8', 's54': '#c9daf8',
    's79': '#cfe2f3', 's80': '#cfe2f3',
    's104': '#6fa8dc',
    # 노랑 계열
    's55': '#ffe599', 's70': '#ffe599', 's71': '#ffe599', 's72': '#ffe599',
    's56': '#fff2cc', 's57': '#fff2cc', 's58': '#fff2cc', 's73': '#fff2cc',
    # 주황/복숭아 계열
    's59': '#f9cb9c', 's60': '#f9cb9c', 's61': '#f9cb9c', 's62': '#f9cb9c',
    's64': '#fce5cd', 's81': '#fce5cd', 's82': '#fce5cd',
    # 틸 계열
    's74': '#46bdc6', 's75': '#46bdc6', 's76': '#46bdc6', 's102': '#46bdc6',
    # 분홍/자주 계열
    's83': '#c27ba0', 's84': '#c27ba0', 's85': '#c27ba0',
    's86': '#c27ba0', 's87': '#c27ba0', 's88': '#c27ba0', 's89': '#c27ba0',
    # 보라 계열
    's91': '#b4a7d6', 's92': '#b4a7d6', 's93': '#b4a7d6', 's94': '#b4a7d6',
    's96': '#d9d2e9', 's97': '#d9d2e9',
    # 빨강 계열
    's98': '#ea9999', 's99': '#ea9999', 's100': '#ea9999', 's101': '#ea9999',
    # 초록 계열
    's103': '#93c47d', 's105': '#93c47d',
}

def get_bar_color(cell):
    """셀의 CSS 클래스에서 막대 색상 추출"""
    classes = cell.get('class', [])
    for cls in classes:
        if cls in BAR_COLORS:
            return BAR_COLORS[cls]
    return None

def parse_weekly_html(html_path):
    """Weekly HTML 파싱"""
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    table = soup.find('table', class_='waffle')
    if not table:
        print("테이블을 찾을 수 없습니다")
        return []

    rows = table.find_all('tr')
    data = []
    current_project = None
    current_customer_project = None

    for row in rows:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 10:
            continue

        texts = [c.get_text(strip=True) for c in cells]

        # 두 번째 셀([1])이 26-XX 패턴이면 프로젝트 행 (첫 번째 셀은 행 번호)
        project_no = None
        is_project_row = False

        if len(texts) > 1 and re.match(r'26-\d+', texts[1]):
            project_no = texts[1]
            current_project = project_no
            is_project_row = True

        # 데이터 추출 위치 결정
        if is_project_row:
            # 프로젝트 행 (66셀): [0]=행번호, [1]=project_no, [2]=업체/프로젝트, [3]=품목, [4]=수량, [5]=업체, [6-13]=노트/기타, [14]~=주차
            customer_project_cell = cells[2] if len(cells) > 2 else None
            product_name = texts[3] if len(texts) > 3 else ''
            quantity_str = texts[4] if len(texts) > 4 else '1'
            supplier = texts[5] if len(texts) > 5 else ''
            week_start_idx = 14  # 주차는 14번 인덱스부터

            # 업체명/프로젝트명 파싱 (br 태그로 분리)
            if customer_project_cell:
                for br in customer_project_cell.find_all('br'):
                    br.replace_with('\n')
                current_customer_project = customer_project_cell.get_text().strip()
        else:
            # 서브 아이템 행 (63셀): [0]=행번호, [1]=품목, [2]=수량, [3]=업체, [4-10]=노트/기타, [11]~=주차
            if not current_project:
                continue
            project_no = current_project
            customer_project_cell = None
            product_name = texts[1] if len(texts) > 1 else ''
            quantity_str = texts[2] if len(texts) > 2 else '1'
            supplier = texts[3] if len(texts) > 3 else ''
            week_start_idx = 11  # 주차는 11번 인덱스부터

        # 품목명이 비어있으면 스킵
        if not product_name or product_name == '' or product_name.isspace():
            continue

        # 수량 파싱
        try:
            quantity = int(re.sub(r'[^\d]', '', quantity_str)) if quantity_str else 1
            if quantity == 0:
                quantity = 1
        except:
            quantity = 1

        # 업체명/프로젝트명 - 서브 아이템은 현재 프로젝트의 것을 상속
        customer_project = current_customer_project if current_customer_project else ''

        # 주차별 막대 데이터 추출
        week_data = {}
        week_cells = cells[week_start_idx:] if len(cells) > week_start_idx else []

        for i, cell in enumerate(week_cells):
            color = get_bar_color(cell)
            if color:
                # 주차 번호 계산 (월별 주차)
                # 1월: 1~5주, 2월: 6~10주, ...
                week_num = i + 1
                month = (week_num - 1) // 5 + 1
                week_in_month = (week_num - 1) % 5 + 1

                if month <= 12:
                    key = f"{month}_{week_in_month}"
                    week_data[key] = color

        row_data = {
            'year': 2026,
            'project_no': project_no,
            'customer_project': customer_project,
            'product_name': product_name,
            'quantity': quantity,
            'supplier': supplier,
            'notes': '',
            'week_data': week_data if week_data else None
        }
        data.append(row_data)

    return data

def preview_data(data, limit=30):
    """데이터 미리보기"""
    print(f"\n총 {len(data)}개 항목 발견")
    print("=" * 80)

    bar_count = 0
    for i, row in enumerate(data[:limit]):
        cp = row['customer_project'].replace('\n', ' / ') if row['customer_project'] else ''
        print(f"[{i+1}] {row['project_no']}: {cp}")
        print(f"    품목: {row['product_name'][:40]}... | 수량: {row['quantity']} | 업체: {row['supplier']}")
        if row['week_data']:
            bar_count += 1
            weeks = list(row['week_data'].keys())[:5]
            print(f"    막대: {len(row['week_data'])}개 주차 - {weeks}...")
        print()

    if len(data) > limit:
        print(f"... 외 {len(data) - limit}개 더")

    print(f"\n막대 데이터 있는 항목: {bar_count}개")

def insert_to_db(data, dry_run=True):
    """DB에 데이터 삽입"""
    if dry_run:
        print("\n[DRY RUN] 실제 삽입하지 않음")
        preview_data(data)
        return 0

    inserted = 0
    with db_cursor() as cur:
        # 기존 데이터 삭제
        cur.execute("DELETE FROM weekly_schedule WHERE year = 2026")
        print(f"기존 데이터 삭제 완료")

        for row in data:
            week_data_json = json.dumps(row['week_data']) if row['week_data'] else None

            cur.execute("""
                INSERT INTO weekly_schedule
                (year, project_no, customer_project, product_name, quantity, supplier, notes, week_data)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                row['year'], row['project_no'], row['customer_project'],
                row['product_name'], row['quantity'], row['supplier'],
                row['notes'], week_data_json
            ))
            inserted += 1

    print(f"\n{inserted}개 항목 삽입 완료")
    return inserted

if __name__ == '__main__':
    import sys

    html_path = '/home/ec2-user/inventory-app/backend/uploads/admin_drive/2026Y Weekly.html'

    print("Weekly HTML 파일 파싱 중...")
    data = parse_weekly_html(html_path)

    if '--insert' in sys.argv:
        insert_to_db(data, dry_run=False)
    else:
        insert_to_db(data, dry_run=True)
        print("\n실제 삽입하려면: python3 import_weekly.py --insert")
