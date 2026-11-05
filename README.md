# Intimate Store API

A full-stack e-commerce project for an online store, built with Python, FastAPI, SQLAlchemy, and MySQL.

The project includes a REST API, user authentication, email verification, product and category management, order processing, and administrative functionality.

## Features

### Authentication and User Accounts
- User registration and login
- Email verification via Resend
- Resending verification emails
- Session-based authentication
- Password hashing
- User profile management

### Products and Categories
- Retrieve product lists and individual products
- Create, update, and delete products (admin only)
- Retrieve product categories

### Orders
- Create orders containing multiple products
- Server-side order total calculation
- Store individual order items, quantities, and prices
- Retrieve individual orders and personal order history
- Admin access to all orders
- Update order statuses

### Security
- Password hashing with pwdlib
- Hashed email verification tokens with expiration
- Role-based access control
- Database transaction rollback on SQLAlchemy errors
- Configuration through environment variables

## Tech Stack

- **Backend:** Python 3.13, FastAPI
- **Database:** MySQL
- **ORM:** SQLAlchemy
- **Validation:** Pydantic
- **Authentication:** Starlette Sessions, pwdlib
- **Email:** Resend API
- **ASGI Server:** Uvicorn
- **Frontend:** HTML, CSS, JavaScript
- **Database Driver:** PyMySQL
- **Version Control:** Git

## Project Structure

```text
intimate_store_api/
├── static/
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   └── IntimateSinCity.jpg
├── .env.example
├── .gitignore
├── database.py
├── main.py
├── models.py
├── schemas.py
└── requirements.txt
```

## Getting Started

### Prerequisites

- Python 3.13.15
- MySQL
- A Resend API key for email verification

### Installation

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
cd intimate_store_api
```

Create a virtual environment:

```bash
python -m venv venv
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### Database Setup

Create a MySQL database named `sex_toys`.

The application expects the database user `Kit` and a local MySQL server on port `3306`. Update `database.py` if your connection settings are different.

**Important:** The application does not create all database tables automatically. The existing database schema must be initialized before running the application. The built-in migration function performs only additive updates to certain existing columns.

### Environment Variables

Create a `.env` file in the project root using `.env.example` as a template.

Configure the required values:

```env
DB_PASSWORD=your_database_password
SESSION_SECRET=your_random_secret_at_least_32_characters
BASE_URL=http://127.0.0.1:8000
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### Run the Application

```bash
uvicorn main:app --reload
```

The application will be available at:

- http://127.0.0.1:8000
- http://127.0.0.1:8000/docs — interactive API documentation

## Development Status

This project is under active development. It is a personal project built with the assistance of AI tools. Development includes implementation decisions, code review, debugging, and testing.