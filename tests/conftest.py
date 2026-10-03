import os
import sys
from pathlib import Path
from tempfile import gettempdir
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]
test_database = Path(gettempdir()) / f"northstar-tests-{uuid4().hex}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{test_database.as_posix()}"
os.environ["SECRET_KEY"] = "test-only-secret-not-for-deployment"
os.environ["SEED_DEMO_DATA"] = "true"
sys.path.insert(0, str(ROOT / "backend"))
