from sqlalchemy import Column, Integer, String, Numeric, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    brand = Column(String(50))
    price = Column(Numeric(10, 2))
    category_id = Column(Integer, ForeignKey("categories.id"))
    category = relationship("Category")
    purchase_date = Column(Date)
    description = Column(Text)
    suppliers_id = Column(Integer)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)