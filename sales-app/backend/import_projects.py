"""2026Y 프로젝트 HTML 파일을 파싱하여 DB에 삽입 (행 정렬 보존)"""
from bs4 import BeautifulSoup
import re
from database import db_cursor

def parse_price(price_str):
    """가격 문자열 파싱 (예: '₩27,776,000', '$3,200.00')"""
    if not price_str or price_str.strip() == '':
        return 0
    price_str = price_str.strip()
    num_str = price_str.replace('₩', '').replace('$', '').replace(',', '').strip()
    try:
        return float(num_str)
    except:
        return 0

def parse_percent(pct_str):
    """퍼센트 문자열 파싱 (예: '110%', '0%')"""
    if not pct_str or pct_str.strip() == '':
        return 0
    pct_str = pct_str.replace('%', '').strip()
    try:
        return float(pct_str) / 100
    except:
        return 0

def parse_date(date_str):
    """날짜 문자열 파싱"""
    if not date_str or date_str.strip() == '' or date_str.strip() == '-':
        return None
    date_str = date_str.strip()
    match = re.match(r'(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})', date_str)
    if match:
        y, m, d = match.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"
    return date_str

def extract_project_no(text):
    """프로젝트 번호 추출 (예: '26-01(2026.01.01)' -> '26-01')"""
    if not text:
        return None
    match = re.match(r'(26-\d+)', text)
    if match:
        return match.group(1)
    return text

def extract_order_date(text):
    """프로젝트 번호에서 발주일 추출 (예: '26-01(2026.01.01)' -> '2026-01-01')"""
    if not text:
        return None
    match = re.search(r'\((\d{4})\.(\d{1,2})\.(\d{1,2})\)', text)
    if match:
        y, m, d = match.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"
    return None

def extract_status(text):
    """상태 추출"""
    if not text or text.strip() == '':
        return '진행중'
    if '수금필요' in text:
        return '수금필요'
    elif '완료' in text:
        return '완료'
    elif '납기체크' in text:
        return '납기체크'
    elif '진행' in text:
        return '진행중'
    return text

