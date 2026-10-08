from sqlalchemy import create_engine
from urllib.parse import quote_plus
from dotenv import load_dotenv
import os

load_dotenv()

PASSWORD = os.getenv("DB_PASSWORD")

if not PASSWORD:
    raise ValueError("DB_PASSWORD is not set")

DATABASE_URL = f"mysql+pymysql://Kit:{quote_plus(PASSWORD)}@localhost:3306/sex_toys"

engine = create_engine(DATABASE_URL)