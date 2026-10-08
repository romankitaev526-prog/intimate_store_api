from sqlalchemy import Column, Integer, String, Numeric, Date, Text
from database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    brand = Column(String(50))
    price = Column(Numeric(10, 2))
    category_id = Column(Integer)
    purchase_date = Column(Date)
    description = Column(Text)
    suppliers_id = Column(Integer)