"""활동 로그 상세: 저장 직전/직후 행을 읽어 '무엇을 무엇으로' 한 줄 요약.
재고·Sales·CRM 이 같이 씀 (Sales/CRM 은 activity_client.py 가 이 파일을 경로로 불러옴). DB 접속은 각 앱이 cursor 를 넘김"""
import re
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal

VALUE_MAX = 60    # 목록에서 간략히 보이게 값은 60자까지
DETAIL_MAX = 500
CREATE_LIMIT = 5  # 한 번에 여러 줄 추가될 때 이름은 5개까지

ITEM_FIELDS = {"rack_no": "랙", "box_no": "박스", "item_type": "종류", "category": "분류", "item_name": "품명",
               "description": "설명", "serial": "시리얼", "ip": "IP", "mac": "MAC", "status": "상태", "quantity": "수량",
               "license_key": "라이선스", "purchase_date": "구매일", "unit_price": "단가", "exchange_rate": "환율", "note": "비고"}

# path: PUT/DELETE(및 id 붙은 POST) 대상, create: 새로 추가하는 POST 주소. name: 행 값으로 만든 이름, name_sql: 다른 표에서 찾는 이름
SPECS = {
    "inventory": [
        {"path": r"^/api/items/(\d+)$", "create": "/api/items", "table": "items", "name": "{item_name} {serial}", "fields": ITEM_FIELDS},
        {"path": r"^/api/rack/item/(\d+)$", "table": "items", "name": "{item_name} {serial}", "fields": ITEM_FIELDS},
        {"path": r"^/api/rentals/(\d+)(?:/return|/extend|/toggle-check)?$", "create": "/api/rentals", "table": "rental_history",
         "name": "{item_name} → {borrower}",
         "fields": {"borrower": "대여처", "contact_name": "담당자", "contact_phone": "연락처", "purpose": "목적", "quantity": "수량",
                    "rent_date": "대여일", "expected_return": "반납 예정일", "returned_at": "반납일", "note": "비고", "needs_check": "확인 필요"}},
        {"path": r"^/api/deliveries/(\d+)(?:/confirm)?$", "create": "/api/deliveries", "table": "delivery_history",
         "name": "{item_name} → {client}",
         "fields": {"client": "납품처", "project_name": "프로젝트", "contact_name": "담당자", "contact_phone": "연락처", "quantity": "수량",
                    "unit_price": "단가", "delivery_date": "납품일", "status": "상태", "note": "비고"}},
        {"path": r"^/api/inbound/(\d+)$", "table": "inbound", "name": "{item_name} {serial}",
         "fields": {"item_name": "품명", "status": "상태", "serial": "시리얼", "quantity": "수량", "supplier": "공급처",
                    "inbound_date": "입고일", "unit_price": "단가", "exchange_rate": "환율", "note": "비고"}},
        {"path": r"^/api/auth/users/(\d+)$", "create": "/api/auth/users", "table": "users", "name": "{name}",
         "fields": {"name": "이름", "position": "직급", "email": "이메일", "phone": "전화번호", "is_admin": "관리자"}},
        {"path": r"^/api/posts/(\d+)$", "create": "/api/posts", "table": "posts", "name": "{title}",
         "fields": {"title": "제목", "content": "내용", "is_notice": "공지"}},
    ],
    "sales": [
        {"path": r"^/api/projects/(\d+)$", "create": "/api/projects", "table": "projects", "name": "#{project_no} {project_name}",
         "fields": {"year": "연도", "project_no": "번호", "customer": "고객사", "project_name": "프로젝트명", "supplier": "공급사",
                    "order_date": "수주일", "delivery_date": "납품일", "order_amount": "수주금액", "payment_date": "입금일",
                    "payment_amount": "입금액", "payment_status": "입금 상태", "status": "상태", "notes": "비고"}},
        {"path": r"^/api/weekly/(\d+)$", "create": "/api/weekly", "table": "weekly_schedule", "name": "#{project_no} {customer_project}",
         "fields": {"customer_project": "고객/프로젝트", "product_name": "품목", "quantity": "수량", "supplier": "공급사",
                    "notes": "비고", "week_data": "주간 일정", "bar_note": "막대 메모", "first_week_note": "첫 주 메모"}},
        {"path": r"^/api/posts/(\d+)$", "create": "/api/posts", "table": "posts", "name": "{title}",
         "fields": {"title": "제목", "content": "내용"}},
    ],
    "crm": [
        {"path": r"^/api/crm/companies/(\d+)$", "create": "/api/crm/companies", "table": "companies", "name": "{name}",
         "fields": {"name": "업체명"}},
        {"path": r"^/api/teams/(\d+)$", "create": "/api/teams", "table": "teams",
         "name_sql": "SELECT CONCAT(name, ' ', %(name)s) AS n FROM companies WHERE id = %(company_id)s", "fields": {"name": "팀명"}},
        {"path": r"^/api/contacts/(\d+)(?:/resign|/restore|/transfer-history)?$", "create": "/api/contacts", "table": "contacts",
         "name_sql": """SELECT CONCAT(c.name, IFNULL(CONCAT(' (', co.name, ')'), '')) AS n FROM contacts c
                        LEFT JOIN teams t ON c.team_id = t.id LEFT JOIN companies co ON t.company_id = co.id WHERE c.id = %(id)s""",
         "fields": {"name": "이름", "position": "직급", "phone": "전화번호", "email": "이메일", "category": "분류",
                    "note": "메모", "status": "상태"}},
        {"path": r"^/api/meetings/(\d+)$", "create": "/api/meetings", "table": "meetings",
         "name_sql": """SELECT CONCAT(c.name, IFNULL(CONCAT(' (', co.name, ')'), ''), ' · ', %(meeting_date)s) AS n FROM contacts c
                        LEFT JOIN teams t ON c.team_id = t.id LEFT JOIN companies co ON t.company_id = co.id WHERE c.id = %(contact_id)s""",
         "fields": {"meeting_date": "미팅일", "attendees": "참석자", "content": "내용"}},
        {"path": r"^/api/quotations/(\d+)(?:/status|/to-po)?$", "create": "/api/quotations", "table": "quotations",
         "name": "{quotation_no} {company_name}",
         "fields": {"quotation_date": "견적일", "valid_until": "유효기간", "company_name": "업체", "contact_name": "담당자",
                    "total": "합계", "status": "상태", "note": "비고"}},
        {"path": r"^/api/purchase-orders/(\d+)(?:/status)?$", "create": "/api/purchase-orders", "table": "purchase_orders",
         "name": "{po_no} {company_name}",
         "fields": {"order_date": "발주일", "delivery_due": "납기", "company_name": "업체", "contact_name": "담당자",
                    "total": "합계", "status": "상태", "delivery_address": "납품지", "note": "비고"}},
    ],
}


