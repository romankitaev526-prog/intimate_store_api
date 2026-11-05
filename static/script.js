const API_URL = "/products";

const $ = (selector) => document.querySelector(selector);

const productGrid = $("#productGrid");
const searchInput = $("#searchInput");
const categoriesContainer = $("#categories");
const productCount = $("#productCount");
const message = $("#message");

const cartButton = $("#cartButton");
const cartCount = $("#cartCount");
const cartDialog = $("#cartDialog");
const cartItems = $("#cartItems");
const cartTotal = $("#cartTotal");
const closeCart = $("#closeCart");

const checkoutForm = $("#checkoutForm");
const checkoutButton = $("#checkoutButton");
const checkoutMessage = $("#checkoutMessage");
const customerName = $("#customerName");
const customerPhone = $("#customerPhone");
const customerAddress = $("#customerAddress");
const continueShopping = $("#continueShopping");

const authDialog = $("#authDialog");
const authTitle = $("#authTitle");
const openLoginButton = $("#openLogin");
const openRegisterButton = $("#openRegister");
const closeAuthButton = $("#closeAuth");

const loginTab = $("#loginTab");
const registerTab = $("#registerTab");
const loginForm = $("#loginForm");
const registerForm = $("#registerForm");
const resendVerificationForm = $("#resendVerificationForm");

const loginMessage = $("#loginMessage");
const registerMessage = $("#registerMessage");
const resendMessage = $("#resendMessage");

const loginSubmit = $("#loginSubmit");
const registerSubmit = $("#registerSubmit");
const resendSubmit = $("#resendSubmit");

const guestActions = $("#guestActions");
const accountButton = $("#accountButton");
const adminButton = $("#adminButton");
const accountDialog = $("#accountDialog");
const closeAccountButton = $("#closeAccount");

const accountName = $("#accountName");
const accountEmail = $("#accountEmail");
const accountPhone = $("#accountPhone");
const accountOrders = $("#accountOrders");
const accountMessage = $("#accountMessage");

const logoutButton = $("#logoutButton");
const profileForm = $("#profileForm");
const profilePhone = $("#profilePhone");
const profileMessage = $("#profileMessage");
const saveProfileButton = $("#saveProfileButton");

let products = [];
let selectedCategory = "Все";
let isSubmittingOrder = false;
let currentUser = null;
let authMode = "login";

let cart = loadSavedCart();

/* Админ-панель */

let adminDialog = null;

let adminOrdersContainer = null;
let adminMessage = null;
let adminRefreshButton = null;

let adminProductsContainer = null;
let adminProductsMessage = null;
let adminRefreshProductsButton = null;
let adminProductForm = null;
let adminProductFormTitle = null;
let adminProductSubmit = null;
let adminCancelEditButton = null;

let adminCategories = [];
let editingProductId = null;

let activeAdminTab = "orders";

const ORDER_STATUSES = [
    "new",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled"
];

const ORDER_STATUS_LABELS = {
    new: "Новый",
    confirmed: "Подтверждён",
    shipped: "Отправлен",
    delivered: "Доставлен",
    cancelled: "Отменён"
};

/* Корзина */

function loadSavedCart() {
    try {
        const saved = JSON.parse(
            localStorage.getItem("intimateStoreCart") || "[]"
        );

        if (!Array.isArray(saved)) {
            return [];
        }

        return saved
            .filter(item =>
                item?.product?.id != null &&
                Number.isFinite(Number(item.quantity)) &&
                Number(item.quantity) > 0
            )
            .map(item => ({
                product: item.product,
                quantity: Math.floor(Number(item.quantity))
            }))
            .filter(item => item.quantity > 0);
    } catch (error) {
        console.error("Не удалось загрузить корзину:", error);
        return [];
    }
}

function formatPrice(price) {
    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 2
    }).format(Number(price) || 0);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const detail = Array.isArray(data.detail)
            ? data.detail.map(item => item.msg || "Ошибка проверки").join("; ")
            : data.detail;

        throw new Error(
            detail || `Ошибка сервера: ${response.status}`
        );
    }

    return data;
}

function getProductId(product) {
    return product.id;
}

function getProductName(product) {
    return product.name ?? product.title ?? "Товар без названия";
}

function getProductPrice(product) {
    return Number(product.price) || 0;
}

function getProductCategory(product) {
    const category = product.category;

    if (category && typeof category === "object") {
        return category.name ?? category.title ?? "Без категории";
    }

    return category ?? "Без категории";
}

function getProductDescription(product) {
    return product.description ?? "Описание скоро появится.";
}

function getProductImage(product) {
    return product.image_url ?? product.image ?? "";
}

/* Загрузка каталога */

async function loadProducts() {
    productGrid.innerHTML =
        '<p class="loading">Загружаем каталог...</p>';

    try {
        const response = await fetch(API_URL);
        products = await readResponse(response);

        if (!Array.isArray(products)) {
            throw new Error("API вернул неожиданный формат каталога.");
        }

        renderCategories();
        renderProducts();
        updateCart();
    } catch (error) {
        console.error("Не удалось загрузить товары:", error);

        productGrid.innerHTML =
            '<p class="error-state">Не удалось загрузить каталог. Проверь, запущен ли FastAPI.</p>';

        updateCart();
    }
}

function renderCategories() {
    const categories = [
        "Все",
        ...new Set(products.map(getProductCategory))
    ];

    categoriesContainer.innerHTML = categories.map(category => `
        <button
            class="category ${category === selectedCategory ? "active" : ""}"
            data-category="${escapeHtml(category)}"
            type="button"
        >
            ${escapeHtml(category === "Все" ? "Все товары" : category)}
        </button>
    `).join("");
}

