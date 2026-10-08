from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class ProductResponse(BaseModel):
    id: int = Field(title="Идентификатор")
    name: str = Field(title="Название")
    brand: str | None = Field(default=None, title="Бренд")
    price: Decimal | None = Field(default=None, title="Цена")
    category_id: int | None = Field(default=None, title="Категория")
    purchase_date: date | None = Field(default=None, title="Дата покупки")
    description: str | None = Field(default=None, title="Описание")
    suppliers_id: int | None = Field(default=None, title="Поставщик")

    model_config = {"from_attributes": True}