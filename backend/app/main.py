from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import hmac
import os
import random
import re
import secrets
import uuid

from authlib.integrations.starlette_client import OAuth
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from starlette.middleware.sessions import SessionMiddleware

from . import ml
from .database import Base, SessionLocal, engine, get_db
from .models import Customer, Invitation, Invoice, InvoiceItem, PredictionLog, Product, StockMovement, Supplier, User, utcnow
from .schemas import AssistantRequest, CheckoutRequest, InvitationCreate, InvitationIssued, InvitationOut, InvoiceOut, LoginRequest, ProductCreate, ProductOut, ProductUpdate, SignupRequest, StockAdjustmentIn, SupplierCreate, SupplierOut, TokenResponse, UserOut
from .security import create_access_token, decode_access_token, get_current_user, hash_password, require_roles, verify_password


CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def product_payload(product: Product) -> dict:
    return {
        "id": product.id,
        "sku": product.sku,
        "barcode": product.barcode,
        "name": product.name,
        "category": product.category,
        "description": product.description,
        "cost_price": product.cost_price,
        "selling_price": product.selling_price,
        "current_stock": product.current_stock,
        "reorder_level": product.reorder_level,
        "supplier_id": product.supplier_id,
        "supplier_name": product.supplier.name if product.supplier else None,
    }


def invoice_payload(invoice: Invoice) -> dict:
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "customer_name": invoice.customer_name,
        "subtotal": invoice.subtotal,
        "tax_rate": invoice.tax_rate,
        "tax": invoice.tax,
        "discount_percent": invoice.discount_percent,
        "discount": invoice.discount,
        "total": invoice.total,
        "payment_mode": invoice.payment_mode,
        "status": invoice.status,
        "created_at": invoice.created_at,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "sku": item.sku,
                "quantity": item.quantity,
                "unit_cost": item.unit_cost,
                "unit_price": item.unit_price,
                "line_total": item.line_total,
                "profit": item.profit,
            }
            for item in invoice.items
        ],
    }


