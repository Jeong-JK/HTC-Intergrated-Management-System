"""HTC CRM — Dashboard Router"""
from fastapi import APIRouter, HTTPException, Request
from database import sales_db_cursor
from datetime import datetime, timedelta

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stale-companies")
def get_stale_companies_dashboard(request: Request):
    """30일/60일/90일 초과 담당자 대시보드 (원본 PyQt6와 동일)"""
    # 미팅 조회 권한 확인 - 이 API는 미팅 데이터 기반이므로 권한 필수
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if not user.get('is_admin') and not user.get('can_view_meeting'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")

    now = datetime.now()
    days_30_ago = now - timedelta(days=30)
    days_60_ago = now - timedelta(days=60)
    days_90_ago = now - timedelta(days=90)

    # 담당자 단위로 체크 (미팅 날짜 + 연락 날짜 모두 고려)
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
            ) as days_since_meeting
        FROM companies co
        JOIN teams t ON t.company_id = co.id
        JOIN contacts c ON c.team_id = t.id
        LEFT JOIN meetings m ON m.contact_id = c.id
        GROUP BY co.id, co.name, t.id, t.name, c.id, c.name, c.last_contact_date, c.last_contact_updated_at
        HAVING (MAX(m.meeting_date) IS NOT NULL OR c.last_contact_date IS NOT NULL)
            AND days_since_meeting > 30
        ORDER BY days_since_meeting DESC
    """

    with sales_db_cursor() as cur:
        cur.execute(sql)
        contacts = cur.fetchall()

        # 분류
        result = {
            "over_90_days": [],  # 빨간색
            "over_60_days": [],  # 주황색
            "over_30_days": [],  # 노란색
            "no_meetings": []    # 미팅 없음
        }

        for contact in contacts:
            last_meeting = contact.get('last_meeting_date')
            days_since = contact.get('days_since_meeting') or 0

            if last_meeting is None:
                contact['status'] = 'no_meeting'
                contact['status_text'] = '미팅 없음'
                result["no_meetings"].append(contact)
            elif days_since >= 90:
                contact['status'] = 'critical'
                contact['status_text'] = '90일 초과'
                result["over_90_days"].append(contact)
            elif days_since >= 60:
                contact['status'] = 'warning'
                contact['status_text'] = '60일 초과'
                result["over_60_days"].append(contact)
            elif days_since > 30:
                contact['status'] = 'caution'
                contact['status_text'] = '30일 초과'
                result["over_30_days"].append(contact)

        # 통계
        stats = {
            "total_stale": len(contacts),
            "over_90": len(result["over_90_days"]),
            "over_60": len(result["over_60_days"]),
            "over_30": len(result["over_30_days"]),
            "no_meetings": len(result["no_meetings"])
        }

        return {
            "stats": stats,
            "contacts": result  # companies -> contacts로 변경
        }


@router.get("/summary")
def get_dashboard_summary(request: Request):
    """대시보드 요약 통계"""
    # 미팅 조회 권한 확인
    user = getattr(request.state, 'user', None)
    can_view_meetings = user and (user.get('is_admin') or user.get('can_view_meeting'))

    now = datetime.now()
    days_30_ago = now - timedelta(days=30)
    days_7_ago = now - timedelta(days=7)

    with sales_db_cursor() as cur:
        # 전체 통계
        if can_view_meetings:
            cur.execute("""
                SELECT
                    COUNT(DISTINCT c.id) as total_companies,
                    COUNT(DISTINCT t.id) as total_teams,
                    COUNT(DISTINCT ct.id) as total_contacts,
                    COUNT(DISTINCT m.id) as total_meetings
                FROM companies c
                LEFT JOIN teams t ON c.id = t.company_id
                LEFT JOIN contacts ct ON t.id = ct.team_id
                LEFT JOIN meetings m ON ct.id = m.contact_id
            """)
            overall = cur.fetchone()

            # 최근 7일 미팅 수
            cur.execute("""
                SELECT COUNT(*) as recent_meetings
                FROM meetings
                WHERE meeting_date >= %s
            """, (days_7_ago,))
            recent = cur.fetchone()

            # 30일 초과 회사 수
            cur.execute("""
                SELECT COUNT(DISTINCT c.id) as stale_companies
                FROM companies c
                LEFT JOIN teams t ON c.id = t.company_id
                LEFT JOIN contacts ct ON t.id = ct.team_id
                LEFT JOIN meetings m ON ct.id = m.contact_id
                GROUP BY c.id
                HAVING MAX(m.meeting_date) IS NULL OR MAX(m.meeting_date) < %s
            """, (days_30_ago,))
            stale = cur.fetchone()

            return {
                "total_companies": overall['total_companies'],
                "total_teams": overall['total_teams'],
                "total_contacts": overall['total_contacts'],
                "total_meetings": overall['total_meetings'],
                "recent_meetings_7days": recent['recent_meetings'],
                "stale_companies": stale['stale_companies'] if stale else 0
            }
        else:
            # 미팅 조회 권한 없으면 미팅 관련 통계는 0
            cur.execute("""
                SELECT
                    COUNT(DISTINCT c.id) as total_companies,
                    COUNT(DISTINCT t.id) as total_teams,
                    COUNT(DISTINCT ct.id) as total_contacts
                FROM companies c
                LEFT JOIN teams t ON c.id = t.company_id
                LEFT JOIN contacts ct ON t.id = ct.team_id
            """)
            overall = cur.fetchone()

            return {
                "total_companies": overall['total_companies'],
                "total_teams": overall['total_teams'],
                "total_contacts": overall['total_contacts'],
                "total_meetings": 0,
                "recent_meetings_7days": 0,
                "stale_companies": 0
            }


@router.get("/all-contacts-with-dates")
def get_all_contacts_with_dates(request: Request, show_all: bool = False, min_days: int = 30):
    """팝업용 - 전체 또는 필터링된 담당자 목록 (미팅 + 연락 날짜)"""
    # 미팅 조회 권한 확인 - 이 API는 미팅 데이터 기반이므로 권한 필수
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    if not user.get('is_admin') and not user.get('can_view_meeting'):
        raise HTTPException(status_code=403, detail="권한이 없습니다. 관리자에게 문의하세요.")

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
    """

    # 미팅이나 연락이 한 번이라도 있는 담당자만 표시
    sql += " HAVING (MAX(m.meeting_date) IS NOT NULL OR c.last_contact_date IS NOT NULL)"

    if not show_all:
        sql += f" AND days_since_last_contact >= {min_days}"

    sql += " ORDER BY days_since_last_contact DESC"

    with sales_db_cursor() as cur:
        cur.execute(sql)
        contacts = cur.fetchall()

        # 상태 분류
        for contact in contacts:
            days = contact.get('days_since_last_contact') or 0
            if days >= 90:
                contact['status'] = 'critical'
                contact['status_text'] = '90일 초과'
            elif days >= 60:
                contact['status'] = 'warning'
                contact['status_text'] = '60일 초과'
            elif days >= 30:
                contact['status'] = 'caution'
                contact['status_text'] = '30일 초과'
            else:
                contact['status'] = 'normal'
                contact['status_text'] = '정상'

        return {
            "total_count": len(contacts),
            "contacts": contacts
        }