def parse_html_and_extract_data(html_path):
    """HTML 파일 파싱하여 프로젝트 데이터 추출 (행 정렬 보존)"""
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    table = soup.find('table', class_='waffle')
    if not table:
        print("테이블을 찾을 수 없습니다")
        return []

    rows = table.find_all('tr')
    projects = []
    current_project = None
    row_index = 0  # 현재 프로젝트 내 행 인덱스

    for i, row in enumerate(rows):
        cells = row.find_all(['td', 'th'])
        texts = [c.get_text(strip=True) for c in cells]

        if len(texts) < 5:
            continue

        # 새 프로젝트 시작 감지: rowspan이 있고 26-XX 패턴
        has_rowspan = any(c.get('rowspan') for c in cells[:6])
        project_no_match = None
        for idx, t in enumerate(texts[1:6]):
            if t.startswith('26-'):
                project_no_match = t
                break

        if has_rowspan and project_no_match:
            # 이전 프로젝트 저장
            if current_project:
                projects.append(current_project)

            row_index = 0  # 새 프로젝트 시작, 행 인덱스 초기화

            # HTML 구조 (29 컬럼):
            # [0]상태칸 [1]상태 [2]No [3]업체명 [4]프로젝트명 [5]납기 [6]수주금액
            # [7]수금일 [8]수금액 [9]수금현황
            # [10]판매품목 [11]수량 [12]단가 [13]총금액
            # [14]공급사 [15]PO [16]매입품목 [17]수량 [18]단가$ [19]단가₩ [20]총금액$ [21]총금액₩
            # [22]Expected [23]입고 [24]송금% [25]환율
            # [26]전체매입 [27]마진율 [28]매출총이익

            current_project = {
                'year': 2026,
                'project_no': extract_project_no(texts[2]),
                'order_date': extract_order_date(texts[2]),
                'customer': texts[3].replace('\n', ' ').strip(),
                'project_name': texts[4],
                'delivery_date': texts[5],
                'order_amount': parse_price(texts[6]),
                'status': extract_status(texts[1]),
                'rows': [],  # 행별 데이터 저장
                'payments': []
            }

            # 첫 번째 행 데이터 추가
            row_data = {
                'row_index': row_index,
                'sales_item': None,
                'purchase_item': None,
                'payment': None
            }

            # 수금 정보
            if len(texts) > 8 and texts[7]:
                pmt_date = parse_date(texts[7])
                pmt_amount = parse_price(texts[8]) if len(texts) > 8 else 0
                if pmt_date:
                    row_data['payment'] = {
                        'payment_date': pmt_date,
                        'payment_amount': pmt_amount
                    }
                    current_project['payments'].append(row_data['payment'])

            # 판매 품목 (텍스트가 있으면 추가)
            if len(texts) > 10 and texts[10]:
                row_data['sales_item'] = {
                    'product_name': texts[10],
                    'quantity': int(texts[11]) if len(texts) > 11 and texts[11].isdigit() else 1,
                    'unit_price': parse_price(texts[12]) if len(texts) > 12 else 0,
                    'total_price': parse_price(texts[13]) if len(texts) > 13 else 0
                }

            # 매입 품목 (공급사 또는 가격이 있으면 추가)
            if len(texts) > 21:
                supplier = texts[14] if len(texts) > 14 else ''
                po_number = texts[15] if len(texts) > 15 else ''
                product_name = texts[16] if len(texts) > 16 else ''
                has_data = supplier or product_name or parse_price(texts[18] if len(texts) > 18 else '') > 0

                if has_data:
                    row_data['purchase_item'] = {
                        'supplier': supplier,
                        'po_number': po_number,
                        'product_name': product_name,
                        'quantity': int(texts[17]) if len(texts) > 17 and texts[17].isdigit() else 1,
                        'unit_price_usd': parse_price(texts[18]) if len(texts) > 18 else 0,
                        'unit_price_krw': parse_price(texts[19]) if len(texts) > 19 else 0,
                        'total_price_usd': parse_price(texts[20]) if len(texts) > 20 else 0,
                        'total_price_krw': parse_price(texts[21]) if len(texts) > 21 else 0,
                        'expected_date': parse_date(texts[22]) if len(texts) > 22 else None,
                        'received_status': texts[23] if len(texts) > 23 and texts[23] else '',
                        'payment_status': parse_percent(texts[24]) if len(texts) > 24 else 0,
                        'exchange_rate': parse_price(texts[25]) if len(texts) > 25 else None
                    }

            current_project['rows'].append(row_data)
            row_index += 1

        elif current_project:
            # 서브 행 - 프로젝트의 추가 행
            row_data = {
                'row_index': row_index,
                'sales_item': None,
                'purchase_item': None,
                'payment': None
            }

            # 공급사 목록
            suppliers = ['Silvus', 'SWA', 'Octane', 'Bren-Tronics', '퓨리원', '한림',
                        '알에프콘넥타', '루나볼트', '국제전파', 'UKRSPEC']

            # 공급사 위치 찾기
            supplier_idx = -1
            for idx, t in enumerate(texts):
                if t in suppliers:
                    supplier_idx = idx
                    break

            # 수금 정보 찾기 (날짜 패턴)
            for idx in range(min(8, len(texts))):
                if texts[idx] and re.match(r'20\d{2}\.', texts[idx]):
                    pmt_date = parse_date(texts[idx])
                    pmt_amount = parse_price(texts[idx + 1]) if idx + 1 < len(texts) else 0
                    if pmt_date:
                        row_data['payment'] = {
                            'payment_date': pmt_date,
                            'payment_amount': pmt_amount
                        }
                        current_project['payments'].append(row_data['payment'])
                    break

            # 판매 품목 찾기 (공급사 앞에 있는 데이터)
            if supplier_idx > 0:
                # 공급사 앞 4칸 정도에서 판매품목 찾기
                for si in range(max(0, supplier_idx - 4), supplier_idx):
                    txt = texts[si]
                    if txt and not txt.startswith('₩') and not txt.startswith('$') and not txt.isdigit() and '%' not in txt:
                        # 품목명으로 추정
                        if si + 3 < len(texts):
                            qty_txt = texts[si + 1] if si + 1 < len(texts) else ''
                            row_data['sales_item'] = {
                                'product_name': txt,
                                'quantity': int(qty_txt) if qty_txt.isdigit() else 1,
                                'unit_price': parse_price(texts[si + 2]) if si + 2 < len(texts) else 0,
                                'total_price': parse_price(texts[si + 3]) if si + 3 < len(texts) else 0
                            }
                        break
            else:
                # 공급사가 없는 경우 - 판매 품목만 있을 수 있음
                for si in range(len(texts)):
                    txt = texts[si]
                    if txt and not txt.startswith('₩') and not txt.startswith('$') and not txt.isdigit() and '%' not in txt and not re.match(r'20\d{2}\.', txt):
                        # 품목명으로 추정
                        if si + 3 < len(texts):
                            qty_txt = texts[si + 1] if si + 1 < len(texts) else ''
                            if qty_txt.isdigit():
                                row_data['sales_item'] = {
                                    'product_name': txt,
                                    'quantity': int(qty_txt),
                                    'unit_price': parse_price(texts[si + 2]) if si + 2 < len(texts) else 0,
                                    'total_price': parse_price(texts[si + 3]) if si + 3 < len(texts) else 0
                                }
                                break

            # 매입 품목 찾기 (공급사 위치 기준)
            if supplier_idx >= 0 and supplier_idx + 2 < len(texts):
                remaining = texts[supplier_idx:]

                pi = {
                    'supplier': remaining[0] if len(remaining) > 0 else '',
                    'po_number': remaining[1] if len(remaining) > 1 else '',
                    'product_name': remaining[2] if len(remaining) > 2 else '',
                    'quantity': 1,
                    'unit_price_usd': 0,
                    'unit_price_krw': 0,
                    'total_price_usd': 0,
                    'total_price_krw': 0,
                    'expected_date': None,
                    'received_status': '',
                    'payment_status': 0,
                    'exchange_rate': None
                }

                # 수량 찾기
                for ri, rt in enumerate(remaining[3:], start=3):
                    if rt.isdigit():
                        pi['quantity'] = int(rt)
                        # 수량 다음부터 가격 파싱
                        prices_start = ri + 1
                        price_texts = remaining[prices_start:]

                        # 가격 파싱 ($로 시작하거나 ₩로 시작하거나 숫자)
                        prices = []
                        for pt in price_texts:
                            if pt.startswith('$') or pt.startswith('₩'):
                                prices.append(pt)
                            elif pt.replace(',', '').replace('.', '').isdigit() and len(pt) > 0:
                                prices.append(pt)
                            elif re.match(r'20\d{2}\.', pt):
                                pi['expected_date'] = parse_date(pt)
                            elif pt in ['완료', '입고완료', '부분입고', '미입고']:
                                pi['received_status'] = pt
                            elif pt.endswith('%'):
                                pi['payment_status'] = parse_percent(pt)

                        if len(prices) >= 4:
                            pi['unit_price_usd'] = parse_price(prices[0])
                            pi['unit_price_krw'] = parse_price(prices[1])
                            pi['total_price_usd'] = parse_price(prices[2])
                            pi['total_price_krw'] = parse_price(prices[3])
                            if len(prices) >= 5:
                                pi['exchange_rate'] = parse_price(prices[4])
                        elif len(prices) >= 2:
                            pi['unit_price_usd'] = parse_price(prices[0])
                            pi['total_price_usd'] = parse_price(prices[1])
                        break

                if pi['product_name'] or pi['supplier']:
                    row_data['purchase_item'] = pi

            # 판매 또는 매입이 있으면 행 추가
            if row_data['sales_item'] or row_data['purchase_item'] or row_data['payment']:
                current_project['rows'].append(row_data)
                row_index += 1

    # 마지막 프로젝트 저장
    if current_project:
        projects.append(current_project)

    return projects