def seed_database() -> None:
    Base.metadata.create_all(bind=engine)
    if os.getenv("SEED_DEMO_DATA", "false").lower() != "true":
        return
    with SessionLocal.begin() as db:
        admin = db.scalar(select(User).where(User.email == "manager@example.com"))
        if admin is None:
            admin = User(name="Olivia Chen", email="manager@example.com", role="admin", password_hash=hash_password("Demo123!"))
            db.add(admin)
        cashier = db.scalar(select(User).where(User.email == "cashier@example.com"))
        if cashier is None:
            cashier = User(name="Sam Rivera", email="cashier@example.com", role="cashier", password_hash=hash_password("Demo123!"))
            db.add(cashier)
        db.flush()
        if db.scalar(select(Product.id).limit(1)):
            return

        suppliers = [
            Supplier(name="Northline Produce", contact_name="Mia Patel", email="produce@example.test", lead_time_days=2),
            Supplier(name="Harbor Wholesale", contact_name="Noah Reed", email="orders@example.test", lead_time_days=5),
            Supplier(name="Field & Foundry", contact_name="Ava Brooks", email="hello@example.test", lead_time_days=7),
        ]
        db.add_all(suppliers)
        db.flush()

        catalog = [
            ("PRD-001", "Market greens", "Produce", "4.10", "7.50", 76, 18, 0),
            ("PRD-002", "Sourdough loaf", "Bakery", "3.25", "6.25", 34, 12, 2),
            ("PRD-003", "Cold brew concentrate", "Beverages", "5.80", "11.00", 49, 14, 1),
            ("PRD-004", "Olive oil, 500 ml", "Pantry", "9.40", "16.90", 21, 16, 1),
            ("PRD-005", "Ceramic pour-over", "Home goods", "11.20", "24.00", 12, 8, 2),
            ("PRD-006", "Citrus tonic, 4-pack", "Beverages", "4.60", "9.50", 58, 16, 1),
            ("PRD-007", "Stone-ground oats", "Pantry", "2.85", "5.40", 83, 20, 0),
            ("PRD-008", "Seasonal flowers", "Produce", "6.20", "12.50", 9, 12, 0),
            ("PRD-009", "Linen market tote", "Home goods", "7.10", "15.00", 26, 10, 2),
            ("PRD-010", "Dark chocolate bar", "Pantry", "2.20", "4.75", 67, 18, 1),
        ]
        products = [
            Product(sku=sku, name=name, category=category, cost_price=Decimal(cost), selling_price=Decimal(price),
                    current_stock=stock, reorder_level=reorder, supplier_id=suppliers[supplier].id)
            for sku, name, category, cost, price, stock, reorder, supplier in catalog
        ]
        db.add_all(products)
        db.flush()

        rng = random.Random(9)
        base_time = utcnow()
        for sale_index in range(42):
            selected = rng.sample(products, rng.randint(1, 3))
            invoice_items = []
            subtotal = Decimal("0")
            for product in selected:
                quantity = rng.randint(1, 3)
                if product.current_stock < quantity:
                    continue
                product.current_stock -= quantity
                line_total = money(product.selling_price * quantity)
                profit = money((product.selling_price - product.cost_price) * quantity)
                subtotal += line_total
                invoice_items.append(InvoiceItem(
                    product=product,
                    product_name=product.name,
                    sku=product.sku,
                    quantity=quantity,
                    unit_cost=product.cost_price,
                    unit_price=product.selling_price,
                    line_total=line_total,
                    profit=profit,
                ))
            if not invoice_items:
                continue
            invoice = Invoice(
                invoice_number=f"NS-{(base_time - timedelta(days=sale_index % 30)).strftime('%y%m%d')}-{sale_index + 1:04d}",
                cashier_id=cashier.id,
                subtotal=money(subtotal),
                tax_rate=Decimal("0"),
                tax=Decimal("0"),
                discount_percent=Decimal("0"),
                discount=Decimal("0"),
                total=money(subtotal),
                payment_mode=rng.choice(["card", "cash", "bank_transfer"]),
                created_at=base_time - timedelta(days=sale_index % 30, hours=rng.randint(0, 11)),
                items=invoice_items,
            )
            db.add(invoice)
            db.flush()
            for item in invoice_items:
                db.add(StockMovement(
                    product_id=item.product_id,
                    quantity_change=-item.quantity,
                    reason="sale",
                    note=f"Seed demo sale {invoice.invoice_number}",
                    invoice_id=invoice.id,
                    actor_id=cashier.id,
                    created_at=invoice.created_at,
                ))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    seed_database()
    yield


app = FastAPI(
    title="Velaire Commerce System API",
    version="1.0.0",
    description="Retail billing, inventory, analytics, and explainable ML API.",
    lifespan=lifespan,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", "local-demo-secret-change-before-deploying"),
    max_age=600,
    same_site="lax",
    https_only=os.getenv("COOKIE_SECURE", "false").lower() == "true",
)

oauth = OAuth()
GOOGLE_OAUTH_ENABLED = bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))
if GOOGLE_OAUTH_ENABLED:
    oauth.register(
        name="google",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "velaire-api"}


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect")
    return {"access_token": create_access_token(user), "user": user}


@app.get("/api/auth/providers")
def auth_providers():
    return {"email_password": True, "google": GOOGLE_OAUTH_ENABLED}


@app.get("/api/admin/invitations", response_model=list[InvitationOut])
def list_invitations(
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Invitation).order_by(Invitation.created_at.desc()).limit(50)).all()


