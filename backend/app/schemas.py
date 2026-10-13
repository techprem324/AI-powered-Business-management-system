from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator
from typing_extensions import Annotated


NonNegativeMoney = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]
PositiveQuantity = Annotated[int, Field(gt=0, le=100_000)]
SKU = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=48)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=8, max_length=128)]


class SignupRequest(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=120)]
    email: EmailStr
    password: Annotated[str, Field(min_length=10, max_length=128)]
    account_type: Literal["user", "admin"] = "user"
    invitation_code: str | None = Field(default=None, min_length=1, max_length=100)


class InvitationCreate(BaseModel):
    email: EmailStr
    role: Literal["admin", "cashier"]


class InvitationOut(BaseModel):
    id: str
    email: str
    role: str
    created_at: datetime
    expires_at: datetime
    used_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class InvitationIssued(InvitationOut):
    code: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProductCreate(BaseModel):
    sku: SKU
    barcode: str | None = Field(default=None, max_length=80)
    name: Annotated[str, Field(min_length=2, max_length=180)]
    category: Annotated[str, Field(min_length=2, max_length=100)]
    description: str | None = Field(default=None, max_length=2000)
    cost_price: NonNegativeMoney
    selling_price: NonNegativeMoney
    current_stock: Annotated[int, Field(ge=0, le=1_000_000)] = 0
    reorder_level: Annotated[int, Field(ge=0, le=1_000_000)] = 10
    supplier_id: int | None = None


class ProductUpdate(BaseModel):
    sku: SKU | None = None
    barcode: str | None = Field(default=None, max_length=80)
    name: Annotated[str, Field(min_length=2, max_length=180)] | None = None
    category: Annotated[str, Field(min_length=2, max_length=100)] | None = None
    description: str | None = Field(default=None, max_length=2000)
    cost_price: NonNegativeMoney | None = None
    selling_price: NonNegativeMoney | None = None
    reorder_level: Annotated[int, Field(ge=0, le=1_000_000)] | None = None
    supplier_id: int | None = None


class ProductOut(BaseModel):
    id: int
    sku: str
    barcode: str | None
    name: str
    category: str
    description: str | None
    cost_price: Decimal
    selling_price: Decimal
    current_stock: int
    reorder_level: int
    supplier_id: int | None
    supplier_name: str | None = None


class SupplierCreate(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=160)]
    contact_name: str | None = Field(default=None, max_length=120)
    email: EmailStr | None = None
    lead_time_days: Annotated[int, Field(ge=1, le=365)] = 5


class SupplierOut(BaseModel):
    id: int
    name: str
    contact_name: str | None
    email: str | None
    lead_time_days: int


class InvoiceLineIn(BaseModel):
    product_id: int
    quantity: PositiveQuantity


class CheckoutRequest(BaseModel):
    items: Annotated[list[InvoiceLineIn], Field(min_length=1, max_length=100)]
    tax_rate: Annotated[Decimal, Field(ge=0, le=20, max_digits=5, decimal_places=2)] = Decimal("0")
    discount_percent: Annotated[Decimal, Field(ge=0, le=75, max_digits=5, decimal_places=2)] = Decimal("0")
    payment_mode: Literal["card", "cash", "bank_transfer", "other"] = "card"
    customer_name: str | None = Field(default=None, max_length=120)


class StockAdjustmentIn(BaseModel):
    quantity_change: Annotated[int, Field(ge=-100_000, le=100_000)]
    reason: Literal["restock", "adjustment", "return"]
    note: str | None = Field(default=None, max_length=255)

    @field_validator("quantity_change")
    @classmethod
    def quantity_change_must_be_nonzero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("Quantity change cannot be zero")
        return value


class InvoiceItemOut(BaseModel):
    product_id: int | None
    product_name: str
    sku: str
    quantity: int
    unit_cost: Decimal
    unit_price: Decimal
    line_total: Decimal
    profit: Decimal


class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    customer_name: str | None
    subtotal: Decimal
    tax_rate: Decimal
    tax: Decimal
    discount_percent: Decimal
    discount: Decimal
    total: Decimal
    payment_mode: str
    status: str
    created_at: datetime
    items: list[InvoiceItemOut]


class AssistantRequest(BaseModel):
    message: Annotated[str, Field(min_length=1, max_length=500)]
