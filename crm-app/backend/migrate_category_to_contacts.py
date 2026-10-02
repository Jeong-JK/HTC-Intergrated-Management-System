"""Migrate category from teams to contacts table"""
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

print("Step 1: Removing category from teams table...")
print("-" * 80)

with sales_db_cursor() as cur:
    # Check if teams has category column
    cur.execute("DESCRIBE teams")
    columns = [col['Field'] for col in cur.fetchall()]

    if 'category' in columns:
        cur.execute("ALTER TABLE teams DROP COLUMN category")
        print("✓ Category column removed from teams table")
    else:
        print("✓ Category column doesn't exist in teams table (already removed)")

print("\nStep 2: Adding category to contacts table...")
print("-" * 80)

with sales_db_cursor() as cur:
    # Check if contacts has category column
    cur.execute("DESCRIBE contacts")
    columns = [col['Field'] for col in cur.fetchall()]

    if 'category' in columns:
        print("✓ Category column already exists in contacts table")
    else:
        # Add category column
        cur.execute("""
            ALTER TABLE contacts
            ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'NEW(분류필요)'
        """)
        print("✓ Category column added successfully to contacts table")

    # Verify the change
    print("\nUpdated contacts table schema:")
    cur.execute("DESCRIBE contacts")
    for col in cur.fetchall():
        print(f"  {col['Field']:25} {col['Type']:25} {col['Null']:5} {col['Default']}")

    # Show sample data
    print("\nSample data (first 5 contacts):")
    cur.execute("""
        SELECT c.id, co.name AS company, t.name AS team, c.name, c.position, c.category
        FROM contacts c
        JOIN teams t ON c.team_id = t.id
        JOIN companies co ON t.company_id = co.id
        LIMIT 5
    """)
    for row in cur.fetchall():
        print(f"  [{row['id']}] {row['company']} / {row['team']} / {row['name']} ({row['position']}) → {row['category']}")

print("\n" + "="*80)
print("Migration completed successfully!")
print(f"Available categories: {', '.join(CATEGORIES)}")