@app.post("/api/admin/invitations", response_model=InvitationIssued, status_code=status.HTTP_201_CREATED)
def create_invitation(
    payload: InvitationCreate,
    admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    normalized_email = str(payload.email).strip().lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == normalized_email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    code = f"VL-{secrets.token_urlsafe(32)}"
    invitation = Invitation(
        email=normalized_email,
        role=payload.role,
        code_hash=hashlib.sha256(code.encode()).hexdigest(),
        created_by=admin.id,
        expires_at=utcnow() + timedelta(days=7),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return {**InvitationOut.model_validate(invitation).model_dump(), "code": code}


@app.post("/api/auth/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    normalized_email = str(payload.email).strip().lower()

    role = "admin" if payload.account_type == "admin" else "cashier"
    invitation = None
    if payload.account_type == "admin" and not payload.invitation_code:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A valid admin invitation is required")
    if payload.invitation_code:
        code_hash = hashlib.sha256(payload.invitation_code.encode()).hexdigest()
        invitation = db.scalar(select(Invitation).where(Invitation.code_hash == code_hash))
        if (
            invitation is None
            or not hmac.compare_digest(invitation.code_hash, code_hash)
            or invitation.email != normalized_email
            or invitation.role != role
            or invitation.used_at is not None
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invitation is invalid, expired, already used, or issued for another email or role",
            )

    user = User(name=payload.name.strip(), email=normalized_email, role=role, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        if invitation is not None:
            used_at = utcnow()
            result = db.execute(
                update(Invitation)
                .where(
                    Invitation.id == invitation.id,
                    Invitation.used_at.is_(None),
                    Invitation.expires_at > used_at,
                    Invitation.email == normalized_email,
                    Invitation.role == role,
                )
                .values(used_at=used_at)
                .execution_options(synchronize_session=False)
            )
            if result.rowcount != 1:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This invitation has expired or has already been used",
                )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists") from exc
    db.refresh(user)
    return {"access_token": create_access_token(user), "user": user}


@app.get("/api/auth/oauth/google/start")
async def google_oauth_start(request: Request):
    if not GOOGLE_OAUTH_ENABLED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    if not redirect_uri:
        api_base = os.getenv("PUBLIC_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
        redirect_uri = f"{api_base}/api/auth/oauth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@app.get("/api/auth/oauth/google/callback")
async def google_oauth_callback(request: Request, db: Session = Depends(get_db)):
    if not GOOGLE_OAUTH_ENABLED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured")
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo") or await oauth.google.userinfo(token=token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google sign-in could not be verified") from exc

    email = str(user_info.get("email", "")).strip().lower()
    verified = user_info.get("email_verified") is True or str(user_info.get("email_verified", "")).lower() == "true"
    if not email or not verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Google must provide a verified email address")

    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None:
        display_name = str(user_info.get("name") or email.split("@", 1)[0]).strip()[:120]
        user = User(name=display_name, email=email, role="cashier", password_hash=hash_password(secrets.token_urlsafe(48)))
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(func.lower(User.email) == email))
            if user is None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not create the Google account")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is unavailable")

    frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")
    response = RedirectResponse(url=f"{frontend_url}/?oauth=google", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        "northstar.oauth",
        create_access_token(user),
        max_age=90,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        path="/api/auth/oauth/session",
    )
    return response


@app.post("/api/auth/oauth/session", response_model=TokenResponse)
def complete_google_oauth(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("northstar.oauth")
    response.delete_cookie("northstar.oauth", path="/api/auth/oauth/session", httponly=True, samesite="lax")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google sign-in session expired; try again")
    payload = decode_access_token(token)
    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account is unavailable")
    db.commit()
    return {"access_token": token, "user": user}


@app.get("/api/auth/me", response_model=UserOut)
def current_user_profile(user: User = Depends(get_current_user)):
    return user


@app.get("/api/products", response_model=list[ProductOut])
def list_products(
    search: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None, max_length=100),
    low_stock: bool = False,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = select(Product).options(selectinload(Product.supplier)).order_by(Product.name)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where((Product.name.ilike(pattern)) | (Product.sku.ilike(pattern)) | (Product.barcode.ilike(pattern)))
    if category:
        query = query.where(Product.category == category)
    if low_stock:
        query = query.where(Product.current_stock <= Product.reorder_level)
    return [product_payload(product) for product in db.scalars(query).all()]


@app.post("/api/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "manager")),
):
    product = Product(**payload.model_dump())
    try:
        db.add(product)
        db.flush()
        if product.current_stock:
            db.add(StockMovement(product_id=product.id, quantity_change=product.current_stock, reason="restock",
                                 note="Opening stock", actor_id=user.id))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A product with this SKU or barcode already exists") from exc
    db.refresh(product)
    return product_payload(product)


@app.patch("/api/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin", "manager")),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A product with this SKU or barcode already exists") from exc
    db.refresh(product)
    return product_payload(product)


@app.post("/api/products/{product_id}/stock-adjustments", status_code=status.HTTP_201_CREATED)
def adjust_stock(
    product_id: int,
    payload: StockAdjustmentIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "manager")),
):
    product = db.scalar(select(Product).where(Product.id == product_id).with_for_update())
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    updated_stock = product.current_stock + payload.quantity_change
    if updated_stock < 0:
        raise HTTPException(status_code=409, detail="Adjustment would make stock negative")
    product.current_stock = updated_stock
    movement = StockMovement(product_id=product.id, quantity_change=payload.quantity_change, reason=payload.reason,
                             note=payload.note, actor_id=user.id)
    db.add(movement)
    db.commit()
    return {"product_id": product.id, "current_stock": product.current_stock, "movement_id": movement.id}


