# Implementation Plan

This plan maps the supplied 14-week roadmap into buildable increments while keeping its scope lock and integration milestones intact.

## Scope and Components

### Core release
- Smart billing/POS with product lookup, quantity cart, validated discounts/tax, payment mode, printable receipt, and immutable invoice item snapshots.
- Inventory catalog and suppliers; stock adjustments/restocks with reasons; movement ledger; low-stock thresholds and alerts.
- Operations dashboard with revenue, gross profit, stock value, turnover proxy, sales trends, category mix, top products, and recent invoices.
- Python intelligence: Random Forest demand/reorder predictions, product and period profit forecasts, Linear Regression/Random Forest/Gradient Boosting comparison, naive velocity baseline, reproducible holdout metrics, and feature importance.
- FAQ/task assistant: current stock, low-stock products, sales summaries, billing help, and explicit, permission-checked restock commands with an audit trail.
- JWT authentication and server-enforced admin/manager/cashier roles.
- PostgreSQL schema with Alembic migrations, local SQLite developer fallback, API documentation, container build, opt-in seed data, tests, setup/report documentation, master agent prompt.

### Stretch work (after the end-to-end slice)
- Barcode/QR hardware scanning, customer loyalty and recommendations, outbound email, Prophet/ARIMA or LSTM, SHAP, multi-store SaaS tenancy, payment provider integration, advanced anomaly detection, scheduled retraining, and managed cloud deployment.
- Never imply a forecast or generated demo dataset is validated against a real retail dataset. Import a licensed, documented dataset and evaluate it separately before making accuracy claims.

## Architecture Decisions

Use React + TypeScript and Recharts for the web client, FastAPI/Python for domain APIs and scikit-learn, SQLAlchemy with PostgreSQL and Alembic migrations for persistence, and Docker Compose for repeatable deployment. This preserves the roadmap's single-language backend/ML workflow. SQLite is only a convenience for local development; PostgreSQL is the acceptance environment for locking and deployment. Authentication is signed, expiring JWT with server-side role checks. The assistant is deterministic/intent-based by design, so it can safely report live inventory without inventing records and does not require an LLM key.

## Delivery Sequence and Acceptance Checks

1. **Scope and contracts:** finalize one-store retail demo; publish architecture and entities; define validation and permission rules. Check: API schemas and data model align before UI integration.
2. **Foundation:** create frontend, FastAPI service, PostgreSQL/SQLite configuration, seed fixtures, auth, role checks, API docs, and health endpoint. Check: seeded login and unauthorized/forbidden requests behave as expected.
3. **Catalog and stock:** product/supplier management, low-stock views, adjustment/restock service, movement audit. Check: every stock edit has a reason, actor, and signed quantity.
4. **Billing vertical slice:** POS cart, discount/tax logic, receipt, invoice and item snapshots, atomic stock deduction. Check: successful sale reduces inventory once; insufficient stock or invalid discount leaves no invoice and no movement.
5. **BI/dashboard:** derive KPI cards, time series, category breakdown, recent sales from persisted business records, with manager/admin/cashier views. Check: a new sale is visible on refresh without manual database edits.
6. **ML and assistant:** deterministic synthetic training fixture, temporal holdout comparison, reorder/profit predictions, feature signals, persisted model version and evaluation, grounded question/task intents. Check: metrics are reproducible; every generated answer cites live database state; unauthorized restock is refused.
7. **Quality and operations:** API tests, frontend production build, responsive interaction checks, environment template, Docker Compose, production limitations and master prompt. Check: clean setup instructions work, health endpoints pass, and no test or docs claim model accuracy on synthetic data as a real-world result.
8. **Cloud deployment (credentials required):** provision managed database, deploy API and frontend, set secrets/origins, run migrations, health-check, smoke-test, and prepare local/pre-recorded backup. Check: public URL, TLS, restore strategy, and permission matrix are verified.

## Risks and Controls

- **Stock/invoice divergence:** single transaction, stock locks, rollback tests, idempotency key for client retries before production.
- **Cold start or misleading ML metrics:** label fixture as synthetic, use same held-out split for comparisons, report baseline, preserve evaluation inputs, and replace with licensed real data.
- **Assistant overreach:** intent allowlist, existing role checks, explicit numeric/name parsing, no arbitrary SQL or free-form execution, audit successful stock changes.
- **Sensitive data:** no card data, use synthetic customer details, store minimal PII, add retention/consent/access policy before use.
- **Deployment and secrets:** local Compose first; external deployment needs user-owned hosting accounts, a strong secret, CORS configuration, TLS, backups, and migrations.

## Roadmap Alignment

Weeks 1-2 scope, schema, API contracts, and wireframes map to architecture/contracts. Weeks 3-6 auth, catalog, stock, billing, and the first atomic sale slice map to backend and transaction work. Week 7 maps to role-aware analytics. Weeks 8-11 map to data pipeline, forecasting, evaluation, and dashboard integration. Weeks 12-14 map to integration tests, documentation, report, demo backup, and review. Optional recommendations and camera scanning remain deferred as the source roadmap advises.
