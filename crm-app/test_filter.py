from openpyxl import Workbook

wb = Workbook()
ws = wb.active
ws.title = "Test"

# 헤더 추가
headers = ['업체명', '부서', '직급', '담당자', '전화번호', '이메일', '비고']
for col, header in enumerate(headers, 1):
    ws.cell(row=1, column=col, value=header)

# 테스트 데이터 추가
ws.cell(row=2, column=1, value="회사1")
ws.cell(row=2, column=2, value="부서1")
ws.cell(row=3, column=1, value="회사2")
ws.cell(row=3, column=2, value="부서2")

# 필터 추가
ws.auto_filter.ref = "A1:G3"

wb.save("/tmp/test_filter.xlsx")
print("Test file created: /tmp/test_filter.xlsx")
print(f"Auto filter ref: {ws.auto_filter.ref}")
