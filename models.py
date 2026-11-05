from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Date,
    Text,
    ForeignKey,
    DateTime,
    Boolean,
    func,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    #  Добавляем админа
    is_admin = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    # Для уже существующих аккаунтов миграция сохранит доступ.
    # Новые аккаунты явно создаются с is_verified=False.
    is_verified = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
    )
    verification_token_hash = Column(String(64), nullable=True)
    verification_expires_at = Column(DateTime, nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    orders = relationship("Order", back_populates="user")


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


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    customer_name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=False)

    total_amount = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(String(30), nullable=False, default="new")
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    user = relationship("User", back_populates="orders")

    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False,
    )
    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
    )

    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")