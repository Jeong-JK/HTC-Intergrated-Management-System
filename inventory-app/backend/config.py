"""HTC Inventory — Configuration"""
import os
import logging
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def get_logger(name: str) -> logging.Logger:
    """모듈별 로거 반환"""
    return logging.getLogger(name)

# DB 설정 (환경변수 우선)
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = int(os.getenv("DB_PORT", "3306"))
DB_USER     = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME     = os.getenv("DB_NAME", "htc_inventory")

# htc_sales DB 설정 (CRM 업체 정보용)
SALES_DB_HOST     = os.getenv("SALES_DB_HOST", "localhost")
SALES_DB_PORT     = int(os.getenv("SALES_DB_PORT", "3306"))
SALES_DB_USER     = os.getenv("SALES_DB_USER", "root")
SALES_DB_PASSWORD = os.getenv("SALES_DB_PASSWORD", "")
SALES_DB_NAME     = os.getenv("SALES_DB_NAME", "htc_sales")

# htc_pipeline DB 설정 (영업 파이프라인용)
PIPELINE_DB_HOST     = os.getenv("PIPELINE_DB_HOST", "localhost")
PIPELINE_DB_USER     = os.getenv("PIPELINE_DB_USER", "root")
PIPELINE_DB_PASSWORD = os.getenv("PIPELINE_DB_PASSWORD", "")
PIPELINE_DB_NAME     = os.getenv("PIPELINE_DB_NAME", "htc_pipeline")

APP_TITLE   = "HTC Inventory"
APP_VERSION = "2.0.0"

# CORS 설정 - 환경변수로 추가 origin 지정 가능
_cors_env = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://ims.hltac.com",
    "https://ims.hltac.com",
] + ([o.strip() for o in _cors_env.split(",") if o.strip()] if _cors_env else [])

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
