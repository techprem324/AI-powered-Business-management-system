# Velaire Web Client

React and TypeScript client for Velaire Commerce System. It talks to the FastAPI service through `/api`; Vite proxies that path to `http://localhost:8000` during development, while the production Nginx container proxies it to the Compose API service.

From the repository root, install and run the development client with `npm install --prefix frontend` and `npm run dev --prefix frontend`. See the root [README](../README.md) for the complete Docker setup, auth configuration, and demo credentials.

Checks: `npm run lint --prefix frontend` and `npm run build --prefix frontend`.
