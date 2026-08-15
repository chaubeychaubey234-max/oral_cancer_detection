import os
import sys
from pathlib import Path

# Point at an isolated throwaway sqlite file BEFORE any app module is imported,
# so tests never touch your real tobaccoshield.db.
TEST_DB_PATH = Path(__file__).parent / "test_tobaccoshield.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["UPLOAD_DIR"] = str(Path(__file__).parent / "test_uploads")
os.environ["SECRET_KEY"] = "test-secret"
# Force the stubs on for deterministic, offline-friendly test runs regardless
# of whether Member B/C's real packages happen to be installed in this venv.
os.environ["USE_REAL_QUALITY_MODULE"] = "false"
os.environ["USE_REAL_RISK_MODULE"] = "false"

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient

if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

from app.main import app  # noqa: E402
from app.database import Base, engine  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()  # release the sqlite file handle - required on Windows before unlink()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest.fixture()
def client():
    return TestClient(app)


def register_and_login(client, username, password, role, full_name=None):
    client.post("/auth/register", json={
        "username": username, "password": password, "role": role, "full_name": full_name or username,
    })
    res = client.post("/auth/login", data={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture()
def health_worker_token(client):
    return register_and_login(client, "hw_test", "pass1234", "health_worker", "Test Health Worker")


@pytest.fixture()
def doctor_token(client):
    return register_and_login(client, "doc_test", "pass1234", "doctor", "Test Doctor")


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}