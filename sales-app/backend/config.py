"""HTC Sales Pipeline — Configuration"""
import os
import logging
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# .env 파일 로드 (config.py와 같은 디렉토리)
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

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

# Google Sheets 설정 (년도별 스프레드시트)
SPREADSHEET_IDS = {
    2026: os.getenv("SPREADSHEET_2026", "1QIogC0pcxcIQJGbXLH_Ta4EG6herT05RhCG4rwQnm6c"),
    2027: os.getenv("SPREADSHEET_2027", ""),  # 2027년 시트 ID (나중에 추가)
}

# 현재 연도 스프레드시트 ID (해가 바뀌면 .env 에 SPREADSHEET_2027 처럼 넣고 Sales 서버 재시작)
CURRENT_SPREADSHEET_ID = SPREADSHEET_IDS.get(CURRENT_YEAR) or os.getenv(f"SPREADSHEET_{CURRENT_YEAR}", "")
# 올해 프로젝트 번호 형식 (2026 → '26-01')
PROJECT_NO_PATTERN = rf"({CURRENT_YEAR % 100:02d}-\d+)"

# Credentials 파일 경로
GOOGLE_CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", str(Path(__file__).parent / "credentials.json"))

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
