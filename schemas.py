from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict, EmailStr


class CategoryResponse(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class ProductResponse(BaseModel):
    id: int
    name: str
    brand: str | None = None
    price: Decimal | None = None
    category_id: int | None = None
    category: CategoryResponse | None = None
    purchase_date: date | None = None
    description: str | None = None
    suppliers_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    name: str
    brand: str | None = None
    price: Decimal | None = None
    category_id: int | None = None
    purchase_date: date | None = None
    description: str | None = None
    suppliers_id: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    price: Decimal | None = None
    category_id: int | None = None
    purchase_date: date | None = None
    description: str | None = None
    suppliers_id: int | None = None


class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    name: str
    phone: str | None = None
    email: EmailStr
    is_verified: bool
    created_at: datetime
    is_admin: bool

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    phone: str | None = Field(default=None, max_length=30)


class OrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100)


class OrderCreate(BaseModel):
    address: str = Field(min_length=3, max_length=1000)
    phone: str | None = Field(default=None, max_length=30)
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    price: Decimal

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: int
    user_id: int | None = None
    customer_name: str
    phone: str | None = None
    address: str | None = None
    total_amount: Decimal
    status: str
    created_at: datetime
    items: list[OrderItemResponse]

    model_config = ConfigDict(from_attributes=True)