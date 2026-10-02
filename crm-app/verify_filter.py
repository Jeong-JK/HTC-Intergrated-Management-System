from openpyxl import load_workbook

wb = load_workbook("/tmp/contacts_test.xlsx")

print("Checking auto_filter in each sheet:")
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    print(f"\nSheet: {sheet_name}")
    print(f"  auto_filter.ref: {ws.auto_filter.ref}")
    print(f"  Has filter: {ws.auto_filter.ref is not None and str(ws.auto_filter.ref) != ''}")
