import pytest
from fastapi.testclient import TestClient

from app import main as main_module
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def sign_in(client: TestClient, email: str) -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": "Demo123!"})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_checkout_is_atomic_idempotent_and_auditable(client: TestClient):
    token = sign_in(client, "manager@example.com")
    headers = {"Authorization": f"Bearer {token}", "Idempotency-Key": "checkout-vertical-slice-1"}
    products = client.get("/api/products", headers=headers)
    assert products.status_code == 200
    greens = next(product for product in products.json() if product["sku"] == "PRD-001")
    original_stock = greens["current_stock"]

    checkout = {"items": [{"product_id": greens["id"], "quantity": 2}], "tax_rate": 5, "discount_percent": 10, "payment_mode": "card"}
    sale = client.post("/api/invoices", json=checkout, headers=headers)
    assert sale.status_code == 201
    invoice = sale.json()
    assert invoice["items"][0]["unit_cost"] == "4.10"
    assert invoice["items"][0]["quantity"] == 2
    assert float(invoice["total"]) > float(invoice["subtotal"]) - float(invoice["discount"])

    replay = client.post("/api/invoices", json=checkout, headers=headers)
    assert replay.status_code == 201
    assert replay.json()["invoice_number"] == invoice["invoice_number"]
    updated = client.get(f"/api/products?search={greens['sku']}", headers=headers).json()[0]
    assert updated["current_stock"] == original_stock - 2

    invalid_sale = client.post("/api/invoices", json={"items": [{"product_id": greens["id"], "quantity": 100000}]}, headers={"Authorization": f"Bearer {token}"})
    assert invalid_sale.status_code == 409
    after_failure = client.get(f"/api/products?search={greens['sku']}", headers=headers).json()[0]
    assert after_failure["current_stock"] == original_stock - 2
    invoices = client.get("/api/invoices?limit=100", headers=headers).json()
    assert sum(item["invoice_number"] == invoice["invoice_number"] for item in invoices) == 1

    movements = client.get("/api/stock-movements?limit=100", headers=headers).json()
    sale_movements = [movement for movement in movements if movement.get("note") == f"Invoice {invoice['invoice_number']}"]
    assert len(sale_movements) == 1
    assert sale_movements[0]["quantity_change"] == -2


def test_role_boundaries_assistant_and_model_metrics(client: TestClient):
    manager_token = sign_in(client, "manager@example.com")
    cashier_token = sign_in(client, "cashier@example.com")
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    cashier_headers = {"Authorization": f"Bearer {cashier_token}"}

    product = next(item for item in client.get("/api/products", headers=manager_headers).json() if item["sku"] == "PRD-002")
    denied = client.post(
        f"/api/products/{product['id']}/stock-adjustments",
        json={"quantity_change": 4, "reason": "restock"},
        headers=cashier_headers,
    )
    assert denied.status_code == 403

    answer = client.post("/api/assistant", json={"message": "stock for Sourdough loaf"}, headers=manager_headers)
    assert answer.status_code == 200
    assert "Sourdough loaf" in answer.json()["reply"]
    restock = client.post("/api/assistant", json={"message": "restock Sourdough loaf by 4 units"}, headers=manager_headers)
    assert restock.status_code == 200
    assert restock.json()["action"]["type"] == "restock"

    evaluation = client.get("/api/predictions/evaluation", headers=manager_headers)
    assert evaluation.status_code == 200
    report = evaluation.json()
    assert len(report["profit_comparison"]) == 3
    assert {"rmse", "mae", "r2"} <= report["profit_comparison"][0].keys()
    assert report["demand_holdout_rows"] == 480
    demand_models = {model["model"]: model for model in report["demand_comparison"]}
    assert demand_models["Random Forest"]["rmse"] < demand_models["7-day velocity baseline"]["rmse"]
    assert "synthetic" in report["caveat"].lower()

    forecast = client.get("/api/predictions?horizon_days=14", headers=manager_headers)
    assert forecast.status_code == 200
    forecast_data = forecast.json()
    assert forecast_data["horizon_days"] == 14
    assert len(forecast_data["products"]) == 10
    assert forecast_data["total_predicted_demand"] > 0


def test_private_routes_require_authentication(client: TestClient):
    response = client.get("/api/products")
    assert response.status_code == 401
    invalid_token = client.get("/api/products", headers={"Authorization": "Bearer invalid.token.value"})
    assert invalid_token.status_code == 401


