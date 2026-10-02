"""HTC Inventory — Alerts Router (실시간 조회)"""
from fastapi import APIRouter
from database import db_cursor

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def get_alerts(include_undecided: bool = False):
    """반납 알림 목록 조회 (지연 + 오늘 + 5일 이내, 선택적으로 미정 포함)"""
    if include_undecided:
        sql = """
            SELECT
                r.id as rental_id,
                r.borrower,
                r.contact_name,
                r.contact_phone,
                r.rent_date,
                r.expected_return,
                r.quantity,
                COALESCE(i.item_name, r.item_name) as item_name,
                COALESCE(i.description, r.description) as description,
                CASE
                    WHEN r.expected_return IS NULL THEN NULL
                    ELSE DATEDIFF(CURDATE(), r.expected_return)
                END as days_overdue,
                CASE WHEN r.expected_return IS NULL THEN 1 ELSE 0 END as is_undecided
            FROM rental_history r
            LEFT JOIN items i ON r.item_id = i.id
            WHERE r.returned_at IS NULL
              AND (
                  r.expected_return IS NULL
                  OR r.expected_return <= DATE_ADD(CURDATE(), INTERVAL 5 DAY)
              )
            ORDER BY
                CASE WHEN r.expected_return IS NULL THEN 1 ELSE 0 END,
                r.expected_return ASC
        """
    else:
        sql = """
            SELECT
                r.id as rental_id,
                r.borrower,
                r.contact_name,
                r.contact_phone,
                r.rent_date,
                r.expected_return,
                r.quantity,
                COALESCE(i.item_name, r.item_name) as item_name,
                COALESCE(i.description, r.description) as description,
                DATEDIFF(CURDATE(), r.expected_return) as days_overdue,
                0 as is_undecided
            FROM rental_history r
            LEFT JOIN items i ON r.item_id = i.id
            WHERE r.returned_at IS NULL
              AND r.expected_return IS NOT NULL
              AND r.expected_return <= DATE_ADD(CURDATE(), INTERVAL 5 DAY)
            ORDER BY r.expected_return ASC
        """
    with db_cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


@router.get("/status")
def get_alert_status():
    """반납 알림 상태 (지연/오늘/임박) - 그룹별 카운트"""
    with db_cursor() as cur:
        # 반납 지연 (반납예정일이 오늘 이전) - 그룹별
        cur.execute("""
            SELECT COUNT(DISTINCT CONCAT(rent_date, '|', borrower, '|', IFNULL(contact_name, ''))) as cnt
            FROM rental_history
            WHERE returned_at IS NULL
              AND expected_return IS NOT NULL
              AND expected_return < CURDATE()
        """)
        overdue = cur.fetchone()['cnt']

        # 오늘 반납예정 - 그룹별
        cur.execute("""
            SELECT COUNT(DISTINCT CONCAT(rent_date, '|', borrower, '|', IFNULL(contact_name, ''))) as cnt
            FROM rental_history
            WHERE returned_at IS NULL
              AND expected_return = CURDATE()
        """)
        today = cur.fetchone()['cnt']

        # 내일 반납예정 (1일 전 알림) - 그룹별
        cur.execute("""
            SELECT COUNT(DISTINCT CONCAT(rent_date, '|', borrower, '|', IFNULL(contact_name, ''))) as cnt
            FROM rental_history
            WHERE returned_at IS NULL
              AND expected_return = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        """)
        day_1 = cur.fetchone()['cnt']

        # 3일 후 반납예정 (3일 전 알림) - 그룹별
        cur.execute("""
            SELECT COUNT(DISTINCT CONCAT(rent_date, '|', borrower, '|', IFNULL(contact_name, ''))) as cnt
            FROM rental_history
            WHERE returned_at IS NULL
              AND expected_return = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
        """)
        day_3 = cur.fetchone()['cnt']

        # 5일 이내 반납예정 (2, 4, 5일 후, 1일과 3일 제외) - 그룹별
        cur.execute("""
            SELECT COUNT(DISTINCT CONCAT(rent_date, '|', borrower, '|', IFNULL(contact_name, ''))) as cnt
            FROM rental_history
            WHERE returned_at IS NULL
              AND expected_return IN (
                  DATE_ADD(CURDATE(), INTERVAL 2 DAY),
                  DATE_ADD(CURDATE(), INTERVAL 4 DAY),
                  DATE_ADD(CURDATE(), INTERVAL 5 DAY)
              )
        """)
        upcoming = cur.fetchone()['cnt']

        return {
            "overdue": overdue,
            "today": today,
            "day_1": day_1,
            "day_3": day_3,
            "upcoming": upcoming
        }
