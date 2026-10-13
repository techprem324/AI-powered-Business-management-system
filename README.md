# Velaire Commerce System

Velaire is a retail operations system connecting checkout, inventory movements, analytics, explainable machine-learning forecasts, and a grounded task assistant.

## Run locally on Windows

Install Node.js 20+ and Python 3.11+ once. From the repository folder, run:

```powershell
.\start-local.ps1
```

On first run the script creates a backend virtual environment and installs any missing frontend dependencies. It starts the API with a local SQLite database and demo data, starts the frontend, waits for both services, and opens the app in your browser. Subsequent runs reuse the installed dependencies and existing local database.

- App: `http://127.0.0.1:5174`
- API docs: `http://127.0.0.1:8000/docs`
- Demo login: `manager@example.com` / `Demo123!`
- Stop the local services: `.\stop-local.ps1`

Local logs and process IDs are stored in the ignored `.local` directory. The local SQLite database is `backend/velaire-local.db`. For the Docker/PostgreSQL setup, use `docker compose up --build -d` after configuring `.env`.

Demo account when demo seeding is enabled: `manager@example.com` / `Demo123!` (development seed only; keep `SEED_DEMO_DATA=false` in a public deployment). The sign-in form does not prefill demo credentials.

## Account setup

Email signup creates a cashier account. Admin signup requires the server-only `ADMIN_SIGNUP_CODE`; never put this value in frontend code. To enable Google sign-in, create a Google OAuth client, add the callback URL from `GOOGLE_REDIRECT_URI` as an authorized redirect URI, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The Compose example uses `http://localhost:8080/api/auth/oauth/google/callback`. For direct local development, use `http://127.0.0.1:8000/api/auth/oauth/google/callback`, `PUBLIC_API_BASE_URL=http://127.0.0.1:8000`, and `FRONTEND_URL=http://127.0.0.1:5173`. In production, use public HTTPS URLs for the callback/API/frontend and set `COOKIE_SECURE=true`. Email/password sign-in remains available without Google credentials.

Without Docker, create a Python 3.11+ virtual environment, install `backend/requirements.txt`, set `DATABASE_URL=sqlite:///./northstar.db` and `SEED_DEMO_DATA=true`, then run `alembic -c backend/alembic.ini upgrade head` followed by `uvicorn app.main:app --reload --app-dir backend`. SQLite tables are also created automatically for local/test convenience. Start the frontend in a second terminal as above.

## What is implemented

- Role-aware sign-in and dashboard; product, supplier, stock and invoice API; atomic checkout and movement ledger; seeded synthetic demo history; model comparison and forecasts; inventory FAQ/task assistant; responsive POS, operations dashboard, inventory, and forecast views.
- PostgreSQL Compose setup with SQLite local fallback; React production container and API proxy; architecture and implementation plan; master agent prompt.

## Important limitations

The starter model fixture is synthetic. Its metrics are for demonstration and must not be presented as real retail validation. Replace it with a documented, licensed dataset, compare candidates on the same time-based holdout, and report limitations. Assistant actions are deliberately rule-based and permission checked; there is no external LLM dependency. This demo does not process payment cards, provide accounting/tax advice, or establish production multi-tenant isolation.

A public deployment has not been configured. To publish it, provision a host for the frontend, API, and persistent PostgreSQL database, then set the production URLs and secrets described above. Compose is the deployment-ready starting point; configure TLS, strong secrets, restricted CORS, migrations, backups, logs/alerts, rate limits, and a recovery test before real use.

## Docs

- [System architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Reusable master prompt](docs/MASTER_PROMPT.md)
