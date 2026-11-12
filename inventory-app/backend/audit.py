"""활동 로그 상세: 저장 직전/직후 행을 읽어 '무엇을 무엇으로' 한 줄 요약.
재고·Sales·CRM 이 같이 씀 (Sales/CRM 은 activity_client.py 가 이 파일을 경로로 불러옴). DB 접속은 각 앱이 cursor 를 넘김"""
import json
import re
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal

VALUE_MAX = 60    # 목록에서 간략히 보이게 값은 60자까지
DETAIL_MAX = 500
CREATE_LIMIT = 5  # 한 번에 여러 줄 추가될 때 이름은 5개까지
UNDO_MAX_ROWS = 5000        # 되돌리기용으로 저장할 최대 줄 수 (넘으면 기록만, 되돌리기 없음)
UNDO_MAX_BYTES = 2_000_000

ITEM_FIELDS = {"rack_no": "랙", "box_no": "박스", "item_type": "종류", "category": "분류", "item_name": "품명",
               "description": "설명", "serial": "시리얼", "ip": "IP", "mac": "MAC", "status": "상태", "quantity": "수량",
               "license_key": "라이선스", "purchase_date": "구매일", "unit_price": "단가", "exchange_rate": "환율", "note": "비고"}

# path: PUT/DELETE(및 id 붙은 POST) 대상, create: 새로 추가하는 POST 주소. name: 행 값으로 만든 이름, name_sql: 다른 표에서 찾는 이름
# 되돌리기 — undo: 허용 동작(c 추가, u 수정, d 삭제. 처리 버튼(/return 등)은 다른 표까지 바꿔서 제외),
#   children: 수정 때 통째로 갈아끼우는 딸린 줄 (표, 연결 칸), related: 같이 바뀌는 다른 표 (표, 그 표의 칸, 이 행의 칸)
SPECS = {
    "inventory": [
        {"path": r"^/api/items/(\d+)$", "create": "/api/items", "table": "items", "name": "{item_name} {serial}", "fields": ITEM_FIELDS,
         "undo": "ud", "related": [("inbound", "item_id", "id")]},
        {"path": r"^/api/rack/item/(\d+)$", "table": "items", "name": "{item_name} {serial}", "fields": ITEM_FIELDS, "undo": "u"},
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
                    "inbound_date": "입고일", "unit_price": "단가", "exchange_rate": "환율", "note": "비고"},
         "undo": "ud", "related": [("items", "id", "item_id")]},
        {"path": r"^/api/auth/users/(\d+)$", "create": "/api/auth/users", "table": "users", "name": "{name}",
         "fields": {"name": "이름", "position": "직급", "email": "이메일", "phone": "전화번호", "is_admin": "관리자"}, "undo": "cud"},
        {"path": r"^/api/posts/(\d+)$", "create": "/api/posts", "table": "posts", "name": "{title}",
         "fields": {"title": "제목", "content": "내용", "is_notice": "공지"}, "undo": "cud"},
    ],
    "sales": [
        {"path": r"^/api/projects/(\d+)$", "create": "/api/projects", "table": "projects", "name": "#{project_no} {project_name}",
         "fields": {"year": "연도", "project_no": "번호", "customer": "고객사", "project_name": "프로젝트명", "supplier": "공급사",
                    "order_date": "수주일", "delivery_date": "납품일", "order_amount": "수주금액", "payment_date": "입금일",
                    "payment_amount": "입금액", "payment_status": "입금 상태", "status": "상태", "notes": "비고"},
         "undo": "cud", "children": [("project_payments", "project_id"), ("sales_items", "project_id"), ("purchase_items", "project_id")],
         "unique": [("year", "project_no")]},  # 되살릴 때 같은 번호 프로젝트가 이미 있으면 막음 (동기화로 다시 생긴 경우)
        {"path": r"^/api/weekly/(\d+)$", "create": "/api/weekly", "table": "weekly_schedule", "name": "#{project_no} {customer_project}",
         "fields": {"customer_project": "고객/프로젝트", "product_name": "품목", "quantity": "수량", "supplier": "공급사",
                    "notes": "비고", "week_data": "주간 일정", "bar_note": "막대 메모", "first_week_note": "첫 주 메모"}, "undo": "cud"},
        {"path": r"^/api/posts/(\d+)$", "create": "/api/posts", "table": "posts", "name": "{title}",
         "fields": {"title": "제목", "content": "내용"}, "undo": "cud"},
    ],
    "crm": [
        {"path": r"^/api/crm/companies/(\d+)$", "create": "/api/crm/companies", "table": "companies", "name": "{name}",
         "fields": {"name": "업체명"}, "undo": "cud"},
        {"path": r"^/api/teams/(\d+)$", "create": "/api/teams", "table": "teams",
         "name_sql": "SELECT CONCAT(name, ' ', %(name)s) AS n FROM companies WHERE id = %(company_id)s", "fields": {"name": "팀명"}, "undo": "cud"},
        {"path": r"^/api/contacts/(\d+)(?:/resign|/restore|/transfer-history)?$", "create": "/api/contacts", "table": "contacts",
         "name_sql": """SELECT CONCAT(c.name, IFNULL(CONCAT(' (', co.name, ')'), '')) AS n FROM contacts c
                        LEFT JOIN teams t ON c.team_id = t.id LEFT JOIN companies co ON t.company_id = co.id WHERE c.id = %(id)s""",
         "fields": {"name": "이름", "position": "직급", "phone": "전화번호", "email": "이메일", "category": "분류",
                    "note": "메모", "status": "상태"}, "undo": "cud"},
        {"path": r"^/api/meetings/(\d+)$", "create": "/api/meetings", "table": "meetings",
         "name_sql": """SELECT CONCAT(c.name, IFNULL(CONCAT(' (', co.name, ')'), ''), ' · ', %(meeting_date)s) AS n FROM contacts c
                        LEFT JOIN teams t ON c.team_id = t.id LEFT JOIN companies co ON t.company_id = co.id WHERE c.id = %(contact_id)s""",
         "fields": {"meeting_date": "미팅일", "attendees": "참석자", "content": "내용"}, "undo": "cud"},
        {"path": r"^/api/quotations/(\d+)(?:/status|/to-po)?$", "create": "/api/quotations", "table": "quotations",
         "name": "{quotation_no} {company_name}",
         "fields": {"quotation_date": "견적일", "valid_until": "유효기간", "company_name": "업체", "contact_name": "담당자",
                    "total": "합계", "status": "상태", "note": "비고"},
         "undo": "cud", "children": [("quotation_items", "quotation_id")]},
        {"path": r"^/api/purchase-orders/(\d+)(?:/status)?$", "create": "/api/purchase-orders", "table": "purchase_orders",
         "name": "{po_no} {company_name}",
         "fields": {"order_date": "발주일", "delivery_due": "납기", "company_name": "업체", "contact_name": "담당자",
                    "total": "합계", "status": "상태", "delivery_address": "납품지", "note": "비고"},
         "undo": "cud", "children": [("purchase_order_items", "po_id")]},
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


def _undo_op(spec, method, path, rid):
    """되돌리기 가능한 요청이면 c/u/d (id 로 끝나는 기본 주소만 — /return 같은 처리 버튼은 제외)"""
    op = "c" if rid is None else {"PUT": "u", "PATCH": "u", "DELETE": "d"}.get(method)
    if op and op in spec.get("undo", "") and (rid is None or path.endswith(f"/{rid}")):
        return op
    return None


def before(cursor_factory, app, method, path):
    """요청 처리 전: 대상 행(수정/삭제) 또는 마지막 id(추가)를 기억 + 되돌리기용 원본"""
    spec, rid = _find(app, method, path)
    if not spec:
        return None
    op = _undo_op(spec, method, path, rid)
    with cursor_factory() as cur:
        if rid is None:
            cur.execute(f"SELECT COALESCE(MAX(id), 0) AS m FROM {spec['table']}")
            return {"spec": spec, "max": cur.fetchone()["m"], "op": op}
        cur.execute(f"SELECT * FROM {spec['table']} WHERE id = %s", (rid,))
        row = cur.fetchone()
        if not row:
            return None
        snap = {"spec": spec, "id": rid, "row": row, "name": display_name(cur, spec, row), "op": op}
        if op == "u":
            snap["undo_before"] = _j(_state(cur, spec, [rid]))
        elif op == "d":
            snap["undo_tree"] = _j(_delete_tree(cur, spec, [rid]))
        return snap


def spec_for(app, table):
    """기록된 표 이름 → 설명서 (목록에 있는 표만 조회 허용)"""
    return next((s for s in SPECS.get(app, []) if s["table"] == table), None)


def after(cursor_factory, snap):
    """요청이 성공한 뒤: (한 줄 요약, 표, 행 id, 되돌리기 정보 JSON). 요약은 추가/삭제는 이름, 수정은 '이름 · 칸: 전 → 후'"""
    if not snap:
        return None, None, None, None
    text, ref_id = _after(cursor_factory, snap)
    undo_data = None
    if snap.get("op") and ref_id:
        try:
            with cursor_factory() as cur:
                undo_data = _undo_data(cur, snap)
        except Exception:  # 되돌리기 정보는 못 남겨도 기록은 남김
            undo_data = None
    return text, snap["spec"]["table"], ref_id, undo_data


def _undo_data(cur, snap):
    spec, op = snap["spec"], snap["op"]
    if op == "u":
        data = {"op": "update", "table": spec["table"], "id": snap["id"], "before": snap["undo_before"],
                "after": _j(_state(cur, spec, [snap["id"]]))}
    elif op == "d":
        data = {"op": "delete", "table": spec["table"], "ids": [snap["id"]], **snap["undo_tree"]}
    else:
        cur.execute(f"SELECT id FROM {spec['table']} WHERE id > %s ORDER BY id LIMIT %s", (snap["max"], UNDO_MAX_ROWS))
        ids = [r["id"] for r in cur.fetchall()]
        data = {"op": "create", "table": spec["table"], "ids": ids, "after": _j(_state(cur, spec, ids))}
    text = json.dumps(data, ensure_ascii=False)
    rows = sum(len(g["rows"]) for g in data.get("groups", []))
    return text if len(text) <= UNDO_MAX_BYTES and rows <= UNDO_MAX_ROWS else None


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


# ── 되돌리기 ──────────────────────────────────────────────────────────────
# 저장 형태(JSON): update {before, after: 상태}, delete {ids, groups: [{table, rows}], setnull}, create {ids, after: 상태}
# 상태 = {main: 행들, children: {표: 줄들}, related: {표: 행들}}. 값은 JSON 으로 한 번 거쳐 (날짜/금액은 문자열) 비교가 일정함


class UndoError(Exception):
    """되돌릴 수 없음 (이미 삭제됨 등)"""


class UndoConflict(Exception):
    """그 뒤에 같은 칸이 다시 바뀜 — force 로만 진행"""


def _j(x):
    return json.loads(json.dumps(x, default=str, ensure_ascii=False))


def _ph(n):
    return ",".join(["%s"] * n)


def _rows(cur, table, col, values):
    values = [v for v in values if v is not None]
    if not values:
        return []
    cur.execute(f"SELECT * FROM `{table}` WHERE `{col}` IN ({_ph(len(values))}) ORDER BY id", values)
    return cur.fetchall()


def _state(cur, spec, ids):
    """비교/복원용: 행 + 수정 때 갈아끼우는 딸린 줄 + 같이 바뀌는 다른 표"""
    main = _rows(cur, spec["table"], "id", ids)
    return {"main": main,
            "children": {t: _rows(cur, t, col, ids) for t, col in spec.get("children", [])},
            "related": {t: _rows(cur, t, col, [r.get(key) for r in main]) for t, col, key in spec.get("related", [])}}


def _fks(cur):
    """이 DB의 외래키: 부모 표 → [(자식 표, 칸, 부모 칸, 삭제 규칙)]"""
    cur.execute("""SELECT k.TABLE_NAME AS child, k.COLUMN_NAME AS col, k.REFERENCED_TABLE_NAME AS parent,
                          k.REFERENCED_COLUMN_NAME AS pcol, r.DELETE_RULE AS rule
                   FROM information_schema.KEY_COLUMN_USAGE k
                   JOIN information_schema.REFERENTIAL_CONSTRAINTS r
                     ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
                   WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL""")
    by_parent = defaultdict(list)
    for r in cur.fetchall():
        by_parent[r["parent"]].append(r)
    return by_parent


def _delete_tree(cur, spec, ids):
    """지우면 같이 사라지는 것(외래키 CASCADE)과 연결이 끊기는 것(SET NULL)까지 — 되살릴 때 씀"""
    fks = _fks(cur)
    groups, setnull, seen = [], [], set()

    def walk(table, rows):
        rows = [r for r in rows if (table, r["id"]) not in seen]
        if not rows:
            return
        seen.update((table, r["id"]) for r in rows)
        groups.append({"table": table, "rows": rows})
        for fk in fks.get(table, []):
            kids = _rows(cur, fk["child"], fk["col"], [r[fk["pcol"]] for r in rows])
            if fk["rule"] == "CASCADE":
                walk(fk["child"], kids)
            elif fk["rule"] == "SET NULL" and kids:
                setnull.append({"table": fk["child"], "col": fk["col"], "pairs": [[k["id"], k[fk["col"]]] for k in kids]})

    walk(spec["table"], _rows(cur, spec["table"], "id", ids))
    for t, col in spec.get("children", []):  # 외래키 없이 연결된 딸린 줄
        walk(t, _rows(cur, t, col, ids))
    return {"groups": groups, "setnull": setnull}


def _insert(cur, table, rows, ignore=False):
    for r in rows:
        cols = list(r)
        cur.execute(f"INSERT {'IGNORE ' if ignore else ''}INTO `{table}` ({', '.join(f'`{c}`' for c in cols)}) "
                    f"VALUES ({_ph(len(cols))})", [r[c] for c in cols])


def _set(cur, table, row, cols):
    if cols:
        cur.execute(f"UPDATE `{table}` SET {', '.join(f'`{c}` = %s' for c in cols)} WHERE id = %s",
                    [row[c] for c in cols] + [row["id"]])


def _changed(a, b):
    return [c for c in a if c != "id" and a.get(c) != b.get(c)]


def _restore_tree(cur, data):
    cur.execute("SET FOREIGN_KEY_CHECKS = 0")  # 부모/자식 넣는 순서와 상관없이 원래 번호 그대로
    try:
        for i, g in enumerate(data["groups"]):
            _insert(cur, g["table"], g["rows"], ignore=i > 0)  # 딸린 줄은 남아 있을 수 있음 (외래키 없는 표)
        for sn in data.get("setnull", []):
            for kid_id, value in sn["pairs"]:
                cur.execute(f"UPDATE `{sn['table']}` SET `{sn['col']}` = %s WHERE id = %s AND `{sn['col']}` IS NULL", (value, kid_id))
    finally:
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")


def undo(cursor_factory, app, data, force=False):
    """되돌리기 실행 (한 트랜잭션). (다시 되돌릴 정보, 구글 시트 반영용 정보 또는 None) 반환"""
    spec = spec_for(app, data["table"])
    if not spec or not spec.get("undo"):
        raise UndoError("되돌릴 수 없는 항목입니다")
    table = spec["table"]
    with cursor_factory() as cur:
        if data["op"] == "update":
            rid, b, a = data["id"], data["before"], data["after"]
            now = _j(_state(cur, spec, [rid]))
            if not now["main"] or not b["main"] or not a["main"]:
                raise UndoError("그 뒤에 삭제된 항목이라 되돌릴 수 없습니다")
            cols = _changed(b["main"][0], a["main"][0])
            kids = [(t, col) for t, col in spec.get("children", []) if b["children"].get(t) != a["children"].get(t)]
            moved = any(now["main"][0].get(c) != a["main"][0].get(c) for c in cols) or \
                any(now["children"].get(t) != a["children"].get(t) for t, _ in kids)
            if moved and not force:
                raise UndoConflict("그 뒤에 다시 수정된 항목입니다")
            _set(cur, table, b["main"][0], cols)  # 이번 수정이 바꾼 칸만 원래 값으로
            for t, col in kids:
                cur.execute(f"DELETE FROM `{t}` WHERE `{col}` = %s", (rid,))
                _insert(cur, t, b["children"][t])
            for t, rows in b["related"].items():
                after_rows = {r["id"]: r for r in a["related"].get(t, [])}
                for r in rows:
                    if r["id"] in after_rows:
                        _set(cur, t, r, _changed(r, after_rows[r["id"]]))
            post = _j(_state(cur, spec, [rid]))
            sheet = {"id": rid, "updated": {c: b["main"][0][c] for c in cols if c in spec["fields"]},
                     "current": now["main"][0]} if table == "projects" and cols else None
            return {"op": "update", "table": table, "id": rid, "before": now, "after": post}, sheet

        if data["op"] == "delete":
            if _rows(cur, table, "id", data["ids"]):
                raise UndoError("같은 번호의 항목이 이미 있어 되살릴 수 없습니다")
            for cols in spec.get("unique", []):
                for r in data["groups"][0]["rows"]:
                    cur.execute(f"SELECT 1 FROM `{table}` WHERE " + " AND ".join(f"`{c}` = %s" for c in cols) + " LIMIT 1",
                                [r[c] for c in cols])
                    if cur.fetchone():
                        raise UndoError(f"같은 {'/'.join(str(r[c]) for c in cols)} 항목이 이미 있어 되살릴 수 없습니다")
            _restore_tree(cur, data)
            return {"op": "create", "table": table, "ids": data["ids"], "after": _j(_state(cur, spec, data["ids"]))}, None

        if data["op"] == "create":
            now = _j(_state(cur, spec, data["ids"]))
            if not now["main"]:
                raise UndoError("이미 삭제된 항목입니다")
            fields = list(spec["fields"])

            def pick(rows):  # 의미 있는 칸만 비교 (수정 시각 등 제외)
                return [{c: r.get(c) for c in fields} for r in rows]

            if pick(now["main"]) != pick(data["after"]["main"]) and not force:
                raise UndoConflict("추가된 뒤에 수정된 항목입니다")
            ids = [r["id"] for r in now["main"]]
            tree = _j(_delete_tree(cur, spec, ids))
            cur.execute(f"DELETE FROM `{table}` WHERE id IN ({_ph(len(ids))})", ids)
            for t, col in spec.get("children", []):
                cur.execute(f"DELETE FROM `{t}` WHERE `{col}` IN ({_ph(len(ids))})", ids)
            return {"op": "delete", "table": table, "ids": ids, **tree}, None
    raise UndoError("알 수 없는 되돌리기 정보입니다")