def short(v, limit=VALUE_MAX):
    if v is None or v == "":
        return "(빈칸)"
    if isinstance(v, bool):
        return "예" if v else "아니오"
    if isinstance(v, Decimal):
        return f"{v:,.0f}" if v == v.to_integral_value() else f"{v:,}"
    if isinstance(v, int) and abs(v) >= 10000:
        return f"{v:,}"
    if isinstance(v, (date, datetime)):
        return str(v)[:16]
    s = " ".join(str(v).split())  # 줄바꿈 정리
    return s if len(s) <= limit else s[:limit] + "…"


def display_name(cur, spec, row):
    if spec.get("name_sql"):
        cur.execute(spec["name_sql"], row)
        found = cur.fetchone()
        if found and found["n"]:
            return found["n"]
    clean = defaultdict(str, {k: ("" if v is None else v) for k, v in row.items()})
    return " ".join(spec.get("name", "#{id}").format_map(clean).split()) or f"#{row['id']}"


def _find(app, method, path):
    for spec in SPECS.get(app, []):
        m = re.match(spec["path"], path)
        if m:
            return spec, int(m.group(1))
        if method == "POST" and path == spec.get("create"):
            return spec, None
    return None, None


def before(cursor_factory, app, method, path):
    """요청 처리 전: 대상 행(수정/삭제) 또는 마지막 id(추가)를 기억"""
    spec, rid = _find(app, method, path)
    if not spec:
        return None
    with cursor_factory() as cur:
        if rid is None:
            cur.execute(f"SELECT COALESCE(MAX(id), 0) AS m FROM {spec['table']}")
            return {"spec": spec, "max": cur.fetchone()["m"]}
        cur.execute(f"SELECT * FROM {spec['table']} WHERE id = %s", (rid,))
        row = cur.fetchone()
        return row and {"spec": spec, "id": rid, "row": row, "name": display_name(cur, spec, row)}


def spec_for(app, table):
    """기록된 표 이름 → 설명서 (목록에 있는 표만 조회 허용)"""
    return next((s for s in SPECS.get(app, []) if s["table"] == table), None)


def after(cursor_factory, snap):
    """요청이 성공한 뒤: (한 줄 요약, 표, 행 id). 요약은 추가/삭제는 이름, 수정은 '이름 · 칸: 전 → 후'"""
    if not snap:
        return None, None, None
    text, ref_id = _after(cursor_factory, snap)
    return text, snap["spec"]["table"], ref_id


def _after(cursor_factory, snap):
    spec = snap["spec"]
    with cursor_factory() as cur:
        if "max" in snap:
            cur.execute(f"SELECT * FROM {spec['table']} WHERE id > %s ORDER BY id LIMIT %s", (snap["max"], CREATE_LIMIT + 1))
            rows = cur.fetchall()
            names = [display_name(cur, spec, r) for r in rows[:CREATE_LIMIT]]
            text = ", ".join(names) + (" 외" if len(rows) > CREATE_LIMIT else "")
            return text[:DETAIL_MAX] or None, rows[0]["id"] if rows else None
        cur.execute(f"SELECT * FROM {spec['table']} WHERE id = %s", (snap["id"],))
        new = cur.fetchone()
    if new is None:
        return snap["name"][:DETAIL_MAX], snap["id"]
    old = snap["row"]
    changes = [f"{label}: {short(old[col])} → {short(new[col])}"
               for col, label in spec["fields"].items() if col in old and old[col] != new[col]]
    if spec["table"] == "users":  # 비밀번호·권한은 값 없이 바뀐 사실만
        if old.get("password_hash") != new.get("password_hash"):
            changes.append("비밀번호 변경")
        if any(old[c] != new[c] for c in old if c.startswith("can_")):
            changes.append("권한 변경")
    text = snap["name"] + (" · " + ", ".join(changes) if changes else "")
    return text[:DETAIL_MAX], snap["id"]
