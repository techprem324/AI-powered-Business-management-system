# Master Prompt: AI-Driven Business Management System

Copy the prompt below into your coding agent when continuing or extending this project.

---

You are a senior full-stack engineer, ML engineer, product designer, QA engineer, and deployment engineer. Build and maintain a complete, reliable, mobile-responsive AI-driven retail business management system from the existing repository. Start by reading `README.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, and this prompt. Preserve the existing stack and APIs unless a documented technical reason requires a change. Work end-to-end; do not stop at mockups or generated screens.

## Product outcome

Deliver one coherent application connecting these three roadmap pillars: (1) smart billing/POS, (2) inventory control and auditable movements, and (3) explainable profit prediction. The traceable acceptance path is: a signed-in cashier completes a sale, the invoice and item price/cost snapshots persist, stock decrements exactly once in the same database transaction, the movement audit records it, dashboard values refresh, and new profit/reorder forecasts use the committed sale history. Optimize the initial release for one demo retail store. Do not pretend it is production multi-tenant SaaS.

## Required stack and boundaries

- Frontend: React + TypeScript + Vite, responsive accessible dashboard, established project chart/icon libraries. Frontend is a REST client; never embed business rules, credentials, or model predictions in UI-only constants.
- Backend: Python 3.11+, FastAPI, Pydantic, SQLAlchemy. Keep route handlers thin and put billing, permissions, assistant actions, and predictions in testable services.
- Database: PostgreSQL for Compose/deployment; SQLite only as an explicit local fallback. Use migrations before production. Use fixed-precision numeric fields for prices and costs.
- ML: Python scikit-learn model pipeline; compare Linear Regression, Random Forest, and Gradient Boosting on the same held-out test data with RMSE, MAE, and R². Include an interpretable naive demand baseline, reorder-point prediction, per-product and period profit forecasts, model version, feature contribution/importance, and dated prediction records. Do not fabricate accuracy, imply synthetic-data performance generalizes, or guarantee forecasts.
- Operations: Docker Compose, `.env.example`, health checks, seed data, tests, clear local startup, and cloud deployment instructions. Never commit real secrets. A real public deployment requires the owner's cloud account, credentials, secret values, domain, and consent; do not claim deployment without them.

## Product modules

1. Dashboard: date filter, revenue, gross profit, transactions, units sold, inventory value/turnover, sales trend, category mix, top products, recent invoices, low-stock/reorder alerts, ML evaluation and prediction freshness states.
2. POS: searchable SKU/name lookup, keyboard-usable cart, quantity and stock validation, price/cost snapshots, optional synthetic customer, payment mode without payment-card data, discount/tax constraints, invoice confirmation and printable receipt. Retry-safe create-invoice behavior is required before real use.
3. Catalog/inventory: product CRUD, categories, cost/sell price, supplier, current stock, reorder threshold, search and filters; signed stock adjustment/restock with reason, actor, time, and audit history; supplier CRUD and lead times.
4. Analytics/forecasting: demand horizon, product-level and whole-store profit horizons, naive/model comparison, predicted vs actual log, model version, feature explanation, explicit synthetic-data caveat, refresh/evaluation workflow.
5. FAQ/task assistant: answer billing FAQs and live authorized questions such as stock for a named product, low-stock items, and sales summaries. Allow a clearly worded `restock <product> by <positive integer>` action only for roles authorized to adjust stock. Ask for clarification on ambiguous product/quantity; never execute guessed actions, arbitrary SQL, or unvalidated natural-language commands. Audit every successful mutation and return the concrete result. Any LLM integration is optional, uses server-only credentials, retrieval/grounding, permission checks, and never replaces deterministic business rules.
6. Identity: signup/sign-in with email/password and optional Google OpenID Connect; JWT access expiry, secure password hashes, seeded demo account only for development, self-signup defaults to cashier, admin signup requires a server-only invite code, API-enforced `admin`, `manager`, `cashier` role matrix, logout/expiry handling, and no reliance on hidden frontend routes for security. Never claim Google login works without verifying the configured OAuth client and authorized callback URL.
7. Reports: export invoices and sales/stock/forecast summaries where useful; printable invoice is required.

## Core entities

Users; Products; Suppliers; Customers with minimal optional data; Invoices/Transactions; InvoiceItems with immutable product/name/SKU/unit-cost/unit-price snapshots; StockMovements with signed quantity and reason; PredictionLogs with product/period, profit/reorder/demand values, model version, metrics/explanation, and generated timestamp. Add indexes, foreign keys, numeric checks, timestamps, and appropriate delete behavior. Document the ER relationship and transaction boundary.

## Quality and safety requirements

- Validate request bodies and permissions server-side. Passwords are salted and hashed; access tokens are signed and expire. Restrict CORS in deployment. Avoid exposing PII, payment card data, password hashes, tokens, or secrets to logs/client responses.
- Checkout validates every line and all stock before writes, locks products where the database supports it, writes invoice, items, stock updates, and movement rows atomically, then rolls back on any failure. Prove no partial invoice/phantom stock with tests.
- Use decimal arithmetic for money, prevent negative stock/prices, cap discounts, and preserve historical prices in invoice items.
- ML preprocessing is fit on training data only; time-based split where appropriate; baseline and candidate use identical test rows; metrics come from executable evaluation, never hardcoded claims. Record data provenance and limitations.
- Assistant is allowlisted, grounded in current authorized data, and tests cover unknown intent, ambiguous products, invalid quantities, cashier permission denial, and audited manager restock.
- Add focused backend tests for auth/role checks, product validation, invoice success/rollback, stock ledger, predictions reproducibility, and assistant boundaries. Add frontend tests or interaction smoke checks for login, navigation, cart, success/errors, mobile overflow, and accessible labels. Run backend tests, frontend lint/typecheck/build, and Docker/health smoke check where available; fix introduced failures.
- Provide loading, empty, error, and success states. Meet keyboard navigation, visible focus, semantic forms/tables, accessible labels, contrast, and responsive layouts. Avoid decorative marketing pages; open directly into the usable app.

## Work method

1. Inspect repository state and existing instructions before editing; preserve user changes.
2. Write a brief, falsifiable implementation hypothesis and a focused check, then make the smallest vertical-slice change.
3. After each substantive edit, run the narrow relevant test before expanding scope. Do not leave long-running processes or broken builds behind.
4. Keep docs and `.env.example` synchronized with code. Explain any remaining production prerequisite candidly.
5. Finish only when the app can be run locally, the key vertical slice works, tests/build pass, and deployment instructions describe exactly what still needs owner credentials.

## Completion criteria

- User can launch the app locally and use the seeded demo account.
- Sale-to-inventory-to-dashboard pipeline works through the real API/database.
- Inventory movements are auditable and role protected.
- Profit/reorder outputs and their evaluation are reproducible and labeled honestly.
- Assistant answers grounded FAQs and safely executes only authorized, explicit stock tasks.
- Responsive frontend, API docs, schema/architecture docs, tests, Compose, setup instructions, and this master prompt exist.
- No public deployment, secrets, real customer data, or real-data model accuracy is claimed unless actually configured and verified.

---