function renderProducts() {
    const query = searchInput.value.trim().toLocaleLowerCase("ru");

    const filtered = products.filter(product => {
        const name = getProductName(product).toLocaleLowerCase("ru");
        const description = getProductDescription(product)
            .toLocaleLowerCase("ru");

        const matchesSearch =
            name.includes(query) || description.includes(query);

        const matchesCategory =
            selectedCategory === "Все" ||
            getProductCategory(product) === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    productCount.textContent = `Товаров: ${filtered.length}`;

    if (!filtered.length) {
        productGrid.innerHTML =
            '<p class="empty-state">Ничего не найдено.</p>';
        return;
    }

    productGrid.innerHTML = filtered.map(product => {
        const id = getProductId(product);
        const name = getProductName(product);
        const image = getProductImage(product);

        const imageHtml = image
            ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy">`
            : '<div class="product-placeholder">INTIMATE STORE<br>BANANA</div>';

        return `
            <article class="product-card">
                <div class="product-image">
                    ${imageHtml}
                </div>

                <div class="product-info">
                    <span class="product-category">
                        ${escapeHtml(getProductCategory(product))}
                    </span>

                    <h3 class="product-title">
                        ${escapeHtml(name)}
                    </h3>

                    <div class="product-description">
                        ${escapeHtml(getProductDescription(product))}
                    </div>

                    <div class="product-bottom">
                        <span class="product-price">
                            ${formatPrice(getProductPrice(product))}
                        </span>

                        <button
                            class="add-to-cart"
                            data-product-id="${escapeHtml(id)}"
                            type="button"
                        >
                            В корзину
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

/* Работа с корзиной */

function addToCart(id) {
    const product = products.find(
        item => String(getProductId(item)) === String(id)
    );

    if (!product) {
        return;
    }

    const existing = cart.find(
        item => String(getProductId(item.product)) === String(id)
    );

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            product,
            quantity: 1
        });
    }

    updateCart();
    message.textContent = `Добавлено: ${getProductName(product)}`;
}

function changeQuantity(id, delta) {
    const item = cart.find(
        entry => String(getProductId(entry.product)) === String(id)
    );

    if (!item) {
        return;
    }

    item.quantity += delta;

    if (item.quantity <= 0) {
        cart = cart.filter(entry => entry !== item);
    }

    updateCart();
}

function removeFromCart(id) {
    cart = cart.filter(
        item => String(getProductId(item.product)) !== String(id)
    );

    updateCart();
    message.textContent = "Товар удалён из корзины.";
}

function updateCart() {
    try {
        localStorage.setItem(
            "intimateStoreCart",
            JSON.stringify(cart)
        );
    } catch (error) {
        console.error("Не удалось сохранить корзину:", error);
    }

    cartCount.textContent = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    if (!cart.length) {
        cartItems.innerHTML =
            '<p class="cart-note">Корзина пока пуста.</p>';
    } else {
        cartItems.innerHTML = cart.map(item => {
            const id = getProductId(item.product);

            return `
                <div class="cart-item">
                    <span class="cart-item-name">
                        ${escapeHtml(getProductName(item.product))}
                        <br>
                        <small>${formatPrice(getProductPrice(item.product))}</small>
                    </span>

                    <div class="cart-item-controls">
                        <button
                            type="button"
                            data-cart-id="${escapeHtml(id)}"
                            data-delta="-1"
                            aria-label="Уменьшить количество"
                        >−</button>

                        <span>${item.quantity}</span>

                        <button
                            type="button"
                            data-cart-id="${escapeHtml(id)}"
                            data-delta="1"
                            aria-label="Увеличить количество"
                        >+</button>
                    </div>

                    <button
                        type="button"
                        class="remove-from-cart"
                        data-remove-cart-id="${escapeHtml(id)}"
                    >
                        Удалить
                    </button>
                </div>
            `;
        }).join("");
    }

    const total = cart.reduce(
        (sum, item) =>
            sum + getProductPrice(item.product) * item.quantity,
        0
    );

    cartTotal.textContent = `Итого: ${formatPrice(total)}`;
    checkoutButton.disabled = isSubmittingOrder || cart.length === 0;
}

/* Сообщения авторизации */

function setAuthMessage(element, text = "", type = "") {
    if (!element) {
        return;
    }

    element.textContent = text;
    element.classList.toggle("error", type === "error");
    element.classList.toggle("success", type === "success");
}

function setAuthMode(mode) {
    authMode = mode;

    const isLogin = mode === "login";
    const isRegister = mode === "register";
    const isResend = mode === "resend";

    authTitle.textContent = isLogin
        ? "Вход в аккаунт"
        : isRegister
            ? "Регистрация"
            : "Подтверждение email";

    loginForm.hidden = !isLogin;
    registerForm.hidden = !isRegister;
    resendVerificationForm.hidden = !isResend;

    loginTab.classList.toggle("active", isLogin);
    registerTab.classList.toggle("active", isRegister);

    [
        loginMessage,
        registerMessage,
        resendMessage
    ].forEach(element => setAuthMessage(element));
}

function openAuth(mode = "login") {
    setAuthMode(mode);

    if (!authDialog.open) {
        authDialog.showModal();
    }
}

/* Авторизация и отображение кнопок */

function isCurrentUserAdmin() {
    if (!currentUser) {
        return false;
    }

    const value = currentUser.is_admin;

    return value === true ||
        value === 1 ||
        value === "1" ||
        value === "true";
}

function updateAuthUI() {
    const loggedIn = Boolean(currentUser);
    const isAdmin = isCurrentUserAdmin();

    guestActions.hidden = loggedIn;
    accountButton.hidden = !loggedIn;

    adminButton.hidden = !isAdmin;
    adminButton.style.display = isAdmin ? "inline-flex" : "none";

    if (loggedIn) {
        accountButton.textContent =
            `Мой аккаунт: ${currentUser.name || ""}`;

        customerName.value = currentUser.name || "";
        customerName.readOnly = true;

        customerPhone.value = "";

        const hint = checkoutForm.querySelector(".checkout-hint");

        if (hint) {
            hint.textContent =
                "Телефон для этого заказа можно указать отдельно; профиль он не изменит.";
        }
    } else {
        accountButton.textContent = "Мой аккаунт";
        customerName.readOnly = false;

        const hint = checkoutForm.querySelector(".checkout-hint");

        if (hint) {
            hint.textContent =
                "Для оформления заказа сначала войди или зарегистрируйся.";
        }
    }

    console.log("Авторизация:", currentUser);
    console.log("Права администратора:", isAdmin);
}

async function loadCurrentUser() {
    try {
        const response = await fetch("/auth/me", {
            credentials: "same-origin",
            cache: "no-store"
        });

        const data = await response.json().catch(() => null);

        currentUser = response.ok && data?.id
            ? data
            : null;

    } catch (error) {
        console.error("Не удалось проверить авторизацию:", error);
        currentUser = null;
    }

    updateAuthUI();
}

/* Вход */

async function submitLogin(event) {
    event.preventDefault();
    setAuthMessage(loginMessage);

    const oldText = loginSubmit.textContent;

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Входим...";

    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;

    try {
        const response = await fetch("/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                email,
                password
            })
        });

        currentUser = await readResponse(response);

        updateAuthUI();
        authDialog.close();
        loginForm.reset();

        message.textContent =
            `Ты вошёл в аккаунт: ${currentUser.name}.`;
    } catch (error) {
        setAuthMessage(loginMessage, error.message, "error");

        if (/подтверд|verify|verification/i.test(error.message)) {
            $("#resendEmail").value = email;
            $("#resendPassword").value = password;

            setAuthMode("resend");

            setAuthMessage(
                resendMessage,
                "Сначала подтверди email. Можно запросить новое письмо.",
                "error"
            );
        }
    } finally {
        loginSubmit.disabled = false;
        loginSubmit.textContent = oldText;
    }
}

/* Регистрация */

async function submitRegister(event) {
    event.preventDefault();
    setAuthMessage(registerMessage);

    const oldText = registerSubmit.textContent;

    registerSubmit.disabled = true;
    registerSubmit.textContent = "Создаём аккаунт...";

    const payload = {
        name: $("#registerName").value.trim(),
        phone: $("#registerPhone").value.trim() || null,
        email: $("#registerEmail").value.trim(),
        password: $("#registerPassword").value
    };

    try {
        const response = await fetch("/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify(payload)
        });

        const result = await readResponse(response);

        $("#resendEmail").value = payload.email;
        $("#resendPassword").value = payload.password;

        setAuthMode("resend");

        setAuthMessage(
            resendMessage,
            result.message ||
                "Аккаунт создан. Проверь почту и перейди по ссылке подтверждения. Ссылка действует 30 минут.",
            "success"
        );
    } catch (error) {
        setAuthMessage(registerMessage, error.message, "error");
    } finally {
        registerSubmit.disabled = false;
        registerSubmit.textContent = oldText;
    }
}

/* Повторная отправка письма */

async function resendVerification(event) {
    event.preventDefault();
    setAuthMessage(resendMessage);

    const oldText = resendSubmit.textContent;

    resendSubmit.disabled = true;
    resendSubmit.textContent = "Отправляем...";

    try {
        const response = await fetch("/auth/resend-verification", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                email: $("#resendEmail").value.trim(),
                password: $("#resendPassword").value
            })
        });

        const result = await readResponse(response);

        setAuthMessage(
            resendMessage,
            result.message ||
                "Если аккаунт ожидает подтверждения, письмо отправлено.",
            "success"
        );
    } catch (error) {
        setAuthMessage(resendMessage, error.message, "error");
    } finally {
        resendSubmit.disabled = false;
        resendSubmit.textContent = oldText;
    }
}

/* Выход */

async function logout() {
    logoutButton.disabled = true;
    setAuthMessage(accountMessage);

    try {
        await readResponse(
            await fetch("/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            })
        );

        currentUser = null;
        updateAuthUI();

        if (accountDialog.open) {
            accountDialog.close();
        }

        if (adminDialog?.open) {
            adminDialog.close();
        }

        message.textContent = "Ты вышел из аккаунта.";
    } catch (error) {
        setAuthMessage(accountMessage, error.message, "error");
    } finally {
        logoutButton.disabled = false;
    }
}

/* Заказы пользователя */

async function loadMyOrders() {
    accountOrders.innerHTML =
        "<p>Загружаем историю заказов...</p>";

    setAuthMessage(accountMessage);

    try {
        const orders = await readResponse(
            await fetch("/my/orders", {
                credentials: "same-origin"
            })
        );

        if (!Array.isArray(orders)) {
            throw new Error("Сервер вернул неожиданный формат заказов.");
        }

        if (!orders.length) {
            accountOrders.innerHTML =
                "<p>У тебя пока нет заказов.</p>";
            return;
        }

        accountOrders.innerHTML = orders.map(order => {
            const itemsHtml = (
                Array.isArray(order.items) ? order.items : []
            ).map(item => {
                const product = products.find(
                    product => Number(product.id) === Number(item.product_id)
                );

                const name = product
                    ? getProductName(product)
                    : `Товар №${item.product_id}`;

                return `
                    <p>
                        ${escapeHtml(name)} —
                        ${Number(item.quantity)} шт. ×
                        ${formatPrice(item.price)}
                    </p>
                `;
            }).join("");

            const date = order.created_at
                ? new Date(order.created_at).toLocaleString("ru-RU")
                : "Дата не указана";

            return `
                <article class="account-order">
                    <p><strong>Заказ №${escapeHtml(order.id)}</strong></p>
                    <p>Дата: ${escapeHtml(date)}</p>
                    <p>Статус: ${escapeHtml(order.status || "не указан")}</p>

                    ${itemsHtml}

                    <p>
                        <strong>
                            Итого: ${formatPrice(order.total_amount)}
                        </strong>
                    </p>

                    <p>Адрес: ${escapeHtml(order.address || "")}</p>
                </article>
            `;
        }).join("");
    } catch (error) {
        accountOrders.innerHTML = "";
        setAuthMessage(accountMessage, error.message, "error");
    }
}

async function openAccount() {
    if (!currentUser) {
        openAuth("login");
        return;
    }

    accountName.textContent = currentUser.name || "";
    accountEmail.textContent = currentUser.email || "";

    accountPhone.textContent = currentUser.phone
        ? `Телефон: ${currentUser.phone}`
        : "Телефон не указан";

    profilePhone.value = currentUser.phone || "";
    setAuthMessage(profileMessage);

    if (!accountDialog.open) {
        accountDialog.showModal();
    }

    await loadMyOrders();
}

/* Обновление профиля */

async function saveProfile(event) {
    event.preventDefault();
    setAuthMessage(profileMessage);

    const oldText = saveProfileButton.textContent;

    saveProfileButton.disabled = true;
    saveProfileButton.textContent = "Сохраняем...";

    try {
        const response = await fetch("/auth/profile", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                phone: profilePhone.value.trim() || null
            })
        });

        const result = await readResponse(response);
        const updatedUser = result.user || result;

        currentUser = {
            ...currentUser,
            ...updatedUser,
            is_admin: updatedUser.is_admin ?? currentUser.is_admin
        };

        updateAuthUI();

        accountPhone.textContent = currentUser.phone
            ? `Телефон: ${currentUser.phone}`
            : "Телефон не указан";

        profilePhone.value = currentUser.phone || "";

        setAuthMessage(
            profileMessage,
            "Телефон профиля обновлён.",
            "success"
        );
    } catch (error) {
        setAuthMessage(profileMessage, error.message, "error");
    } finally {
        saveProfileButton.disabled = false;
        saveProfileButton.textContent = oldText;
    }
}

/* =========================================================
   АДМИН-ПАНЕЛЬ
========================================================= */

function setAdminMessage(element, text = "", type = "") {
    if (!element) {
        return;
    }

    element.textContent = text;
    element.classList.toggle("error", type === "error");
    element.classList.toggle("success", type === "success");
}

/* Создание админ-панели */

function createAdminDialog() {
    if (adminDialog) {
        return;
    }

    adminDialog = document.createElement("dialog");
    adminDialog.id = "adminDialog";
    adminDialog.className = "store-dialog";

    adminDialog.innerHTML = `
        <div class="dialog-header">
            <h2>Админ-панель</h2>

            <button
                type="button"
                id="closeAdminDialog"
                aria-label="Закрыть"
            >×</button>
        </div>

        <div class="admin-panel-content">

            <div class="admin-tabs">
                <button
                    type="button"
                    class="admin-tab active"
                    data-admin-tab="orders"
                >
                    Заказы
                </button>

                <button
                    type="button"
                    class="admin-tab"
                    data-admin-tab="products"
                >
                    Товары
                </button>
            </div>

            <!-- Вкладка заказов -->

            <section id="adminOrdersTab" class="admin-tab-content">

                <div class="admin-panel-toolbar">
                    <h3>Заказы</h3>

                    <button
                        type="button"
                        id="refreshAdminOrders"
                    >
                        Обновить
                    </button>
                </div>

                <p id="adminMessage" role="status"></p>

                <div id="adminOrdersContainer">
                    <p>Загрузка заказов...</p>
                </div>

            </section>

            <!-- Вкладка товаров -->

            <section
                id="adminProductsTab"
                class="admin-tab-content"
                hidden
            >

                <div class="admin-panel-toolbar">
                    <h3>Управление товарами</h3>

                    <button
                        type="button"
                        id="refreshAdminProducts"
                    >
                        Обновить
                    </button>
                </div>

                <p id="adminProductsMessage" role="status"></p>

                <div class="admin-product-editor">

                    <h3 id="adminProductFormTitle">
                        Добавить товар
                    </h3>

                    <form id="adminProductForm">

                        <label>
                            Название товара
                            <input
                                type="text"
                                name="name"
                                id="adminProductName"
                                required
                                maxlength="255"
                            >
                        </label>

                        <label>
                            Бренд
                            <input
                                type="text"
                                name="brand"
                                id="adminProductBrand"
                                maxlength="255"
                            >
                        </label>

                        <label>
                            Цена
                            <input
                                type="number"
                                name="price"
                                id="adminProductPrice"
                                min="0"
                                step="0.01"
                                required
                            >
                        </label>

                        <label>
                            Категория
                            <select
                                name="category_id"
                                id="adminProductCategory"
                                required
                            >
                                <option value="">
                                    Выбери категорию
                                </option>
                            </select>
                        </label>

                        <label>
                            Дата покупки
                            <input
                                type="date"
                                name="purchase_date"
                                id="adminProductPurchaseDate"
                            >
                        </label>

                        <label>
                            ID поставщика
                            <input
                                type="number"
                                name="suppliers_id"
                                id="adminProductSupplier"
                                min="1"
                            >
                        </label>

                        <label class="admin-product-description-label">
                            Описание
                            <textarea
                                name="description"
                                id="adminProductDescription"
                                rows="4"
                            ></textarea>
                        </label>

                        <div class="admin-product-form-buttons">

                            <button
                                type="submit"
                                id="adminProductSubmit"
                            >
                                Добавить товар
                            </button>

                            <button
                                type="button"
                                id="adminCancelEdit"
                                hidden
                            >
                                Отменить редактирование
                            </button>

                        </div>

                    </form>

                </div>

                <div class="admin-products-list">

                    <h3>Список товаров</h3>

                    <div id="adminProductsContainer">
                        <p>Загружаем товары...</p>
                    </div>

                </div>

            </section>

        </div>
    `;

    document.body.appendChild(adminDialog);

    adminOrdersContainer = $("#adminOrdersContainer");
    adminMessage = $("#adminMessage");
    adminRefreshButton = $("#refreshAdminOrders");

    adminProductsContainer = $("#adminProductsContainer");
    adminProductsMessage = $("#adminProductsMessage");
    adminRefreshProductsButton = $("#refreshAdminProducts");

    adminProductForm = $("#adminProductForm");
    adminProductFormTitle = $("#adminProductFormTitle");
    adminProductSubmit = $("#adminProductSubmit");
    adminCancelEditButton = $("#adminCancelEdit");

    $("#closeAdminDialog").addEventListener("click", () => {
        adminDialog.close();
    });

    /* Переключение вкладок */

    adminDialog.querySelectorAll("[data-admin-tab]").forEach(button => {
        button.addEventListener("click", () => {
            switchAdminTab(button.dataset.adminTab);
        });
    });

    /* Обновление заказов */

    adminRefreshButton.addEventListener("click", loadAdminOrders);

    /* Обновление товаров */

    adminRefreshProductsButton.addEventListener(
        "click",
        loadAdminProducts
    );

    /* Изменение статуса заказа */

    adminOrdersContainer.addEventListener("change", async event => {
        const select = event.target.closest("[data-order-status-id]");

        if (!select) {
            return;
        }

        await updateOrderStatus(
            select.dataset.orderStatusId,
            select.value,
            select
        );
    });

    /* Форма товара */

    adminProductForm.addEventListener("submit", saveAdminProduct);

    /* Отмена редактирования */

    adminCancelEditButton.addEventListener("click", resetAdminProductForm);

    /* Кнопки редактирования и удаления товаров */

    adminProductsContainer.addEventListener("click", async event => {
        const editButton = event.target.closest("[data-edit-product]");
        const deleteButton = event.target.closest("[data-delete-product]");

        if (editButton) {
            editAdminProduct(editButton.dataset.editProduct);
            return;
        }

        if (deleteButton) {
            await deleteAdminProduct(deleteButton.dataset.deleteProduct);
        }
    });

    /* Стили админ-панели */

    const style = document.createElement("style");

    style.textContent = `
        #adminDialog {
            width: min(900px, calc(100% - 30px));
            max-width: 900px;
            max-height: 85vh;
            padding: 24px;
            border: 0;
            border-radius: 16px;
            overflow: auto;
        }

        #adminDialog::backdrop {
            background: rgba(0, 0, 0, .65);
        }

        #adminDialog .dialog-header,
        #adminDialog .admin-panel-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

        #adminDialog .dialog-header button {
            border: 0;
            background: transparent;
            font-size: 28px;
            cursor: pointer;
        }

        #adminDialog button,
        #adminDialog select {
            cursor: pointer;
        }

        #adminDialog .admin-tabs {
            display: flex;
            gap: 10px;
            margin: 20px 0;
            border-bottom: 1px solid #ddd;
        }

        #adminDialog .admin-tab {
            padding: 10px 18px;
            border: 0;
            border-bottom: 3px solid transparent;
            background: transparent;
            font-size: 15px;
        }

        #adminDialog .admin-tab.active {
            border-bottom-color: currentColor;
            font-weight: 700;
        }

        #adminDialog .admin-order {
            padding: 16px;
            margin: 12px 0;
            border: 1px solid #ddd;
            border-radius: 12px;
        }

        #adminDialog .admin-order p {
            margin: 6px 0;
        }

        #adminDialog .admin-order select {
            max-width: 240px;
            padding: 8px;
            margin-top: 8px;
        }

        #adminDialog .admin-order-items {
            margin: 10px 0;
            padding-left: 20px;
        }

        #adminMessage.error,
        #adminProductsMessage.error {
            color: #b42318;
        }

        #adminMessage.success,
        #adminProductsMessage.success {
            color: #167a42;
        }

        #adminDialog .admin-product-editor {
            padding: 18px;
            margin: 16px 0 24px;
            border: 1px solid #ddd;
            border-radius: 12px;
        }

        #adminDialog #adminProductForm {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
        }

        #adminDialog #adminProductForm label {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 14px;
        }

        #adminDialog #adminProductForm input,
        #adminDialog #adminProductForm select,
        #adminDialog #adminProductForm textarea {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 8px;
            font: inherit;
        }

        #adminDialog .admin-product-description-label {
            grid-column: 1 / -1;
        }

        #adminDialog .admin-product-form-buttons {
            grid-column: 1 / -1;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        #adminDialog .admin-product-form-buttons button {
            padding: 10px 16px;
        }

        #adminDialog .admin-product-card {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 16px;
            padding: 14px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 12px;
        }

        #adminDialog .admin-product-card h4 {
            margin: 0 0 8px;
        }

        #adminDialog .admin-product-card p {
            margin: 5px 0;
        }

        #adminDialog .admin-product-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        #adminDialog .admin-product-actions button {
            padding: 8px 12px;
        }

        #adminDialog .admin-delete-button {
            color: #b42318;
        }

        @media (max-width: 600px) {
            #adminDialog {
                padding: 16px;
            }

            #adminDialog #adminProductForm {
                grid-template-columns: 1fr;
            }

            #adminDialog .admin-product-description-label,
            #adminDialog .admin-product-form-buttons {
                grid-column: auto;
            }

            #adminDialog .admin-product-card {
                grid-template-columns: 1fr;
            }
        }
    `;

    document.head.appendChild(style);
}

/* Переключение вкладок админ-панели */

function switchAdminTab(tab) {
    if (!adminDialog) {
        return;
    }

    activeAdminTab = tab === "products" ? "products" : "orders";

    const ordersTab = $("#adminOrdersTab");
    const productsTab = $("#adminProductsTab");

    ordersTab.hidden = activeAdminTab !== "orders";
    productsTab.hidden = activeAdminTab !== "products";

    adminDialog.querySelectorAll("[data-admin-tab]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.adminTab === activeAdminTab
        );
    });

    if (activeAdminTab === "orders") {
        loadAdminOrders();
    } else {
        loadAdminCategories().then(() => loadAdminProducts());
    }
}

/* Открытие админ-панели */

async function openAdminPanel() {
    if (!isCurrentUserAdmin()) {
        message.textContent = "Доступ запрещён.";
        return;
    }

    createAdminDialog();

    if (!adminDialog.open) {
        adminDialog.showModal();
    }

    switchAdminTab("orders");
}

/* =========================================================
   АДМИНКА: ЗАКАЗЫ
========================================================= */

async function loadAdminOrders() {
    if (!isCurrentUserAdmin()) {
        setAdminMessage(
            adminMessage,
            "Нет прав администратора.",
            "error"
        );
        return;
    }

    adminRefreshButton.disabled = true;
    adminOrdersContainer.innerHTML = "<p>Загружаем заказы...</p>";
    setAdminMessage(adminMessage);

    try {
        const orders = await readResponse(
            await fetch("/admin/orders", {
                credentials: "same-origin",
                cache: "no-store"
            })
        );

        if (!Array.isArray(orders)) {
            throw new Error("Сервер вернул неожиданный формат заказов.");
        }

        if (!orders.length) {
            adminOrdersContainer.innerHTML =
                "<p>Заказов пока нет.</p>";
            return;
        }

        adminOrdersContainer.innerHTML = orders.map(order => {
            const date = order.created_at
                ? new Date(order.created_at).toLocaleString("ru-RU")
                : "Дата не указана";

            const items = Array.isArray(order.items)
                ? order.items
                : [];

            const itemsHtml = items.map(item => {
                const product = products.find(
                    p => Number(p.id) === Number(item.product_id)
                );

                const name = product
                    ? getProductName(product)
                    : `Товар №${item.product_id}`;

                return `
                    <li>
                        ${escapeHtml(name)} —
                        ${Number(item.quantity)} шт. ×
                        ${formatPrice(item.price)}
                    </li>
                `;
            }).join("");

            const status = ORDER_STATUSES.includes(order.status)
                ? order.status
                : "new";

            const statusOptions = ORDER_STATUSES.map(value => `
                <option
                    value="${value}"
                    ${value === status ? "selected" : ""}
                >
                    ${ORDER_STATUS_LABELS[value]}
                </option>
            `).join("");

            return `
                <article class="admin-order">

                    <p>
                        <strong>
                            Заказ №${escapeHtml(order.id)}
                        </strong>
                    </p>

                    <p>Дата: ${escapeHtml(date)}</p>

                    <p>
                        Имя:
                        ${escapeHtml(order.name || order.customer_name || "Не указано")}
                    </p>

                    <p>
                        Телефон:
                        ${escapeHtml(order.phone || "Не указан")}
                    </p>

                    <p>
                        Адрес:
                        ${escapeHtml(order.address || "Не указан")}
                    </p>

                    <p><strong>Состав заказа:</strong></p>

                    <ul class="admin-order-items">
                        ${itemsHtml || "<li>Состав не указан</li>"}
                    </ul>

                    <p>
                        <strong>
                            Сумма: ${formatPrice(order.total_amount)}
                        </strong>
                    </p>

                    <label>
                        Статус:

                        <select
                            data-order-status-id="${escapeHtml(order.id)}"
                        >
                            ${statusOptions}
                        </select>
                    </label>

                </article>
            `;
        }).join("");

    } catch (error) {
        adminOrdersContainer.innerHTML = "";

        setAdminMessage(
            adminMessage,
            error.message,
            "error"
        );
    } finally {
        adminRefreshButton.disabled = false;
    }
}

/* Изменение статуса заказа */

async function updateOrderStatus(orderId, status, select) {
    if (!isCurrentUserAdmin()) {
        setAdminMessage(
            adminMessage,
            "Нет прав администратора.",
            "error"
        );
        return;
    }

    if (!ORDER_STATUSES.includes(status)) {
        setAdminMessage(
            adminMessage,
            "Недопустимый статус заказа.",
            "error"
        );
        return;
    }

    select.disabled = true;

    try {
        await readResponse(
            await fetch(
                `/admin/orders/${encodeURIComponent(orderId)}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({ status })
                }
            )
        );

        setAdminMessage(
            adminMessage,
            `Статус заказа №${orderId} обновлён.`,
            "success"
        );

    } catch (error) {
        setAdminMessage(
            adminMessage,
            error.message,
            "error"
        );

        await loadAdminOrders();
    } finally {
        select.disabled = false;
    }
}

