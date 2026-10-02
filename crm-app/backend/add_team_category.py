"""Add category column to teams table"""
import sys
sys.path.append('/home/ec2-user/crm-app/backend')
from database import sales_db_cursor

CATEGORIES = [
    '거래업체&벤더',
    '컨택업체',
    '기관&협회',
    '공급업체',
    '기타업체',
    'NEW(분류필요)'
]

print("Adding category column to teams table...")
print(f"Available categories: {', '.join(CATEGORIES)}")
print("Default value: 'NEW(분류필요)'")
print("-" * 80)

with sales_db_cursor() as cur:
    # Check if column already exists
    cur.execute("DESCRIBE teams")
    columns = [col['Field'] for col in cur.fetchall()]

    if 'category' in columns:
        print("✓ Category column already exists in teams table")
    else:
        # Add category column
        cur.execute("""
            ALTER TABLE teams
            ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'NEW(분류필요)'
        """)
        print("✓ Category column added successfully to teams table")

    # Verify the change
    print("\nUpdated teams table schema:")
    cur.execute("DESCRIBE teams")
    for col in cur.fetchall():
        print(f"  {col['Field']:20} {col['Type']:25} {col['Null']:5} {col['Default']}")

    # Show sample data
    print("\nSample data (first 5 teams):")
    cur.execute("SELECT t.id, c.name AS company, t.name AS team, t.category FROM teams t JOIN companies c ON t.company_id = c.id LIMIT 5")
    for row in cur.fetchall():
        print(f"  [{row['id']}] {row['company']} / {row['team']} → {row['category']}")

print("\n" + "="*80)
print("Migration completed successfully!")