def test_signup_role_gate_and_google_provider_status(client: TestClient, monkeypatch):
    admin_signup = client.post("/api/auth/signup", json={
        "name": "Uninvited Admin",
        "email": "uninvited@example.com",
        "password": "StrongPass123!",
        "account_type": "admin",
    })
    assert admin_signup.status_code == 403
    monkeypatch.setenv("ADMIN_SIGNUP_CODE", "legacy-shared-code")
    legacy_code_signup = client.post("/api/auth/signup", json={
        "name": "Legacy Code Admin",
        "email": "legacy.code@example.com",
        "password": "StrongPass123!",
        "account_type": "admin",
        "invitation_code": "legacy-shared-code",
    })
    assert legacy_code_signup.status_code == 403

    manager_token = sign_in(client, "manager@example.com")
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    cashier_token = sign_in(client, "cashier@example.com")
    cashier_headers = {"Authorization": f"Bearer {cashier_token}"}
    denied_invitation = client.post(
        "/api/admin/invitations",
        json={"email": "denied.invite@example.com", "role": "admin"},
        headers=cashier_headers,
    )
    assert denied_invitation.status_code == 403

    user_signup = client.post("/api/auth/signup", json={
        "name": "New Cashier",
        "email": "new.cashier@example.com",
        "password": "StrongPass123!",
    })
    assert user_signup.status_code == 201
    assert user_signup.json()["user"]["role"] == "cashier"
    assert client.get("/api/auth/me", headers={
        "Authorization": f"Bearer {user_signup.json()['access_token']}"
    }).json()["email"] == "new.cashier@example.com"

    invitation = client.post(
        "/api/admin/invitations",
        json={"email": "workspace.admin@example.com", "role": "admin"},
        headers=manager_headers,
    )
    assert invitation.status_code == 201
    invitation_data = invitation.json()
    assert invitation_data["email"] == "workspace.admin@example.com"
    assert invitation_data["role"] == "admin"
    assert len(invitation_data["code"]) == 46

    invitations = client.get("/api/admin/invitations", headers=manager_headers)
    assert invitations.status_code == 200
    assert invitation_data["code"] not in str(invitations.json())

    wrong_email = client.post("/api/auth/signup", json={
        "name": "Wrong Recipient",
        "email": "different.email@example.com",
        "password": "StrongPass123!",
        "account_type": "admin",
        "invitation_code": invitation_data["code"],
    })
    assert wrong_email.status_code == 403

    invited_admin = client.post("/api/auth/signup", json={
        "name": "Workspace Admin",
        "email": "workspace.admin@example.com",
        "password": "StrongPass123!",
        "account_type": "admin",
        "invitation_code": invitation_data["code"],
    })
    assert invited_admin.status_code == 201
    assert invited_admin.json()["user"]["role"] == "admin"

    reused_invitation = client.post("/api/auth/signup", json={
        "name": "Invitation Reuse",
        "email": "workspace.admin@example.com",
        "password": "StrongPass123!",
        "account_type": "admin",
        "invitation_code": invitation_data["code"],
    })
    assert reused_invitation.status_code == 403

    cashier_invitation = client.post(
        "/api/admin/invitations",
        json={"email": "invited.cashier@example.com", "role": "cashier"},
        headers=manager_headers,
    )
    assert cashier_invitation.status_code == 201
    wrong_role = client.post("/api/auth/signup", json={
        "name": "Wrong Role",
        "email": "invited.cashier@example.com",
        "password": "StrongPass123!",
        "account_type": "admin",
        "invitation_code": cashier_invitation.json()["code"],
    })
    assert wrong_role.status_code == 403
    invited_cashier = client.post("/api/auth/signup", json={
        "name": "Invited Cashier",
        "email": "invited.cashier@example.com",
        "password": "StrongPass123!",
        "invitation_code": cashier_invitation.json()["code"],
    })
    assert invited_cashier.status_code == 201
    assert invited_cashier.json()["user"]["role"] == "cashier"

    duplicate = client.post("/api/auth/signup", json={
        "name": "Duplicate",
        "email": "new.cashier@example.com",
        "password": "StrongPass123!",
    })
    assert duplicate.status_code == 409

    providers = client.get("/api/auth/providers")
    assert providers.status_code == 200
    assert providers.json()["email_password"] is True
    assert isinstance(providers.json()["google"], bool)
    if not main_module.GOOGLE_OAUTH_ENABLED:
        google_start = client.get("/api/auth/oauth/google/start", follow_redirects=False)
        assert google_start.status_code == 503
    assert client.post("/api/auth/oauth/session").status_code == 401