/* =========================================================
   АДМИНКА: КАТЕГОРИИ ТОВАРОВ
========================================================= */

async function loadAdminCategories() {
    if (!isCurrentUserAdmin()) {
        return;
    }

    try {
        const categories = await readResponse(
            await fetch("/categories", {
                credentials: "same-origin",
                cache: "no-store"
            })
        );

        if (!Array.isArray(categories)) {
            throw new Error("Сервер вернул неожиданный формат категорий.");
        }

        adminCategories = categories;

        renderAdminCategoryOptions();

    } catch (error) {
        console.error("Не удалось загрузить категории:", error);

        setAdminMessage(
            adminProductsMessage,
            `Не удалось загрузить категории: ${error.message}`,
            "error"
        );
    }
}

function renderAdminCategoryOptions(selectedId = "") {
    const categorySelect = $("#adminProductCategory");

    if (!categorySelect) {
        return;
    }

    categorySelect.innerHTML = `
        <option value="">Выбери категорию</option>

        ${adminCategories.map(category => `
            <option
                value="${escapeHtml(category.id)}"
                ${String(category.id) === String(selectedId) ? "selected" : ""}
            >
                ${escapeHtml(category.name ?? category.title ?? `Категория №${category.id}`)}
            </option>
        `).join("")}
    `;
}

