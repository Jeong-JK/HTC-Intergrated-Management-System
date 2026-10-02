"""Check all CRM tables schema"""
import sys
sys.path.append('/home/ec2-user/crm-app/backend')
from database import sales_db_cursor

tables = ['companies', 'teams', 'contacts', 'meetings']

with sales_db_cursor() as cur:
    for table in tables:
        print(f"\n{'='*80}")
        print(f"TABLE: {table}")
        print('='*80)

        cur.execute(f"DESCRIBE {table}")
        columns = cur.fetchall()

        for col in columns:
            print(f"{col['Field']:20} {col['Type']:25} {col['Null']:5} {col['Key']:5} {str(col['Default'])[:20]}")

        print(f"\nSample data (first 2 rows):")
        print('-'*80)
        cur.execute(f"SELECT * FROM {table} LIMIT 2")
        rows = cur.fetchall()
        for row in rows:
            print(row)
