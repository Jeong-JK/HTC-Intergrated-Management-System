"""마스터 비밀번호 설정/해제 (관리자 계정 외 모든 계정 로그인용)
사용: cd ~/inventory-app/backend && python3 set_master_password.py   → 입력 후 sudo systemctl restart htc-inventory
아무것도 입력하지 않으면 마스터 비밀번호 해제"""
import getpass
from pathlib import Path
from routers.auth import hash_password

env = Path(__file__).parent / ".env"
pw = getpass.getpass("새 마스터 비밀번호 (비우면 해제): ")
if pw and pw != getpass.getpass("한 번 더: "):
    raise SystemExit("두 번 입력한 비밀번호가 다릅니다")
if pw and len(pw) < 12:
    raise SystemExit("12자 이상으로 정하세요")

lines = [l for l in env.read_text(encoding="utf-8").splitlines() if not l.startswith("MASTER_PASSWORD_HASH=")]
if pw:
    lines.append("MASTER_PASSWORD_HASH='" + hash_password(pw) + "'")  # 작은따옴표: $ 해석 방지
env.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("설정됨" if pw else "해제됨", "→ sudo systemctl restart htc-inventory 실행하세요")