/* =========================================================
   АДМИНКА: ЗАГРУЗКА И ОТОБРАЖЕНИЕ ТОВАРОВ
========================================================= */

async function loadAdminProducts() {
    if (!isCurrentUserAdmin()) {
        setAdminMessage(
            adminProductsMessage,
            "Нет прав администратора.",
            "error"
        );
        return;
    }

    adminRefreshProductsButton.disabled = true;
    adminProductsContainer.innerHTML = "<p>Загружаем товары...</p>";

    setAdminMessage(adminProductsMessage);

    try {
        const result = await readResponse(
            await fetch(API_URL, {
                credentials: "same-origin",
                cache: "no-store"
            })
        );

        if (!Array.isArray(result)) {
            throw new Error("Сервер вернул неожиданный формат товаров.");
        }

        products = result;

        renderAdminProducts();
        renderCategories();
        renderProducts();
        updateCart();

    } catch (error) {
        adminProductsContainer.innerHTML = "";

        setAdminMessage(
            adminProductsMessage,
            error.message,
            "error"
        );
    } finally {
        adminRefreshProductsButton.disabled = false;
    }
}

function renderAdminProducts() {
    if (!products.length) {
        adminProductsContainer.innerHTML =
            "<p>Товаров пока нет.</p>";
        return;
    }

    adminProductsContainer.innerHTML = products.map(product => {
        const id = getProductId(product);

        const categoryName = getProductCategory(product);

        return `
            <article class="admin-product-card">

                <div class="admin-product-info">

                    <h4>
                        ${escapeHtml(getProductName(product))}
                    </h4>

                    <p>
                        ID: ${escapeHtml(id)}
                    </p>

                    <p>
                        Бренд:
                        ${escapeHtml(product.brand || "Не указан")}
                    </p>

                    <p>
                        Категория:
                        ${escapeHtml(categoryName)}
                    </p>

                    <p>
                        Цена:
                        <strong>${formatPrice(product.price)}</strong>
                    </p>

                    <p>
                        Описание:
                        ${escapeHtml(product.description || "Не указано")}
                    </p>

                </div>

                <div class="admin-product-actions">

                    <button
                        type="button"
                        data-edit-product="${escapeHtml(id)}"
                    >
                        Редактировать
                    </button>

                    <button
                        type="button"
                        class="admin-delete-button"
                        data-delete-product="${escapeHtml(id)}"
                    >
                        Удалить
                    </button>

                </div>

            </article>
        `;
    }).join("");
}

