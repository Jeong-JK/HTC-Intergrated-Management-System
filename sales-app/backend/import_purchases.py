"""2026Y 매입 HTML 파일을 파싱하여 DB에 삽입"""
from bs4 import BeautifulSoup
import re
from database import db_cursor

def parse_price(price_str):
    """가격 문자열 파싱 (예: '$179.20', '₩370,972')"""
    if not price_str or price_str.strip() == '':
        return 0, 'USD'

    price_str = price_str.strip()

    if '₩' in price_str:
        currency = 'KRW'
        num_str = price_str.replace('₩', '').replace(',', '').strip()
    else:
        currency = 'USD'
        num_str = price_str.replace('$', '').replace(',', '').strip()

    try:
        return float(num_str), currency
    except:
        return 0, currency

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

def parse_exchange_rate(rate_str):
    """환율 문자열 파싱"""
    if not rate_str or rate_str.strip() == '' or rate_str.strip() == '-':
        return None
    rate_str = rate_str.replace(',', '').strip()
    try:
        return float(rate_str)
    except:
        return None

def extract_received_status(cell_text):
    """입고여부 추출"""
    if '입고완료' in cell_text:
        return '입고완료'
    elif '부분입고' in cell_text:
        return '부분입고'
    return '미입고'

def is_request_number(text):
    """품의번호 패턴인지 확인 (예: 2026/01/06-2)"""
    if not text:
        return False
    # 날짜 패턴: 20XX/MM/DD 또는 비슷한 형식
    return bool(re.match(r'20\d{2}[/\-]', text))

def parse_html_and_extract_data(html_path):
    """HTML 파일 파싱하여 데이터 추출"""
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    table = soup.find('table', class_='waffle')
    if not table:
        print("테이블을 찾을 수 없습니다")
        return []

    rows = table.find_all('tr')
    data = []
    current_request_number = None

    for row in rows:
        cells = row.find_all(['td', 'th'])
        cell_count = len(cells)

        if cell_count < 14:
            continue

        texts = [c.get_text(strip=True) for c in cells]

        # PO 번호 확인 (항상 인덱스 2)
        po_number = texts[2] if len(texts) > 2 else ''
        if not po_number.startswith('HPP'):
            continue

        # 셀 개수로 구조 판별
        # 30셀 이상: 품의번호 컬럼 존재 ([6] 위치)
        # 30셀 미만: 품의번호 컬럼 없음 (rowspan으로 병합됨)

        if cell_count >= 30:
            # 품의번호 컬럼이 존재하는 행 (34셀)
            # [6]=품의번호, [7]=Supplier, [8]=freezebar(빈칸), [9]=Project, [10]=Product, [11]=Qty
            cell6_text = texts[6] if len(texts) > 6 else ''

            if is_request_number(cell6_text) or cell6_text == '' or cell6_text.startswith('송금'):
                # [6]은 품의번호(또는 빈값/메모), [7]=Supplier, [9]=Project (freezebar 건너뜀)
                request_number = cell6_text if is_request_number(cell6_text) else None
                supplier = texts[7] if len(texts) > 7 else ''
                project = texts[9] if len(texts) > 9 else ''  # [8]은 freezebar 빈칸
                product_name = texts[10] if len(texts) > 10 else ''
                quantity_str = texts[11] if len(texts) > 11 else '1'
                net_price_str = texts[12] if len(texts) > 12 else ''
                amount_str = texts[13] if len(texts) > 13 else ''
                expected_date_str = texts[14] if len(texts) > 14 else ''
                received_status_raw = texts[15] if len(texts) > 15 else ''

                # 송금 정보
                payment_date1_str = texts[18] if len(texts) > 18 else ''
                payment_amount1_str = texts[19] if len(texts) > 19 else ''
                exchange_rate1_str = texts[20] if len(texts) > 20 else ''
                payment_date2_str = texts[21] if len(texts) > 21 else ''
                payment_amount2_str = texts[22] if len(texts) > 22 else ''
                exchange_rate2_str = texts[23] if len(texts) > 23 else ''

                # 새 PO 그룹의 시작이므로 current_request_number 업데이트
                current_request_number = request_number
            else:
                # [6]이 Supplier (품의번호 컬럼이 완전히 없는 특수 케이스)
                request_number = current_request_number
                supplier = texts[6] if len(texts) > 6 else ''
                project = texts[8] if len(texts) > 8 else ''  # [7]은 freezebar 빈칸
                product_name = texts[9] if len(texts) > 9 else ''
                quantity_str = texts[10] if len(texts) > 10 else '1'
                net_price_str = texts[11] if len(texts) > 11 else ''
                amount_str = texts[12] if len(texts) > 12 else ''
                expected_date_str = texts[13] if len(texts) > 13 else ''
                received_status_raw = texts[14] if len(texts) > 14 else ''

                payment_date1_str = ''
                payment_amount1_str = ''
                exchange_rate1_str = ''
                payment_date2_str = ''
                payment_amount2_str = ''
                exchange_rate2_str = ''
        else:
            # 품의번호 컬럼이 없는 행 (rowspan으로 병합됨, 27셀)
            # [6]=Supplier, [7]=freezebar(빈칸), [8]=Project, [9]=Product, [10]=Qty
            quote = texts[3] if len(texts) > 3 else ''
            oc = texts[4] if len(texts) > 4 else ''
            invoice = texts[5] if len(texts) > 5 else ''
            request_number = current_request_number
            supplier = texts[6] if len(texts) > 6 else ''
            project = texts[8] if len(texts) > 8 else ''  # [7]은 freezebar 빈칸
            product_name = texts[9] if len(texts) > 9 else ''
            quantity_str = texts[10] if len(texts) > 10 else '1'
            net_price_str = texts[11] if len(texts) > 11 else ''
            amount_str = texts[12] if len(texts) > 12 else ''
            expected_date_str = texts[13] if len(texts) > 13 else ''
            received_status_raw = texts[14] if len(texts) > 14 else ''

            payment_date1_str = ''
            payment_amount1_str = ''
            exchange_rate1_str = ''
            payment_date2_str = ''
            payment_amount2_str = ''
            exchange_rate2_str = ''

        # Quote, OC, Invoice는 항상 같은 위치
        quote = texts[3] if len(texts) > 3 else ''
        oc = texts[4] if len(texts) > 4 else ''
        invoice = texts[5] if len(texts) > 5 else ''

        # 데이터 파싱
        try:
            quantity = int(quantity_str) if quantity_str.isdigit() else 1
        except:
            quantity = 1

        net_price, currency = parse_price(net_price_str)
        amount, amount_currency = parse_price(amount_str)
        if amount > 0:
            currency = amount_currency  # amount의 통화를 우선
        expected_date = parse_date(expected_date_str)
        received_status = extract_received_status(received_status_raw)

        payment_amount1, _ = parse_price(payment_amount1_str)
        payment_amount2, _ = parse_price(payment_amount2_str)
        exchange_rate1 = parse_exchange_rate(exchange_rate1_str)
        exchange_rate2 = parse_exchange_rate(exchange_rate2_str)
        payment_date1 = parse_date(payment_date1_str)
        payment_date2 = parse_date(payment_date2_str)

        row_data = {
            'year': 2026,
            'po_number': po_number,
            'quote': quote if quote else None,
            'oc': oc if oc else None,
            'invoice': invoice if invoice else None,
            'request_number': request_number if request_number else None,
            'supplier': supplier,
            'project': project if project else None,
            'product_name': product_name,
            'quantity': quantity,
            'net_price': net_price,
            'currency': currency,
            'amount': amount,
            'expected_date': expected_date,
            'received_status': received_status,
            'payment_date1': payment_date1,
            'payment_amount1': payment_amount1,
            'exchange_rate1': exchange_rate1,
            'payment_date2': payment_date2,
            'payment_amount2': payment_amount2,
            'exchange_rate2': exchange_rate2,
        }

        data.append(row_data)

    return data