def preview_data(projects, limit=5):
    """데이터 미리보기"""
    print(f"\n총 {len(projects)}개 프로젝트 발견")
    print("=" * 100)

    for i, p in enumerate(projects[:limit]):
        print(f"\n[{i+1}] {p['project_no']} | {p['customer']} | {p['project_name']}")
        print(f"    수주: ₩{p['order_amount']:,.0f} | 상태: {p['status']} | 납기: {p['delivery_date']}")
        print(f"    행 수: {len(p['rows'])}, 수금: {len(p['payments'])}건")

        for row in p['rows'][:5]:
            si = row.get('sales_item')
            pi = row.get('purchase_item')
            si_str = f"{si['product_name']} x{si['quantity']}" if si else "(빈칸)"
            pi_str = f"{pi['supplier']}/{pi['product_name']}" if pi else "(빈칸)"
            print(f"      [행{row['row_index']}] 판매: {si_str} | 매입: {pi_str}")

    if len(projects) > limit:
        print(f"\n... 외 {len(projects) - limit}개 더")

def insert_to_db(projects, dry_run=True):
    """DB에 데이터 삽입"""
    if dry_run:
        print("\n[DRY RUN] 실제 삽입하지 않음")
        preview_data(projects)
        return 0

    inserted = 0
    with db_cursor() as cur:
        for p in projects:
            # 첫 번째 수금일 + 전체 수금액 합계
            first_payment_date = p['payments'][0]['payment_date'] if p['payments'] else None
            total_payment_amount = sum(pmt['payment_amount'] for pmt in p['payments'])

            # 프로젝트 삽입
            cur.execute("""
                INSERT INTO projects
                (year, project_no, customer, project_name, delivery_date, order_amount, order_date, status, payment_date, payment_amount)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                p['year'], p['project_no'], p['customer'], p['project_name'],
                p['delivery_date'], p['order_amount'], p['order_date'], p['status'],
                first_payment_date, total_payment_amount
            ))
            project_id = cur.lastrowid

            # 수금 정보 삽입 (project_payments)
            for pmt in p['payments']:
                cur.execute("""
                    INSERT INTO project_payments (project_id, payment_date, payment_amount)
                    VALUES (%s, %s, %s)
                """, (project_id, pmt['payment_date'], pmt['payment_amount']))

            # 행별로 판매/매입 품목 삽입
            for row in p['rows']:
                ri = row['row_index']

                # 판매 품목
                si = row.get('sales_item')
                if si:
                    cur.execute("""
                        INSERT INTO sales_items
                        (project_id, product_name, quantity, unit_price, total_price, row_index)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (project_id, si['product_name'], si['quantity'], si['unit_price'], si['total_price'], ri))

                # 매입 품목
                pi = row.get('purchase_item')
                if pi:
                    cur.execute("""
                        INSERT INTO purchase_items
                        (project_id, po_number, supplier, product_name, quantity,
                         unit_price_usd, unit_price_krw, total_price_usd, total_price_krw,
                         expected_date, received_status, payment_status, exchange_rate, row_index)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        project_id, pi['po_number'], pi['supplier'], pi['product_name'], pi['quantity'],
                        pi['unit_price_usd'], pi['unit_price_krw'], pi['total_price_usd'], pi['total_price_krw'],
                        pi['expected_date'], pi['received_status'], pi['payment_status'], pi['exchange_rate'], ri
                    ))

            inserted += 1

    print(f"\n{inserted}개 프로젝트 삽입 완료")
    return inserted

if __name__ == '__main__':
    import sys

    html_path = '/home/ec2-user/sales-app/12345/2026Y 프로젝트.html'

    print("HTML 파일 파싱 중...")
    projects = parse_html_and_extract_data(html_path)

    if '--insert' in sys.argv:
        insert_to_db(projects, dry_run=False)
    else:
        insert_to_db(projects, dry_run=True)
        print("\n실제 삽입하려면: python3 import_projects.py --insert")