/* =========================================================
   АДМИНКА: ДОБАВЛЕНИЕ И РЕДАКТИРОВАНИЕ ТОВАРОВ
========================================================= */

function resetAdminProductForm() {
    if (!adminProductForm) {
        return;
    }

    editingProductId = null;

    adminProductForm.reset();

    adminProductFormTitle.textContent = "Добавить товар";
    adminProductSubmit.textContent = "Добавить товар";

    adminCancelEditButton.hidden = true;

    renderAdminCategoryOptions();
    setAdminMessage(adminProductsMessage);
}

function editAdminProduct(productId) {
    if (!isCurrentUserAdmin()) {
        return;
    }

    const product = products.find(
        item => String(item.id) === String(productId)
    );

    if (!product) {
        setAdminMessage(
            adminProductsMessage,
            "Товар не найден.",
            "error"
        );
        return;
    }

    editingProductId = product.id;

    $("#adminProductName").value = product.name || "";
    $("#adminProductBrand").value = product.brand || "";
    $("#adminProductPrice").value = product.price ?? "";

    $("#adminProductPurchaseDate").value =
        product.purchase_date
            ? String(product.purchase_date).slice(0, 10)
            : "";

    $("#adminProductSupplier").value =
        product.suppliers_id ?? "";

    $("#adminProductDescription").value =
        product.description || "";

    let categoryId = product.category_id;

    if (categoryId == null && product.category && typeof product.category === "object") {
        categoryId = product.category.id;
    }

    renderAdminCategoryOptions(categoryId ?? "");

    adminProductFormTitle.textContent = "Редактировать товар";
    adminProductSubmit.textContent = "Сохранить изменения";

    adminCancelEditButton.hidden = false;

    adminProductForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    setAdminMessage(
        adminProductsMessage,
        `Редактирование товара №${product.id}.`,
        "success"
    );
}