@router.post("/bulk-renew-contacts")
def bulk_renew_contact_dates(request: Request, body: dict):
    """선택된 담당자들의 연락 날짜 일괄 갱신"""

    contact_ids = body.get('contact_ids', [])
    new_contact_date = body.get('new_contact_date')

    if not contact_ids:
        raise HTTPException(400, "contact_ids required")
    if not new_contact_date:
        raise HTTPException(400, "new_contact_date required")

    with sales_db_cursor() as cur:
        placeholders = ','.join(['%s'] * len(contact_ids))

        # 일괄 업데이트
        update_sql = f"""
            UPDATE contacts
            SET
                last_contact_date = %s,
                last_contact_updated_at = NOW()
            WHERE id IN ({placeholders})
        """
        params = [new_contact_date] + contact_ids
        cur.execute(update_sql, params)
        updated_count = cur.rowcount

        # 갱신된 담당자 조회
        fetch_sql = f"""
            SELECT
                c.id as contact_id,
                c.name as contact_name,
                c.last_contact_date,
                c.last_contact_updated_at,
                t.name as team_name,
                co.name as company_name
            FROM contacts c
            JOIN teams t ON c.team_id = t.id
            JOIN companies co ON t.company_id = co.id
            WHERE c.id IN ({placeholders})
        """
        cur.execute(fetch_sql, contact_ids)
        updated_contacts = cur.fetchall()

        return {
            "updated_count": updated_count,
            "updated_contacts": updated_contacts
        }
