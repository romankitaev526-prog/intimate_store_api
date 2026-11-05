import hashlib
import json
import logging
import os
import secrets
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pwdlib import PasswordHash
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload
from starlette.middleware.sessions import SessionMiddleware

from database import SessionLocal
from models import Product, Category, Order, OrderItem, User
from schemas import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    OrderCreate,
    OrderResponse,
    UserRegister,
    UserLogin,
    UserResponse,
    UserProfileUpdate,
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Intimate Store API")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

SESSION_SECRET = os.getenv("SESSION_SECRET")
if not SESSION_SECRET or len(SESSION_SECRET) < 32:
    raise RuntimeError(
        "Укажи SESSION_SECRET длиной не менее 32 символов в .env"
    )

BASE_URL = os.getenv(
    "BASE_URL", "http://127.0.0.1:8000"
).rstrip("/")

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="intimate_store_session",
    same_site="lax",
    https_only=False,
    max_age=60 * 60 * 24 * 7,
)

if STATIC_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(directory=str(STATIC_DIR)),
        name="static",
    )

password_hasher = PasswordHash.recommended()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def send_verification_email(email: str, token: str) -> None:
    """Отправляет письмо подтверждения через Resend HTTPS API."""
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    from_email = os.getenv(
        "RESEND_FROM_EMAIL", "onboarding@resend.dev"
    ).strip()

    if not api_key:
        raise RuntimeError("Не задан RESEND_API_KEY в .env")

    verification_url = (
        f"{BASE_URL}/auth/verify-email?token={token}"
    )

    payload = {
        "from": from_email,
        "to": ["romankitaev526@gmail.com"],
        "subject": "Подтверждение email — Intimate Store",
        "text": (
            "Здравствуйте!\n\n"
            "Для подтверждения email перейдите по ссылке:\n"
            f"{verification_url}\n\n"
            "Ссылка действительна 30 минут.\n"
            "Если вы не регистрировались, просто проигнорируйте это письмо."
        ),
    }

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "intimate-store-api/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            result = response.read().decode("utf-8")
            logger.info("Resend принял письмо: %s", result)

    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error("Resend HTTP %s: %s", exc.code, body)
        raise RuntimeError(
            f"Resend отклонил отправку письма (HTTP {exc.code})"
        ) from exc

    except urllib.error.URLError as exc:
        logger.error("Ошибка соединения с Resend: %s", exc.reason)
        raise RuntimeError(
            "Не удалось подключиться к Resend"
        ) from exc


def migrate_database() -> None:
    """Только добавочные изменения: существующие данные не удаляются."""
    inspector = inspect(SessionLocal.kw["bind"])
    tables = inspector.get_table_names()

    if "users" not in tables:
        return

    user_columns = {
        column["name"] for column in inspector.get_columns("users")
    }

    with SessionLocal() as db:
        if "is_verified" not in user_columns:
            # Старые аккаунты остаются доступными.
            db.execute(
                text(
                    "ALTER TABLE users ADD COLUMN "
                    "is_verified BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )

        if "verification_token_hash" not in user_columns:
            db.execute(
                text(
                    "ALTER TABLE users ADD COLUMN "
                    "verification_token_hash VARCHAR(64) NULL"
                )
            )

        if "verification_expires_at" not in user_columns:
            db.execute(
                text(
                    "ALTER TABLE users ADD COLUMN "
                    "verification_expires_at DATETIME NULL"
                )
            )

        # Телефон становится необязательным. Старые номера сохраняются.
        db.execute(
            text(
                "ALTER TABLE users MODIFY COLUMN phone VARCHAR(30) NULL"
            )
        )

        if "orders" in tables:
            db.execute(
                text(
                    "ALTER TABLE orders MODIFY COLUMN phone VARCHAR(30) NULL"
                )
            )

        db.commit()


@app.on_event("startup")
def startup():
    try:
        migrate_database()
        logger.info("Проверка структуры базы данных завершена.")
    except Exception:
        logger.exception("Не удалось обновить структуру базы данных.")
        raise


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    user_id = request.session.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Сначала войди в аккаунт.",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        request.session.clear()
        raise HTTPException(
            status_code=401,
            detail="Пользователь не найден. Войди снова.",
        )

    if not user.is_verified:
        request.session.clear()
        raise HTTPException(
            status_code=403,
            detail="Сначала подтверди email.",
        )

    return user


def get_admin(user: User = Depends(get_current_user)) -> User:
    if not getattr(user, "is_admin", False):
        raise HTTPException(
            status_code=403,
            detail="Для этого действия нужны права администратора.",
        )
    return user


@app.get("/")
def home():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Файл static/index.html не найден.",
        )
    return FileResponse(index_file)


# -------------------- АВТОРИЗАЦИЯ --------------------


@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    email = str(data.email).strip().lower()

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=409,
            detail=(
                "Аккаунт с таким email уже существует. "
                "Если ты ещё не подтвердил почту, запроси письмо повторно."
            ),
        )

    token = secrets.token_urlsafe(32)
    user = User(
        name=data.name.strip(),
        phone=(data.phone or "").strip() or None,
        email=email,
        password_hash=password_hasher.hash(data.password),
        is_verified=False,
        verification_token_hash=hash_token(token),
        verification_expires_at=datetime.utcnow() + timedelta(minutes=30),
    )

    try:
        db.add(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Этот email уже зарегистрирован.",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Ошибка регистрации")
        raise HTTPException(
            status_code=500,
            detail="Не удалось создать аккаунт.",
        )

    try:
        send_verification_email(email, token)
    except Exception:
        logger.exception("Не удалось отправить письмо подтверждения")
        raise HTTPException(
            status_code=503,
            detail=(
                "Аккаунт создан, но письмо не удалось отправить. "
                "Проверь настройки Resend и повтори запрос отправки письма."
            ),
        )

    return {
        "message": "Аккаунт создан. Проверь почту и перейди по ссылке в письме.",
        "email": email,
    }


