"""HTC Sales Pipeline — Configuration"""
import os
import logging
from datetime import datetime
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

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = int(os.getenv("DB_PORT", "3306"))
DB_USER     = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME     = os.getenv("DB_NAME", "htc_pipeline")

APP_TITLE   = "HTC Sales Pipeline"
APP_VERSION = "1.0.0"

# 현재 연도 (동적)
CURRENT_YEAR = int(os.getenv("CURRENT_YEAR", datetime.now().year))

# CORS 설정 - 환경변수로 추가 origin 지정 가능
_cors_env = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = [
    "http://localhost:3001",
    "http://localhost:8001",
    "http://ims.hltac.com",
    "https://ims.hltac.com",
] + ([o.strip() for o in _cors_env.split(",") if o.strip()] if _cors_env else [])

# 인증 서비스 URL (inventory-app)
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8000")

# TODO: 영업 파이프라인 상수 추가 예정
# PIPELINE_STAGES = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]
# OPPORTUNITY_TYPES = ["New Business", "Existing Customer", "Renewal"]