def preview_data(data, limit=20):
    """데이터 미리보기"""
    print(f"\n총 {len(data)}개 행 발견")
    print("=" * 100)

    for i, row in enumerate(data[:limit]):
        print(f"\n[{i+1}] PO: {row['po_number']} | 품의: {row['request_number']}")
        print(f"    Supplier: {row['supplier']} | Project: {row['project']}")
        print(f"    Product: {row['product_name']}")
        print(f"    Qty: {row['quantity']}, {row['currency']} {row['net_price']:,.2f}, Amount: {row['amount']:,.2f}")
        print(f"    Expected: {row['expected_date']}, Status: {row['received_status']}")

    if len(data) > limit:
        print(f"\n... 외 {len(data) - limit}개 더")

def insert_to_db(data, dry_run=True):
    """DB에 데이터 삽입"""
    if dry_run:
        print("\n[DRY RUN] 실제 삽입하지 않음")
        preview_data(data)
        return 0

    inserted = 0
    with db_cursor() as cur:
        for row in data:
            cur.execute("""
                INSERT INTO purchases
                (year, po_number, quote, oc, invoice, request_number, supplier, project,
                 product_name, quantity, net_price, currency, amount, expected_date, received_status,
                 payment_date1, payment_amount1, exchange_rate1,
                 payment_date2, payment_amount2, exchange_rate2)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                row['year'], row['po_number'], row['quote'], row['oc'], row['invoice'],
                row['request_number'], row['supplier'], row['project'], row['product_name'],
                row['quantity'], row['net_price'], row['currency'], row['amount'], row['expected_date'],
                row['received_status'], row['payment_date1'], row['payment_amount1'],
                row['exchange_rate1'], row['payment_date2'], row['payment_amount2'],
                row['exchange_rate2']
            ))
            inserted += 1

    print(f"\n{inserted}개 행 삽입 완료")
    return inserted

if __name__ == '__main__':
    import sys

    html_path = '/home/ec2-user/inventory-app/backend/uploads/admin_drive/2026Y 매입.html'

    print("HTML 파일 파싱 중...")
    data = parse_html_and_extract_data(html_path)

    if '--insert' in sys.argv:
        insert_to_db(data, dry_run=False)
    else:
        insert_to_db(data, dry_run=True)
        print("\n실제 삽입하려면: python3 import_purchases.py --insert")