@app.get("/auth/verify-email", response_class=HTMLResponse)
def verify_email(token: str, request: Request, db: Session = Depends(get_db)):
    token_hash = hash_token(token)
    user = (
        db.query(User)
        .filter(User.verification_token_hash == token_hash)
        .first()
    )

    if user is None:
        return HTMLResponse(
            "<h2>Ссылка недействительна или уже использована.</h2>"
            "<p>Если аккаунт не подтверждён, запроси новое письмо на сайте.</p>",
            status_code=400,
        )

    expires_at = user.verification_expires_at
    if expires_at is None or expires_at < datetime.utcnow():
        user.verification_token_hash = None
        user.verification_expires_at = None
        db.commit()
        return HTMLResponse(
            "<h2>Срок действия ссылки истёк.</h2>"
            "<p>Запроси новое письмо подтверждения на сайте.</p>",
            status_code=400,
        )

    user.is_verified = True
    user.verification_token_hash = None
    user.verification_expires_at = None
    db.commit()

    return HTMLResponse(
        """
        <!doctype html>
        <html lang="ru">
        <head>
            <meta charset="utf-8">
            <title>Email подтверждён</title>
        </head>
        <body style="font-family:Arial,sans-serif;max-width:600px;margin:60px auto;padding:20px">
            <h2>Email подтверждён!</h2>
            <p>Теперь можно войти в аккаунт.</p>
            <a href="/">Вернуться в магазин</a>
        </body>
        </html>
        """
    )


@app.post("/auth/resend-verification")
def resend_verification(data: UserLogin, db: Session = Depends(get_db)):
    email = str(data.email).strip().lower()
    user = db.query(User).filter(User.email == email).first()

    # Не раскрываем посторонним, зарегистрирован ли адрес.
    if user is None or user.is_verified:
        return {
            "message": (
                "Если аккаунт существует и не подтверждён, "
                "письмо будет отправлено."
            )
        }

    if not password_hasher.verify(data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Неверный email или пароль.",
        )

    token = secrets.token_urlsafe(32)
    user.verification_token_hash = hash_token(token)
    user.verification_expires_at = datetime.utcnow() + timedelta(minutes=30)
    db.commit()

    try:
        send_verification_email(user.email, token)
    except Exception:
        logger.exception("Не удалось повторно отправить письмо")
        raise HTTPException(
            status_code=503,
            detail="Не удалось отправить письмо. Попробуй позже.",
        )

    return {"message": "Письмо подтверждения отправлено повторно."}


@app.post("/auth/login", response_model=UserResponse)
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    email = str(data.email).strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if user is None or not password_hasher.verify(
        data.password, user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверный email или пароль.",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail=(
                "Сначала подтверди email по ссылке в письме. "
                "Если письма нет, запроси повторную отправку."
            ),
        )

    request.session.clear()
    request.session["user_id"] = user.id
    return user


