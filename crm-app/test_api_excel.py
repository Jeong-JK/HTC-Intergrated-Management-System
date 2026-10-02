import sys
sys.path.insert(0, '/home/ec2-user/crm-app/backend')

from io import BytesIO
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from database import sales_db_cursor

CONTACT_CATEGORIES = [
    '거래업체&벤더',
    '컨택업체',
    '기관&협회',
    '공급업체',
    '기타업체',
    '분류필요'
]

sql = """
    SELECT
        c.category,
        comp.name as company_name,
        t.name as team_name,
        c.name as contact_name,
        c.position,
        c.phone,
        c.email,
        c.note
    FROM contacts c
    LEFT JOIN teams t ON c.team_id = t.id
    LEFT JOIN companies comp ON t.company_id = comp.id
    ORDER BY c.category, comp.name, t.name, c.name
"""

with sales_db_cursor() as cur:
    cur.execute(sql)
    contacts = cur.fetchall()

# 카테고리별로 데이터 분류
category_data = {cat: [] for cat in CONTACT_CATEGORIES}

for contact in contacts:
    cat = contact['category'] or '분류필요'
    if cat not in category_data:
        cat = '분류필요'
    category_data[cat].append(contact)

# 엑셀 워크북 생성
wb = Workbook()
wb.remove(wb.active)

# 스타일 정의 - 검정 배경에 빨간 굵은 글씨
header_font = Font(bold=True, color="FF0000")
header_fill = PatternFill(start_color="000000", end_color="000000", fill_type="solid")
header_alignment = Alignment(horizontal="center", vertical="center")
thin_border = Border(
    left=Side(style='thin'), right=Side(style='thin'),
    top=Side(style='thin'), bottom=Side(style='thin')
)

headers = ['업체명', '부서', '직급', '담당자', '전화번호', '이메일', '비고']

for category in CONTACT_CATEGORIES:
    ws = wb.create_sheet(title=category[:31])

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border

    # 데이터 행 스타일 (글씨 크기 10, 가운데 정렬)
    data_font = Font(size=10)
    data_alignment = Alignment(horizontal="center", vertical="center")

    for row_idx, contact in enumerate(category_data[category], 2):
        cell = ws.cell(row=row_idx, column=1, value=contact['company_name'] or '')
        cell.border = thin_border
        cell.font = data_font
        cell.alignment = data_alignment
        cell = ws.cell(row=row_idx, column=2, value=contact['team_name'] or '')
        cell.border = thin_border
        cell.font = data_font
        cell.alignment = data_alignment
        cell = ws.cell(row=row_idx, column=3, value=contact['position'] or '')
        cell.border = thin_border
        cell.font = data_font
        cell.alignment = data_alignment
        cell = ws.cell(row=row_idx, column=4, value=contact['contact_name'] or '')
        cell.border = thin_border
        cell.font = data_font
        cell.alignment = data_alignment
        cell = ws.cell(row=row_idx, column=5, value=contact['phone'] or '')
        cell.border = thin_border
        cell.font = data_font
        cell.alignment = data_alignment
        cell = ws.cell(row=row_idx, column=6, value=contact['email'] or '')
        cell.border = thin_border
        cell.font = data_font
        cell.alignment = data_alignment
        cell = ws.cell(row=row_idx, column=7, value=contact['note'] or '')
        cell.border = thin_border
        cell.font = data_font
        cell.alignment = data_alignment

    # 컬럼 너비 설정
    ws.column_dimensions['A'].width = 19.10   # 업체명
    ws.column_dimensions['B'].width = 37.80   # 부서
    ws.column_dimensions['C'].width = 32.80   # 직급
    ws.column_dimensions['D'].width = 19.30   # 담당자
    ws.column_dimensions['E'].width = 14.40   # 전화번호
    ws.column_dimensions['F'].width = 38.90   # 이메일
    ws.column_dimensions['G'].width = 50.00   # 비고

    # 1행 고정
    ws.freeze_panes = 'A2'

    # 1행에 필터 추가
    if len(category_data[category]) > 0:
        ws.auto_filter.ref = f"A1:G{len(category_data[category]) + 1}"
    else:
        ws.auto_filter.ref = "A1:G1"

output = BytesIO()
wb.save(output)
output.seek(0)

# 파일로 저장
with open("/tmp/api_test.xlsx", "wb") as f:
    f.write(output.read())

print("File saved to /tmp/api_test.xlsx")

# 다시 열어서 필터 확인
wb2 = load_workbook("/tmp/api_test.xlsx")
for sheet_name in wb2.sheetnames:
    ws = wb2[sheet_name]
    print(f"Sheet: {sheet_name}, Filter: {ws.auto_filter.ref}")