async function saveAdminProduct(event) {
    event.preventDefault();

    if (!isCurrentUserAdmin()) {
        setAdminMessage(
            adminProductsMessage,
            "Нет прав администратора.",
            "error"
        );
        return;
    }

    const name = $("#adminProductName").value.trim();
    const brand = $("#adminProductBrand").value.trim();
    const price = Number($("#adminProductPrice").value);
    const categoryId = $("#adminProductCategory").value;
    const purchaseDate = $("#adminProductPurchaseDate").value;
    const supplierValue = $("#adminProductSupplier").value;
    const description = $("#adminProductDescription").value.trim();

    if (!name) {
        setAdminMessage(
            adminProductsMessage,
            "Укажи название товара.",
            "error"
        );
        return;
    }

    if (!Number.isFinite(price) || price < 0) {
        setAdminMessage(
            adminProductsMessage,
            "Укажи корректную цену товара.",
            "error"
        );
        return;
    }

    if (!categoryId) {
        setAdminMessage(
            adminProductsMessage,
            "Выбери категорию товара.",
            "error"
        );
        return;
    }

    const payload = {
        name,
        brand: brand || null,
        price,
        category_id: Number(categoryId),
        purchase_date: purchaseDate || null,
        suppliers_id: supplierValue
            ? Number(supplierValue)
            : null,
        description: description || null
    };

    const isEditing = editingProductId !== null;

    const url = isEditing
        ? `${API_URL}/${encodeURIComponent(editingProductId)}`
        : API_URL;

    const method = isEditing ? "PATCH" : "POST";

    const oldButtonText = adminProductSubmit.textContent;

    adminProductSubmit.disabled = true;
    adminProductSubmit.textContent = isEditing
        ? "Сохраняем..."
        : "Добавляем...";

    setAdminMessage(adminProductsMessage);

    try {
        await readResponse(
            await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            })
        );

        resetAdminProductForm();

        await loadAdminProducts();

        setAdminMessage(
            adminProductsMessage,
            isEditing
                ? "Изменения товара сохранены."
                : "Товар успешно добавлен.",
            "success"
        );

    } catch (error) {
        setAdminMessage(
            adminProductsMessage,
            error.message,
            "error"
        );
    } finally {
        adminProductSubmit.disabled = false;

        if (editingProductId !== null) {
            adminProductSubmit.textContent = "Сохранить изменения";
        } else {
            adminProductSubmit.textContent = oldButtonText;
        }
    }
}

