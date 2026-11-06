# Velaire Commerce System

**An AI-powered retail operations and business management platform** connecting point-of-sale operations, inventory management, business analytics, explainable machine-learning forecasts, and an intelligent task assistant.

---

## Overview

Velaire is a retail operations system designed to bring essential business activities into one centralized platform.

It combines checkout management, inventory tracking, sales analytics, machine-learning-based forecasting, and a grounded task assistant to help businesses understand their operations and make better decisions.

## Key Features

- **Role-Based Authentication:** Role-aware sign-in, dashboards, and administrator-managed invitations.
- **Point of Sale (POS):** Checkout operations with atomic transactions.
- **Inventory Management:** Product, supplier, stock, and invoice management.
- **Stock Movement Tracking:** Inventory movement ledger and stock monitoring.
- **Business Analytics:** Sales, operational insights, and performance analytics.
- **Machine Learning:** Model comparison and explainable inventory forecasts.
- **AI Task Assistant:** Inventory FAQs and permission-checked operational tasks.
- **Responsive Interface:** Dedicated POS, operations dashboard, inventory, and forecasting views.

## Technology & Architecture

Velaire combines a modern web frontend with a Python backend and database infrastructure.

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Python, FastAPI |
| Database | SQLite / PostgreSQL |
| Machine Learning | Synthetic starter model fixtures |
| API Documentation | FastAPI / Swagger UI |
| Containerization | Docker & Docker Compose |

**Architecture highlights:**
- React production container with API proxy.
- PostgreSQL deployment through Docker Compose.
- SQLite fallback for local development.
- Database migrations using Alembic.
- Documented system architecture and implementation plan.

## Getting Started

### Prerequisites

Install the following before running the application:

- Node.js 20+
- Python 3.11+
- Git

### Run Locally on Windows

Clone the repository:

```powershell
git clone https://github.com/techprem324/AI-powered-Business-management-system.git

cd AI-powered-Business-management-system
```

Start the application:

```powershell
.\start-local.ps1
```

On the first run, the startup script automatically:

1. Creates the backend Python virtual environment.
2. Installs missing frontend dependencies.
3. Starts the API with a local SQLite database.
4. Loads development demo data.
5. Starts the frontend.
6. Waits for both services and opens the application in your browser.

Subsequent runs reuse installed dependencies and the existing local database.

### Local Application URLs

| Service | URL |
|---|---|
| Application | http://127.0.0.1:5174 |
| API Documentation | http://127.0.0.1:8000/docs |

**Demo Login (Development Only)**

```text
Email: manager@example.com
Password: Demo123!
```

Stop local services:

```powershell
.\stop-local.ps1
```

Local logs and process IDs are stored in the ignored `.local` directory.

The local SQLite database is located at:

```text
backend/velaire-local.db
```

## Docker & PostgreSQL Setup

For the Docker-based PostgreSQL configuration:

```bash
docker compose up --build -d
```

Configure the required environment variables in `.env` before starting the containers.

## Account Setup & Authentication

### Email Signup

- Standard email signup creates a cashier account.
- Administrators can issue role-specific invitations through **Settings**.
- Each invitation is bound to one email address.
- Invitations expire after seven days and can only be used once.
- Generated `VL-` invitation codes are case-sensitive and displayed only when created.

Administrator invitations grant the selected Velaire role, not access to the administrator's device or local files.

### Google Sign-In (Optional)

To enable Google authentication:

1. Create a Google OAuth client.
2. Add the callback URL from `GOOGLE_REDIRECT_URI` as an authorized redirect URI.
3. Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**Docker Compose callback:**

```text
http://localhost:8080/api/auth/oauth/google/callback
```

**Direct local development configuration:**

```env
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/auth/oauth/google/callback
PUBLIC_API_BASE_URL=http://127.0.0.1:8000
FRONTEND_URL=http://127.0.0.1:5173
```

For production, use public HTTPS URLs for the callback, API, and frontend, and set:

```env
COOKIE_SECURE=true
```

Email/password authentication remains available without Google OAuth credentials.

## Manual Backend Setup (Without Docker)

Create a Python 3.11+ virtual environment and install the backend requirements:

```bash
pip install -r backend/requirements.txt
```

Configure the environment:

```env
DATABASE_URL=sqlite:///./northstar.db
SEED_DEMO_DATA=true
```

Run database migrations:

```bash
alembic -c backend/alembic.ini upgrade head
```

Start the backend:

```bash
uvicorn app.main:app --reload --app-dir backend
```

Start the frontend separately in another terminal using the project's frontend development setup.

SQLite tables are also created automatically for local and test convenience.

## Machine Learning & Forecasting

Velaire includes model comparison and inventory forecasting capabilities.

**Important:** The starter model fixture uses synthetic data. Its evaluation metrics are intended for demonstration purposes only and must not be presented as real-world retail validation.

For meaningful model evaluation:

- Replace synthetic data with a documented and appropriately licensed dataset.
- Compare candidate models using the same time-based holdout.
- Document evaluation methodology and limitations.
- Report model performance transparently.

## Project Documentation

Explore the following documentation for more technical details:

- [System Architecture](docs/ARCHITECTURE.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Reusable Master Prompt](docs/MASTER_PROMPT.md)

## Current Limitations

- Machine-learning evaluation currently uses synthetic starter data.
- The task assistant uses rule-based logic and permission checks; no external LLM dependency is included.
- Payment-card processing is not implemented.
- The system does not provide accounting or tax advice.
- Production multi-tenant isolation has not been established.
- A public deployment has not yet been configured.

## Production Deployment Considerations

Compose provides the deployment-ready starting point. Before using Velaire in a real business environment:

- Provision hosting for the frontend, API, and persistent PostgreSQL database.
- Configure production URLs and strong application secrets.
- Enable TLS and restricted CORS.
- Configure database migrations and backups.
- Set up application logs and monitoring alerts.
- Implement appropriate rate limits.
- Perform a database recovery test.
- Disable demo seeding using:

```env
SEED_DEMO_DATA=false
```

**Never enable development demo credentials or demo seeding in a public production deployment.**

---

## License

Add your chosen open-source license before distributing or publishing the project for reuse.
