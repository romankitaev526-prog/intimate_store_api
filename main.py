from fastapi import FastAPI, Depends
from database import SessionLocal
from sqlalchemy.orm import Session
from models import Product

app = FastAPI()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return products