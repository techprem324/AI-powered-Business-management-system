import os
import secrets
from pathlib import Path

import uvicorn


backend_dir = Path(__file__).resolve().parent
os.environ.setdefault("DATABASE_URL", f"sqlite:///{(backend_dir / 'velaire-local.db').as_posix()}")
os.environ.setdefault("SECRET_KEY", secrets.token_urlsafe(48))
os.environ.setdefault("SEED_DEMO_DATA", "true")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("PUBLIC_API_BASE_URL", "http://127.0.0.1:8000")
os.environ.setdefault("FRONTEND_URL", "http://127.0.0.1:5174")
os.environ.setdefault("CORS_ORIGINS", "http://127.0.0.1:5174,http://localhost:5174")

uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