/* =========================================================
   АДМИНКА: УДАЛЕНИЕ ТОВАРОВ
========================================================= */

async function deleteAdminProduct(productId) {
    if (!isCurrentUserAdmin()) {
        setAdminMessage(
            adminProductsMessage,
            "Нет прав администратора.",
            "error"
        );
        return;
    }

    const product = products.find(
        item => String(item.id) === String(productId)
    );

    if (!product) {
        setAdminMessage(
            adminProductsMessage,
            "Товар не найден.",
            "error"
        );
        return;
    }

    const confirmed = window.confirm(
        `Удалить товар «${getProductName(product)}»?\n\nЭто действие нельзя отменить.`
    );

    if (!confirmed) {
        return;
    }

    setAdminMessage(
        adminProductsMessage,
        "Удаляем товар..."
    );

    try {
        await readResponse(
            await fetch(
                `${API_URL}/${encodeURIComponent(productId)}`,
                {
                    method: "DELETE",
                    credentials: "same-origin"
                }
            )
        );

        /* Убираем удалённый товар из корзины */

        cart = cart.filter(
            item => String(getProductId(item.product)) !== String(productId)
        );

        /* Если редактировался удалённый товар — сбрасываем форму */

        if (String(editingProductId) === String(productId)) {
            resetAdminProductForm();
        }

        await loadAdminProducts();

        setAdminMessage(
            adminProductsMessage,
            "Товар удалён.",
            "success"
        );

    } catch (error) {
        setAdminMessage(
            adminProductsMessage,
            error.message,
            "error"
        );
    }
}