@app.get("/api/suppliers", response_model=list[SupplierOut])
def list_suppliers(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return db.scalars(select(Supplier).order_by(Supplier.name)).all()


@app.post("/api/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin", "manager")),
):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Supplier name already exists") from exc
    db.refresh(supplier)
    return supplier


@app.post("/api/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=80),
):
    if idempotency_key:
        existing = db.scalar(select(Invoice).options(selectinload(Invoice.items)).where(Invoice.idempotency_key == idempotency_key))
        if existing:
            return invoice_payload(existing)

    quantities = Counter()
    for line in payload.items:
        quantities[line.product_id] += line.quantity
    if any(quantity > 100_000 for quantity in quantities.values()):
        raise HTTPException(status_code=422, detail="Requested quantity exceeds the supported limit")

    try:
        products = db.scalars(
            select(Product).where(Product.id.in_(quantities.keys())).with_for_update()
        ).all()
        by_id = {product.id: product for product in products}
        missing = set(quantities) - set(by_id)
        if missing:
            raise HTTPException(status_code=404, detail=f"Product not found: {min(missing)}")
        for product_id, quantity in quantities.items():
            if by_id[product_id].current_stock < quantity:
                raise HTTPException(status_code=409, detail=f"Insufficient stock for {by_id[product_id].name}")

        subtotal = money(sum((by_id[product_id].selling_price * quantity for product_id, quantity in quantities.items()), Decimal("0")))
        discount = money(subtotal * payload.discount_percent / Decimal("100"))
        taxable = subtotal - discount
        tax = money(taxable * payload.tax_rate / Decimal("100"))
        total = money(taxable + tax)
        now = utcnow()
        invoice = Invoice(
            invoice_number=f"NS-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
            idempotency_key=idempotency_key,
            cashier_id=user.id,
            customer_name=payload.customer_name,
            subtotal=subtotal,
            tax_rate=payload.tax_rate,
            tax=tax,
            discount_percent=payload.discount_percent,
            discount=discount,
            total=total,
            payment_mode=payload.payment_mode,
        )
        db.add(invoice)
        db.flush()

        for product_id, quantity in quantities.items():
            product = by_id[product_id]
            line_total = money(product.selling_price * quantity)
            discount_share = money(discount * line_total / subtotal) if subtotal else Decimal("0")
            profit = money((product.selling_price - product.cost_price) * quantity - discount_share)
            db.add(InvoiceItem(
                invoice_id=invoice.id,
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                quantity=quantity,
                unit_cost=product.cost_price,
                unit_price=product.selling_price,
                line_total=line_total,
                profit=profit,
            ))
            product.current_stock -= quantity
            db.add(StockMovement(product_id=product.id, quantity_change=-quantity, reason="sale",
                                 note=f"Invoice {invoice.invoice_number}", invoice_id=invoice.id, actor_id=user.id))
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Checkout conflicted with another update; review stock and retry") from exc
    except Exception:
        db.rollback()
        raise

    db.refresh(invoice)
    return invoice_payload(invoice)