@app.post("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Ты вышел из аккаунта."}


@app.get("/auth/me", response_model=UserResponse)
def current_user(user: User = Depends(get_current_user)):
    return user


@app.patch("/auth/profile", response_model=UserResponse)
def update_profile(
    data: UserProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.phone = (data.phone or "").strip() or None
    db.commit()
    db.refresh(user)
    return user


# -------------------- ТОВАРЫ --------------------


@app.get("/products", response_model=list[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).options(joinedload(Product.category)).all()


@app.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.id == product_id)
        .first()
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Товар не найден.")
    return product


@app.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin),
):
    product = Product(**data.model_dump())
    db.add(product)
    try:
        db.commit()
        db.refresh(product)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Ошибка создания товара")
        raise HTTPException(
            status_code=500,
            detail="Не удалось создать товар.",
        )
    return product


@app.patch("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Товар не найден.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    try:
        db.commit()
        db.refresh(product)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Ошибка обновления товара")
        raise HTTPException(
            status_code=500,
            detail="Не удалось обновить товар.",
        )
    return product


@app.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Товар не найден.")

    try:
        db.delete(product)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Ошибка удаления товара")
        raise HTTPException(
            status_code=500,
            detail="Не удалось удалить товар.",
        )

    return {"message": "Товар удалён."}

@app.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name.asc()).all()


# -------------------- ЗАКАЗЫ --------------------


@app.post(
    "/orders",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        products_by_id = {}

        for item in data.items:
            product = (
                db.query(Product)
                .filter(Product.id == item.product_id)
                .first()
            )

            if product is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Товар {item.product_id} не найден.",
                )
            if product.price is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"У товара {item.product_id} не указана цена.",
                )

            products_by_id[item.product_id] = product

        total = Decimal("0.00")
        order = Order(
            user_id=user.id,
            customer_name=user.name,
            # Телефон для заказа не меняет телефон профиля.
            phone=(data.phone or "").strip() or None,
            address=data.address.strip(),
            total_amount=Decimal("0.00"),
            status="new",
        )
        db.add(order)
        db.flush()

        for item in data.items:
            product = products_by_id[item.product_id]
            price = Decimal(str(product.price))
            total += price * item.quantity

            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=item.quantity,
                    price=price,
                )
            )

        order.total_amount = total

        # Совместимость со старыми колонками orders, если они существуют.
        if hasattr(order, "product_id"):
            order.product_id = data.items[0].product_id
        if hasattr(order, "quantity"):
            order.quantity = sum(item.quantity for item in data.items)
        if hasattr(order, "total_price"):
            order.total_price = total

        db.commit()

        saved_order = (
            db.query(Order)
            .options(joinedload(Order.items))
            .filter(Order.id == order.id)
            .first()
        )
        if saved_order is None:
            raise HTTPException(
                status_code=500,
                detail="Не удалось загрузить созданный заказ.",
            )

        return saved_order

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Ошибка базы данных при оформлении заказа")
        raise HTTPException(
            status_code=500,
            detail=(
                "Ошибка базы данных при оформлении заказа. "
                "Подробности в терминале сервера."
            ),
        )


@app.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.id == order_id, Order.user_id == user.id)
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Заказ не найден.")
    return order


@app.get("/my/orders", response_model=list[OrderResponse])
def get_my_orders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.user_id == user.id)
        .order_by(Order.id.desc())
        .all()
    )


# -------------------- АДМИНИСТРИРОВАНИЕ ЗАКАЗОВ --------------------

ALLOWED_ORDER_STATUSES = {
    "new",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
}


@app.get("/admin/orders", response_model=list[OrderResponse])
def get_all_orders(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin),
):
    return (
        db.query(Order)
        .options(joinedload(Order.items))
        .order_by(Order.created_at.desc())
        .all()
    )


@app.patch("/admin/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin),
):
    new_status = data.get("status")

    if new_status not in ALLOWED_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Недопустимый статус заказа.",
        )

    order = db.query(Order).filter(Order.id == order_id).first()

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Заказ не найден.",
        )

    order.status = new_status

    try:
        db.commit()
        db.refresh(order)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Ошибка изменения статуса заказа")
        raise HTTPException(
            status_code=500,
            detail="Не удалось изменить статус заказа.",
        )

    return {
        "message": "Статус заказа обновлён.",
        "order_id": order.id,
        "status": order.status,
    }
