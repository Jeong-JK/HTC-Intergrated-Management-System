import sys
sys.path.append('/home/ec2-user/crm-app/backend')

from database import sales_db_cursor

sql = """
    SELECT
        co.id as company_id,
        co.name as company_name,
        t.id as team_id,
        t.name as team_name,
        c.id as contact_id,
        c.name as contact_name,
        MAX(m.meeting_date) as last_meeting_date,
        c.last_contact_date,
        c.last_contact_updated_at,
        GREATEST(
            COALESCE(MAX(m.meeting_date), '1970-01-01'),
            COALESCE(c.last_contact_date, '1970-01-01')
        ) as effective_last_contact,
        DATEDIFF(
            NOW(),
            GREATEST(
                COALESCE(MAX(m.meeting_date), '1970-01-01'),
                COALESCE(c.last_contact_date, '1970-01-01')
            )
        ) as days_since_last_contact
    FROM companies co
    JOIN teams t ON t.company_id = co.id
    JOIN contacts c ON c.team_id = t.id
    LEFT JOIN meetings m ON m.contact_id = c.id
    GROUP BY co.id, co.name, t.id, t.name, c.id, c.name, c.last_contact_date, c.last_contact_updated_at
    HAVING days_since_last_contact >= 30
    ORDER BY days_since_last_contact DESC
"""

with sales_db_cursor() as cur:
    cur.execute(sql)
    contacts = cur.fetchall()

    print(f"총 {len(contacts)}명")

    if contacts:
        print("\n처음 3개:")
        for i, contact in enumerate(contacts[:3]):
            print(f"{i+1}. {contact['company_name']} / {contact['contact_name']} - {contact['days_since_last_contact']}일")
    else:
        print("결과 없음")