@app.get("/api/invoices", response_model=list[InvoiceOut])
def list_invoices(
    limit: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    invoices = db.scalars(select(Invoice).options(selectinload(Invoice.items)).order_by(Invoice.created_at.desc()).limit(limit)).all()
    return [invoice_payload(invoice) for invoice in invoices]


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    now = utcnow()
    start = now - timedelta(days=30)
    invoices = db.scalars(
        select(Invoice).options(selectinload(Invoice.items)).where(Invoice.created_at >= start).order_by(Invoice.created_at.desc())
    ).all()
    products = db.scalars(select(Product).options(selectinload(Product.supplier))).all()
    revenue = sum((invoice.total for invoice in invoices), Decimal("0"))
    gross_profit = sum((item.profit for invoice in invoices for item in invoice.items), Decimal("0"))
    units_sold = sum(item.quantity for invoice in invoices for item in invoice.items)
    stock_value = sum((product.cost_price * product.current_stock for product in products), Decimal("0"))
    low_stock = [product for product in products if product.current_stock <= product.reorder_level]

    daily = defaultdict(lambda: {"sales": Decimal("0"), "orders": 0})
    for offset in range(6, -1, -1):
        date_key = (now.date() - timedelta(days=offset)).isoformat()
        daily[date_key]
    for invoice in invoices:
        date_key = invoice.created_at.date().isoformat()
        if date_key in daily:
            daily[date_key]["sales"] += invoice.total
            daily[date_key]["orders"] += 1

    category_mix = defaultdict(lambda: Decimal("0"))
    top_products = defaultdict(lambda: {"units": 0, "sales": Decimal("0"), "profit": Decimal("0")})
    for invoice in invoices:
        for item in invoice.items:
            category = item.product.category if item.product else "Archived"
            category_mix[category] += item.line_total
            top_products[item.product_name]["units"] += item.quantity
            top_products[item.product_name]["sales"] += item.line_total
            top_products[item.product_name]["profit"] += item.profit

    return {
        "period_days": 30,
        "kpis": {
            "revenue": money(revenue),
            "gross_profit": money(gross_profit),
            "transactions": len(invoices),
            "units_sold": units_sold,
            "inventory_value": money(stock_value),
            "low_stock_count": len(low_stock),
            "gross_margin_percent": round(float(gross_profit / revenue * 100), 1) if revenue else 0,
        },
        "sales_trend": [{"date": key, "sales": money(value["sales"]), "orders": value["orders"]} for key, value in sorted(daily.items())],
        "category_mix": [{"category": category, "sales": money(total)} for category, total in sorted(category_mix.items(), key=lambda item: item[1], reverse=True)],
        "top_products": [
            {"name": name, **values}
            for name, values in sorted(top_products.items(), key=lambda item: item[1]["sales"], reverse=True)[:5]
        ],
        "low_stock": [product_payload(product) for product in sorted(low_stock, key=lambda item: item.current_stock / max(item.reorder_level, 1))[:6]],
        "recent_invoices": [invoice_payload(invoice) for invoice in invoices[:6]],
    }


@app.get("/api/predictions")
def predictions(
    horizon_days: int = Query(default=7, ge=7, le=30),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if horizon_days not in (7, 14, 30):
        raise HTTPException(status_code=422, detail="Forecast horizon must be 7, 14, or 30 days")
    products = db.scalars(select(Product).options(selectinload(Product.supplier)).order_by(Product.name)).all()
    start = utcnow() - timedelta(days=30)
    recent_invoices = db.scalars(
        select(Invoice).options(selectinload(Invoice.items)).where(Invoice.created_at >= start)
    ).all()
    sold = Counter()
    for invoice in recent_invoices:
        for item in invoice.items:
            if item.product_id is not None:
                sold[item.product_id] += item.quantity

    categories = sorted({product.category for product in products})
    forecast_rows = []
    for product in products:
        velocity = max(sold[product.id] / 30, 0.1)
        lead_time = product.supplier.lead_time_days if product.supplier else 5
        category_index = categories.index(product.category) % 7
        discount_rate = 0.0
        result = ml.predict_product(
            unit_margin=float(product.selling_price - product.cost_price),
            discount_rate=discount_rate,
            stock_units=product.current_stock,
            velocity_per_day=velocity,
            lead_time_days=lead_time,
            seasonality=1.0,
            category_index=category_index,
        )
        predicted_profit = money(Decimal(str(result["predicted_profit"])) * Decimal(horizon_days) / Decimal("7"))
        predicted_demand = money(Decimal(str(result["predicted_demand_week"])) * Decimal(horizon_days) / Decimal("7"))
        row = {
            "product_id": product.id,
            "name": product.name,
            "category": product.category,
            "sku": product.sku,
            "current_stock": product.current_stock,
            "daily_velocity": round(velocity, 2),
            "horizon_days": horizon_days,
            "predicted_demand": predicted_demand,
            "predicted_profit": predicted_profit,
            "predicted_reorder_point": result["predicted_reorder_point"],
            "days_until_stockout": round(product.current_stock / velocity, 1) if velocity else None,
            "status": "reorder" if product.current_stock <= result["predicted_reorder_point"] else "healthy",
            "drivers": ["Recent sales velocity", "Unit margin", f"Supplier lead time ({lead_time} days)"],
            "model_version": result["model_version"],
        }
        forecast_rows.append(row)
        db.add(PredictionLog(
            product_id=product.id,
            horizon_days=horizon_days,
            predicted_profit=predicted_profit,
            predicted_reorder_point=result["predicted_reorder_point"],
            predicted_demand=predicted_demand,
            model_version=result["model_version"],
            metrics={"data_source": "synthetic training fixture"},
            explanation={"drivers": row["drivers"]},
        ))
    db.commit()
    total_profit = money(sum((row["predicted_profit"] for row in forecast_rows), Decimal("0")))
    total_demand = money(sum((row["predicted_demand"] for row in forecast_rows), Decimal("0")))
    return {
        "horizon_days": horizon_days,
        "generated_at": utcnow(),
        "model_version": ml.MODEL_VERSION,
        "data_source": "Deterministic synthetic retail training fixture",
        "total_predicted_profit": total_profit,
        "total_predicted_demand": total_demand,
        "products": sorted(forecast_rows, key=lambda row: row["predicted_profit"], reverse=True),
        "evaluation": ml.evaluation_report(),
        "caveat": "Synthetic training metrics are for demonstration only and do not establish real-world accuracy.",
    }


@app.get("/api/predictions/evaluation")
def prediction_evaluation(_user: User = Depends(get_current_user)):
    return ml.evaluation_report()


@app.get("/api/stock-movements")
def stock_movements(
    limit: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    movements = db.scalars(
        select(StockMovement).options(selectinload(StockMovement.product)).order_by(StockMovement.created_at.desc()).limit(limit)
    ).all()
    return [
        {"id": movement.id, "product_id": movement.product_id, "product_name": movement.product.name,
         "sku": movement.product.sku, "quantity_change": movement.quantity_change, "reason": movement.reason,
         "note": movement.note, "created_at": movement.created_at}
        for movement in movements
    ]


@app.post("/api/assistant")
def assistant(
    payload: AssistantRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    message = payload.message.strip()
    restock_match = re.fullmatch(r"(?:please\s+)?restock\s+(.+?)\s+by\s+(\d+)\s*(?:units?)?\.?", message, flags=re.IGNORECASE)
    if restock_match:
        if user.role not in ("admin", "manager"):
            raise HTTPException(status_code=403, detail="Restocking is limited to managers and admins")
        product_query, quantity_text = restock_match.groups()
        quantity = int(quantity_text)
        if quantity <= 0 or quantity > 100_000:
            return {"reply": "Please give a restock quantity between 1 and 100,000 units.", "action": None}
        matches = db.scalars(select(Product).where(
            (func.lower(Product.name) == product_query.lower()) | (func.lower(Product.sku) == product_query.lower())
        )).all()
        if len(matches) != 1:
            partials = db.scalars(select(Product).where(Product.name.ilike(f"%{product_query}%")).limit(4)).all()
            if partials:
                names = ", ".join(product.name for product in partials)
                return {"reply": f"I found more than one possible match. Which product did you mean: {names}?", "action": None}
            return {"reply": f"I couldn't find a product named {product_query}. Try its exact name or SKU.", "action": None}
        product = matches[0]
        product.current_stock += quantity
        movement = StockMovement(product_id=product.id, quantity_change=quantity, reason="restock",
                                 note="Restock requested in assistant", actor_id=user.id)
        db.add(movement)
        db.commit()
        return {"reply": f"Restocked {product.name} by {quantity} units. New stock: {product.current_stock}.",
                "action": {"type": "restock", "product_id": product.id, "movement_id": movement.id}}

    lowered = message.lower()
    name_query = re.search(r"(?:stock|inventory|quantity)\s+(?:for|of)\s+(.+?)[?.!]*$", message, flags=re.IGNORECASE)
    if name_query:
        term = name_query.group(1).strip()
        product = db.scalar(select(Product).where(
            (func.lower(Product.name) == term.lower()) | (func.lower(Product.sku) == term.lower())
        ))
        if product is None:
            product = db.scalar(select(Product).where(Product.name.ilike(f"%{term}%")).order_by(Product.name).limit(1))
        if product:
            state = "at or below reorder level" if product.current_stock <= product.reorder_level else "above reorder level"
            return {"reply": f"{product.name} ({product.sku}) has {product.current_stock} units, {state} ({product.reorder_level}).", "action": None}
        return {"reply": f"I couldn't find a product matching {term}. Try its product name or SKU.", "action": None}

    if any(word in lowered for word in ("low stock", "low-stock", "reorder")):
        items = db.scalars(select(Product).where(Product.current_stock <= Product.reorder_level).order_by(Product.current_stock)).all()
        if not items:
            return {"reply": "No products are currently at or below their reorder levels.", "action": None}
        summary = "; ".join(f"{item.name}: {item.current_stock} left (reorder at {item.reorder_level})" for item in items[:6])
        return {"reply": f"{len(items)} products need attention. {summary}.", "action": None}

    if any(word in lowered for word in ("sales", "revenue", "today", "profit")):
        since = utcnow() - timedelta(days=1 if "today" in lowered else 30)
        invoices = db.scalars(select(Invoice).options(selectinload(Invoice.items)).where(Invoice.created_at >= since)).all()
        revenue = money(sum((invoice.total for invoice in invoices), Decimal("0")))
        gross_profit = money(sum((item.profit for invoice in invoices for item in invoice.items), Decimal("0")))
        period_label = "the last 24 hours" if "today" in lowered else "the last 30 days"
        return {"reply": f"For {period_label}: {len(invoices)} invoices, ${revenue:,.2f} revenue, and ${gross_profit:,.2f} gross profit.", "action": None}

    return {
        "reply": "I can look up stock for a product, list low-stock items, summarize recent sales, explain billing, or restock an exact product. Example: ‘stock for Market greens’ or ‘restock Market greens by 12 units.’",
        "action": None,
    }
