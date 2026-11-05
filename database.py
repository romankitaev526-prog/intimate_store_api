
import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

PASSWORD = os.getenv("DB_PASSWORD")

if not PASSWORD:
    raise ValueError("DB_PASSWORD is not set")

DATABASE_URL = (
    f"mysql+pymysql://Kit:{quote_plus(PASSWORD)}"
    "@localhost:3306/sex_toys"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)

Base = declarative_base()
