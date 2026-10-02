"""Check companies table schema"""
import sys
sys.path.append('/home/ec2-user/crm-app/backend')
from database import sales_db_cursor

with sales_db_cursor() as cur:
    cur.execute("DESCRIBE companies")
    columns = cur.fetchall()

    print("Companies table schema:")
    print("-" * 80)
    for col in columns:
        print(f"{col['Field']:20} {col['Type']:20} {col['Null']:5} {col['Key']:5} {col['Default']}")

    print("\n" + "=" * 80)
    print("Sample data (first 3 rows):")
    print("-" * 80)
    cur.execute("SELECT * FROM companies LIMIT 3")
    rows = cur.fetchall()
    for row in rows:
        print(row)
