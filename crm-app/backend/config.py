"""HTC Partner CRM — Configuration"""
import os
from pathlib import Path
from dotenv import load_dotenv

# .env 파일 로드 (config.py와 같은 디렉토리)
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = int(os.getenv("DB_PORT", "3306"))
DB_USER     = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME     = os.getenv("DB_NAME", "htc_inventory")

# Sales DB (CRM 전용)
SALES_DB_HOST     = os.getenv("SALES_DB_HOST", "localhost")
SALES_DB_PORT     = int(os.getenv("SALES_DB_PORT", "3306"))
SALES_DB_USER     = os.getenv("SALES_DB_USER", "root")
SALES_DB_PASSWORD = os.getenv("SALES_DB_PASSWORD", "")
SALES_DB_NAME     = os.getenv("SALES_DB_NAME", "htc_sales")

APP_TITLE   = "HTC Partner CRM"
APP_VERSION = "2.0.7"
CORS_ORIGINS = ["*"]

# ── Google Drive API 설정 ─────────────────────────────────────
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI", "https://crm.hltac.com/api/google/callback")
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]

# ── 분류 상수 ─────────────────────────────────────────────────
ITEM_TYPES = ["라디오", "안테나", "악세사리"]

CATEGORIES = {
    "라디오": ["BB", "EB", "OEM", "GCS", "SBST", "SBRT", "LBST", "LBRT",
               "SL4210", "IVAS", "SM", "KCMVP일체형", "MockUp"],
    "안테나":  ["Antennas"],
    "악세사리": ["Adapter Board Cable", "Adapters", "Antenna Cable", "Battery",
                "Brackets", "Cables", "Cameras", "Encoder", "Headset",
                "Juggernaut", "LAN", "Other", "Prism", "PTT", "RS232",
                "SC42/44 OEM Cable", "Adapter Board", "Adapter Board 자재",
                "SL52 OEM 자재", "Mast"],
}

GRADES   = ["새제품", "데모"]
STATUSES = ["재고", "대여중", "납품예정", "납품", "분실", "수리중"]