/* =========================================================
   ОФОРМЛЕНИЕ ЗАКАЗА
========================================================= */

function showCheckoutMessage(text, isError = false) {
    checkoutMessage.textContent = text;
    checkoutMessage.classList.toggle("error", isError);
}

async function submitOrder(event) {
    event.preventDefault();

    if (isSubmittingOrder) {
        return;
    }

    if (!currentUser) {
        showCheckoutMessage(
            "Сначала войди в аккаунт или зарегистрируйся.",
            true
        );

        openAuth("login");
        return;
    }

    if (!cart.length) {
        showCheckoutMessage("Добавь товары в корзину.", true);
        return;
    }

    const address = customerAddress.value.trim();
    const phone = customerPhone.value.trim();

    if (!address) {
        showCheckoutMessage("Укажи адрес доставки.", true);
        customerAddress.focus();
        return;
    }

    const payload = {
        address,
        phone: phone || null,
        items: cart.map(item => ({
            product_id: Number(getProductId(item.product)),
            quantity: item.quantity
        }))
    };

    isSubmittingOrder = true;
    checkoutButton.disabled = true;
    checkoutButton.textContent = "Отправляем...";
    showCheckoutMessage("");

    try {
        const result = await readResponse(
            await fetch("/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            })
        );

        cart = [];
        updateCart();

        customerAddress.value = "";
        customerPhone.value = "";

        showCheckoutMessage(
            `Заказ №${result.id} оформлен! Сумма: ${formatPrice(result.total_amount)}.`
        );

        message.textContent =
            `Заказ №${result.id} успешно сохранён.`;

        checkoutButton.textContent = "Заказ оформлен";
        checkoutButton.disabled = true;

        checkoutForm.querySelectorAll("input, textarea").forEach(field => {
            field.disabled = true;
        });
    } catch (error) {
        showCheckoutMessage(
            `Не удалось оформить заказ: ${error.message}`,
            true
        );
    } finally {
        isSubmittingOrder = false;

        if (checkoutButton.textContent !== "Заказ оформлен") {
            checkoutButton.disabled = cart.length === 0;
            checkoutButton.textContent = "Оформить заказ";
        }
    }
}

function resetCheckoutFormState() {
    checkoutForm.querySelectorAll("input, textarea").forEach(field => {
        field.disabled = false;
    });

    checkoutButton.textContent = "Оформить заказ";
    updateCart();
    showCheckoutMessage("");
}

/* =========================================================
   ПОИСК, КАТЕГОРИИ И КАТАЛОГ
========================================================= */

searchInput.addEventListener("input", renderProducts);

categoriesContainer.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");

    if (!button) {
        return;
    }

    selectedCategory = button.dataset.category;

    renderCategories();
    renderProducts();
});

productGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-product-id]");

    if (button) {
        addToCart(button.dataset.productId);
    }
});

/* =========================================================
   КОРЗИНА И ЗАКАЗ
========================================================= */

cartButton.addEventListener("click", () => {
    resetCheckoutFormState();
    updateCart();

    if (!cartDialog.open) {
        cartDialog.showModal();
    }
});

closeCart.addEventListener("click", () => {
    cartDialog.close();
});

cartItems.addEventListener("click", event => {
    const removeButton = event.target.closest("[data-remove-cart-id]");

    if (removeButton) {
        removeFromCart(removeButton.dataset.removeCartId);
        return;
    }

    const quantityButton = event.target.closest("[data-cart-id]");

    if (quantityButton) {
        changeQuantity(
            quantityButton.dataset.cartId,
            Number(quantityButton.dataset.delta)
        );
    }
});

checkoutForm.addEventListener("submit", submitOrder);

continueShopping.addEventListener("click", () => {
    cartDialog.close();
    resetCheckoutFormState();
});

/* =========================================================
   АВТОРИЗАЦИЯ И ПОДТВЕРЖДЕНИЕ EMAIL
========================================================= */

openLoginButton.addEventListener("click", () => openAuth("login"));
openRegisterButton.addEventListener("click", () => openAuth("register"));

closeAuthButton.addEventListener("click", () => {
    authDialog.close();
});

loginTab.addEventListener("click", () => setAuthMode("login"));
registerTab.addEventListener("click", () => setAuthMode("register"));

loginForm.addEventListener("submit", submitLogin);
registerForm.addEventListener("submit", submitRegister);
resendVerificationForm.addEventListener("submit", resendVerification);

$("#backToLogin").addEventListener("click", () => {
    setAuthMode("login");
});

/* =========================================================
   ЛИЧНЫЙ КАБИНЕТ И ПРОФИЛЬ
========================================================= */

accountButton.addEventListener("click", openAccount);

adminButton.addEventListener("click", openAdminPanel);

closeAccountButton.addEventListener("click", () => {
    accountDialog.close();
});

logoutButton.addEventListener("click", logout);
profileForm.addEventListener("submit", saveProfile);

/* =========================================================
   ЗАПУСК
========================================================= */

async function init() {
    await Promise.all([
        loadProducts(),
        loadCurrentUser()
    ]);
}

init();