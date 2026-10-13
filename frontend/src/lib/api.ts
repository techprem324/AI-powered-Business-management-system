export type Role = 'admin' | 'manager' | 'cashier'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface SignupPayload {
  name: string
  email: string
  password: string
  account_type: 'user' | 'admin'
  invitation_code?: string
}

export interface Invitation {
  id: string
  email: string
  role: 'admin' | 'cashier'
  created_at: string
  expires_at: string
  used_at: string | null
}

export interface InvitationIssued extends Invitation {
  code: string
}

export interface AuthProviders {
  email_password: boolean
  google: boolean
}

export interface Product {
  id: number
  sku: string
  barcode: string | null
  name: string
  category: string
  description: string | null
  cost_price: string
  selling_price: string
  current_stock: number
  reorder_level: number
  supplier_id: number | null
  supplier_name: string | null
}

export interface InvoiceItem {
  product_id: number | null
  product_name: string
  sku: string
  quantity: number
  unit_cost: string
  unit_price: string
  line_total: string
  profit: string
}

export interface Invoice {
  id: number
  invoice_number: string
  customer_name: string | null
  subtotal: string
  tax_rate: string
  tax: string
  discount_percent: string
  discount: string
  total: string
  payment_mode: string
  status: string
  created_at: string
  items: InvoiceItem[]
}

export interface DashboardData {
  period_days: number
  kpis: {
    revenue: number
    gross_profit: number
    transactions: number
    units_sold: number
    inventory_value: number
    low_stock_count: number
    gross_margin_percent: number
  }
  sales_trend: { date: string; sales: number; orders: number }[]
  category_mix: { category: string; sales: number }[]
  top_products: { name: string; units: number; sales: number; profit: number }[]
  low_stock: Product[]
  recent_invoices: Invoice[]
}

export interface Prediction {
  product_id: number
  name: string
  category: string
  sku: string
  current_stock: number
  daily_velocity: number
  horizon_days: number
  predicted_demand: number
  predicted_profit: number
  predicted_reorder_point: number
  days_until_stockout: number | null
  status: 'reorder' | 'healthy'
  drivers: string[]
  model_version: string
}

export interface Evaluation {
  model_version: string
  data_source: string
  profit_holdout_rows: number
  demand_holdout_rows: number
  demand_comparison: { model: string; rmse: number; mae: number; r2: number }[]
  reorder_holdout_rows: number
  profit_comparison: { model: string; rmse: number; mae: number; r2: number }[]
  reorder_metrics: { rmse: number; mae: number; r2: number }
  feature_importance: { feature: string; importance: number }[]
  caveat: string
}

export interface ForecastData {
  horizon_days: number
  generated_at: string
  model_version: string
  data_source: string
  total_predicted_profit: number
  total_predicted_demand: number
  products: Prediction[]
  evaluation: Evaluation
  caveat: string
}

export interface AssistantReply {
  reply: string
  action: { type: string; product_id: number; movement_id: number } | null
}

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'
const SESSION_KEY = 'northstar.session'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(SESSION_KEY)
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = Array.isArray(body.detail)
        ? body.detail.map((item: { msg?: string }) => item.msg).join(', ')
        : body.detail ?? message
    } catch {
      message = response.statusText || message
    }
    if (response.status === 401) localStorage.removeItem(SESSION_KEY)
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  providers() {
    return request<AuthProviders>('/auth/providers')
  },
  async login(email: string, password: string) {
    const result = await request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem(SESSION_KEY, result.access_token)
    return result.user
  },
  async signup(payload: SignupPayload) {
    const result = await request<{ access_token: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    localStorage.setItem(SESSION_KEY, result.access_token)
    return result.user
  },
  startGoogleLogin() {
    window.location.assign(`${API_BASE}/auth/oauth/google/start`)
  },
  async completeGoogleLogin() {
    const result = await request<{ access_token: string; user: User }>('/auth/oauth/session', { method: 'POST' })
    localStorage.setItem(SESSION_KEY, result.access_token)
    return result.user
  },
  async me() {
    return request<User>('/auth/me')
  },
  invitations() {
    return request<Invitation[]>('/admin/invitations')
  },
  createInvitation(email: string, role: Invitation['role']) {
    return request<InvitationIssued>('/admin/invitations', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
  },
  logout() {
    localStorage.removeItem(SESSION_KEY)
  },
  products(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request<Product[]>(`/products${query}`)
  },
  dashboard() {
    return request<DashboardData>('/dashboard')
  },
  invoices(limit = 40) {
    return request<Invoice[]>(`/invoices?limit=${limit}`)
  },
  checkout(payload: {
    items: { product_id: number; quantity: number }[]
    tax_rate: number
    discount_percent: number
    payment_mode: string
    customer_name?: string
  }) {
    const key = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
    return request<Invoice>('/invoices', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(payload),
    })
  },
  stockAdjustment(productId: number, quantity_change: number, reason: string, note: string) {
    return request<{ current_stock: number }>(`/products/${productId}/stock-adjustments`, {
      method: 'POST',
      body: JSON.stringify({ quantity_change, reason, note }),
    })
  },
  createProduct(payload: {
    sku: string
    name: string
    category: string
    cost_price: number
    selling_price: number
    current_stock: number
    reorder_level: number
  }) {
    return request<Product>('/products', { method: 'POST', body: JSON.stringify(payload) })
  },
  suppliers() {
    return request<{ id: number; name: string; lead_time_days: number }[]>('/suppliers')
  },
  forecast(horizon: number) {
    return request<ForecastData>(`/predictions?horizon_days=${horizon}`)
  },
  assistant(message: string) {
    return request<AssistantReply>('/assistant', { method: 'POST', body: JSON.stringify({ message }) })
  },
  movements(limit = 30) {
    return request<{ id: number; product_name: string; sku: string; quantity_change: number; reason: string; note: string | null; created_at: string }[]>(`/stock-movements?limit=${limit}`)
  },
}
