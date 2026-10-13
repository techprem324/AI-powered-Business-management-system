import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  Boxes,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileBarChart,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Tag,
  TrendingUp,
  Truck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  type AssistantReply,
  type AuthProviders,
  type DashboardData,
  type ForecastData,
  type Invitation,
  type InvitationIssued,
  type Invoice,
  type Product,
  type SignupPayload,
  type User,
} from "./lib/api";
import "./App.css";
import "./Auth.css";
import "./DemandEvaluation.css";
import "./Settings.css";

type View = "dashboard" | "pos" | "inventory" | "forecast" | "reports" | "settings";
type CartLine = { product: Product; quantity: number };
type ChatLine = { id: number; from: "assistant" | "user"; text: string };
type DateLabels = { greeting: string; marketNote: string; topbar: string };

let googleSessionExchange: Promise<User> | null = null;

function completeGoogleLoginOnce() {
  googleSessionExchange ??= api.completeGoogleLogin();
  return googleSessionExchange;
}

const navigation: {
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
  eyebrow?: string;
}[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "pos", label: "Point of sale", icon: ShoppingBasket },
  { id: "inventory", label: "Inventory", icon: Boxes, eyebrow: "10" },
  { id: "forecast", label: "Forecasts", icon: TrendingUp },
  { id: "reports", label: "Reports", icon: FileBarChart },
];

const validViews: View[] = ["dashboard", "pos", "inventory", "forecast", "reports", "settings"];

function viewFromLocation(): View {
  const requestedView = new URLSearchParams(window.location.search).get("view");
  return validViews.find((view) => view === requestedView) ?? "dashboard";
}

const chartColors = [
  "#176b57",
  "#ef815f",
  "#d4a83e",
  "#8c9e80",
  "#554b3d",
  "#7a9cad",
];

function money(value: number | string | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function preciseMoney(value: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function friendlyError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function getDateLabels(): DateLabels {
  const currentDate = new Date();
  const hour = currentDate.getHours();
  return {
    greeting:
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening",
    marketNote: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
      .format(currentDate)
      .toUpperCase(),
    topbar: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(currentDate),
  };
}

function BrandGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="m5.5 12 10.5-7 10.5 7v9l-10.5 6-10.5-6v-9Z" />
      <path d="m5.8 12.2 10.2 6 10.2-6M16 18.2V27M11.2 9.1l4.8 2.8 4.8-2.8" />
    </svg>
  );
}

function LoginScreen({
  onLogin,
  onSignup,
  onGoogleLogin,
  googleEnabled,
  externalError,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (payload: SignupPayload) => Promise<void>;
  onGoogleLogin: () => void;
  googleEnabled: boolean;
  externalError: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState<"user" | "admin">("user");
  const [invitationCode, setInvitationCode] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") {
        await onLogin(email, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await onSignup({
          name,
          email,
          password,
          account_type: accountType,
          ...(invitationCode ? { invitation_code: invitationCode } : {}),
        });
      }
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <a className="auth-brand" href="/" aria-label="Velaire home">
          <span className="brand-mark brand-mark-large">
            <BrandGlyph size={23} />
          </span>
          <span className="brand-name">
            Velaire<span>COMMERCE SYSTEM</span>
          </span>
        </a>
        <p className="eyebrow">RETAIL OPERATIONS, REIMAGINED</p>
        <h1>
          Good business,
          <br />
          <em>in clear view.</em>
        </h1>
        <p className="login-copy">
          Your store, connected from the first sale to the next smart order.
        </p>
        <div className="auth-heading">
          <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p>
            {mode === "signin"
              ? "Sign in to open your business workspace."
              : "Get started with connected tools for your business."}
          </p>
        </div>
        <div className="auth-mode-tabs" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? "auth-mode-active" : ""}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "auth-mode-active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
              setName("");
              setEmail("");
              setPassword("");
              setConfirmPassword("");
              setInvitationCode("");
              setShowPasswords(false);
            }}
          >
            Create account
          </button>
        </div>
        {googleEnabled && (
          <>
            <button
              className="google-login-button"
              type="button"
              onClick={onGoogleLogin}
              disabled={busy}
            >
              <span className="google-g" aria-hidden="true">G</span>
              Continue with Google
            </button>
            <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>
          </>
        )}
        <form className="login-form" onSubmit={submit}>
          {mode === "signup" && <label>Full name<input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required /></label>}
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <span className="password-input-wrap">
              <input
                type={showPasswords ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === "signin" ? 8 : 10}
                required
              />
              {mode === "signup" && (
                <button
                  className="password-action"
                  type="button"
                  aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                  onClick={() => setShowPasswords((visible) => !visible)}
                >
                  {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showPasswords ? "Hide" : "Show"}
                </button>
              )}
            </span>
          </label>
          {mode === "signup" && (
            <label>
              Confirm password
              <input
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={10}
                required
              />
            </label>
          )}
          {mode === "signup" && (
            <label>
              Account type
              <select
                value={accountType}
                onChange={(event) => {
                  setAccountType(event.target.value as "user" | "admin");
                  setInvitationCode("");
                }}
              >
                <option value="user">User · cashier access</option>
                <option value="admin">Admin · invitation required</option>
              </select>
            </label>
          )}
          {mode === "signup" && accountType === "admin" && (
            <label>
              Admin invitation code
              <input
                type="text"
                autoComplete="off"
                value={invitationCode}
                onChange={(event) => setInvitationCode(event.target.value.trim())}
                minLength={46}
                maxLength={46}
                placeholder="VL-..."
                required
              />
              <span className="field-hint">
                One-time, email-bound and case-sensitive. Format: <code>VL-</code> plus 43 characters (A–Z, a–z, 0–9, hyphen or underscore). Expires in 7 days.
              </span>
            </label>
          )}
          {(error || externalError) && (
            <div className="form-error" role="alert">
              {error || externalError}
            </div>
          )}
          <button
            className="button button-primary login-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? <LoaderCircle className="spin" size={17} /> : null}{mode === "signin" ? "Sign in" : "Create account"}{" "}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="login-hint">
          <ShieldCheck size={14} />
          {mode === "signin"
            ? "Your business workspace, securely connected."
            : "New accounts have cashier access. Admin access requires an invitation."}
        </p>
      </section>
      <aside className="login-aside">
        <div className="login-aside-top">
          <span>INTEGRATED BUSINESS SYSTEM</span>
          <span>01 — 03</span>
        </div>
        <div className="orbit-scene" aria-hidden="true">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="orbit orbit-c" />
          <span className="orbit-center">
            <BrandGlyph size={34} />
          </span>
          <span className="orbit-node node-pos">
            <ShoppingBasket size={16} />
          </span>
          <span className="orbit-node node-stock">
            <Boxes size={16} />
          </span>
          <span className="orbit-node node-ai">
            <Activity size={16} />
          </span>
        </div>
        <div className="login-aside-copy">
          <p className="eyebrow">ONE CONNECTED PIPELINE</p>
          <h2>
            Every sale tells
            <br />a bigger story.
          </h2>
          <p>
            Billing, stock movement, and forward-looking decisions, working as
            one.
          </p>
        </div>
        <div className="login-aside-footer">
          <span>SMART BILLING</span>
          <span>LIVE INVENTORY</span>
          <span>EXPLAINABLE AI</span>
        </div>
      </aside>
    </main>
  );
}

function SettingsView({ onHome }: { onHome: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Invitation["role"]>("cashier");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [issuedInvitation, setIssuedInvitation] = useState<InvitationIssued | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void api.invitations().then((result) => {
      if (active) setInvitations(result);
    }).catch((cause) => {
      if (active) setError(friendlyError(cause));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const invitation = await api.createInvitation(email, role);
      setIssuedInvitation(invitation);
      setInvitations((current) => [invitation, ...current].slice(0, 50));
      setEmail("");
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!issuedInvitation) return;
    try {
      await navigator.clipboard.writeText(issuedInvitation.code);
      setCopied(true);
    } catch (cause) {
      setError(`Could not copy invitation code: ${friendlyError(cause)}`);
    }
  }

  return (
    <section className="settings-view view-stack page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE ACCESS</p>
          <h1>Team invitations</h1>
          <p className="page-subtitle">Create secure, single-use invitations for specific teammates.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onHome}>
          <ArrowRight className="back-arrow" size={15} /> Back to overview
        </button>
      </div>

      <div className="settings-grid">
        <section className="surface invite-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NEW INVITATION</p>
              <h2>Invite a teammate</h2>
            </div>
            <span className="invite-icon"><ShieldCheck size={18} /></span>
          </div>
          <p className="settings-copy">
            Each invitation is tied to one email address, grants one role, and can be used once within 7 days.
          </p>
          <form className="invite-form" onSubmit={(event) => void submit(event)}>
            <label>
              Teammate email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                required
              />
            </label>
            <label>
              Access level
              <select value={role} onChange={(event) => setRole(event.target.value as Invitation["role"])}>
                <option value="cashier">Cashier — sales workspace access</option>
                <option value="admin">Admin — management access</option>
              </select>
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Users size={16} />}
              Create invitation
            </button>
          </form>
          {issuedInvitation && (
            <div className="issued-invitation" role="status">
              <strong>Send this code to {issuedInvitation.email}</strong>
              <p>This code is shown only once. Never share your own password or sign-in session.</p>
              <div className="invite-code-row">
                <code>{issuedInvitation.code}</code>
                <button className="button button-secondary" type="button" onClick={() => void copyCode()}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Copied" : "Copy code"}
                </button>
              </div>
              <small>Case-sensitive · Expires {new Date(issuedInvitation.expires_at).toLocaleString()}</small>
            </div>
          )}
        </section>

        <section className="surface invitations-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ACCESS CONTROL</p>
              <h2>Recent invitations</h2>
            </div>
          </div>
          {loading ? (
            <div className="invitation-empty"><LoaderCircle className="spin" size={18} /> Loading invitations</div>
          ) : invitations.length ? (
            <div className="invitation-list">
              {invitations.map((invitation) => (
                <article className="invitation-row" key={invitation.id}>
                  <span className="invitation-avatar"><Users size={15} /></span>
                  <span className="invitation-details">
                    <strong>{invitation.email}</strong>
                    <small>{invitation.role === "admin" ? "Admin" : "Cashier"} · Expires {new Date(invitation.expires_at).toLocaleDateString()}</small>
                  </span>
                  <span className={`invitation-status ${invitation.used_at ? "used" : "pending"}`}>
                    {invitation.used_at ? "Used" : "Pending"}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="invitation-empty">No invitations yet. New teammate access will appear here.</p>
          )}
          <p className="access-note">
            Invitations grant access only inside this Velaire workspace, according to the selected role. They do not grant access to your device or local files.
          </p>
        </section>
      </div>
    </section>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>(viewFromLocation);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [horizon, setHorizon] = useState(7);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [authError, setAuthError] = useState("");
  const [authProviders, setAuthProviders] = useState<AuthProviders>({
    email_password: true,
    google: false,
  });
  const [toast, setToast] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([
    {
      id: 1,
      from: "assistant",
      text: "Hi Olivia. Ask me about stock, low inventory, or recent sales. I can also record an exact restock for you.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catalogStockFilter, setCatalogStockFilter] = useState<
    "all" | "in-stock" | "low-stock"
  >("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [paymentMode, setPaymentMode] = useState("card");
  const [customerName, setCustomerName] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [invoiceComplete, setInvoiceComplete] = useState<Invoice | null>(null);
  const [dateLabels, setDateLabels] = useState<DateLabels | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [adjustmentProduct, setAdjustmentProduct] = useState<number | null>(
    null,
  );
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("12");

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const term = search.trim().toLowerCase();
        const matchesSearch =
          !term ||
          `${product.name} ${product.sku} ${product.category}`
            .toLowerCase()
            .includes(term);
        const matchesStock =
          catalogStockFilter === "all" ||
          (catalogStockFilter === "in-stock" && product.current_stock > 0) ||
          (catalogStockFilter === "low-stock" &&
            product.current_stock <= product.reorder_level);
        return matchesSearch && matchesStock;
      }),
    [products, search, catalogStockFilter],
  );

  const filteredInventory = useMemo(
    () =>
      products.filter((product) => {
        const term = inventorySearch.trim().toLowerCase();
        return (
          !term ||
          `${product.name} ${product.sku} ${product.category}`
            .toLowerCase()
            .includes(term)
        );
      }),
    [products, inventorySearch],
  );

  const cartSubtotal = cart.reduce(
    (sum, line) => sum + Number(line.product.selling_price) * line.quantity,
    0,
  );
  const cartDiscount = (cartSubtotal * Math.min(discount, 75)) / 100;
  const cartTax = ((cartSubtotal - cartDiscount) * Math.min(taxRate, 20)) / 100;
  const cartTotal = cartSubtotal - cartDiscount + cartTax;

  async function loadWorkspace() {
    setPageError("");
    const [nextDashboard, nextProducts, nextInvoices] = await Promise.all([
      api.dashboard(),
      api.products(),
      api.invoices(),
    ]);
    setDashboard(nextDashboard);
    setProducts(nextProducts);
    setInvoices(nextInvoices);
  }

  async function loadForecast(nextHorizon = horizon) {
    setLoading(true);
    setPageError("");
    try {
      const result = await api.forecast(nextHorizon);
      setForecast(result);
    } catch (error) {
      setPageError(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void api.providers().then((providers) => {
      if (active) setAuthProviders(providers);
    }).catch(() => undefined);

    const googleCallback = new URLSearchParams(window.location.search).get("oauth") === "google";
    if (googleCallback) {
      window.history.replaceState({}, "", window.location.pathname);
      void completeGoogleLoginOnce().then(async (currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setDateLabels(getDateLabels());
        await loadWorkspace();
      }).catch((error) => {
        if (active) setAuthError(friendlyError(error));
      }).finally(() => {
        if (active) setLoading(false);
      });
    } else {
      void api.me().then(async (currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setDateLabels(getDateLabels());
        try {
          await loadWorkspace();
        } catch (error) {
          if (active) setPageError(friendlyError(error));
        } finally {
          if (active) setLoading(false);
        }
      }).catch(() => {
        if (active) setLoading(false);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handlePopState() {
      const nextView = viewFromLocation();
      setView(nextView);
      setMobileNavOpen(false);
      setPageError("");
      if (nextView === "forecast") void loadForecast(horizon);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [horizon]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleLogin(email: string, password: string) {
    setAuthError("");
    const signedInUser = await api.login(email, password);
    setUser(signedInUser);
    setDateLabels(getDateLabels());
    setLoading(true);
    try {
      await loadWorkspace();
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(payload: SignupPayload) {
    setAuthError("");
    const signedInUser = await api.signup(payload);
    setUser(signedInUser);
    setDateLabels(getDateLabels());
    setLoading(true);
    try {
      await loadWorkspace();
    } finally {
      setLoading(false);
    }
  }

  function navigate(nextView: View) {
    if (nextView !== view) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", nextView);
      window.history.pushState({ view: nextView }, "", url);
    }
    setView(nextView);
    setMobileNavOpen(false);
    setPageError("");
    if (nextView === "forecast" && !forecast) void loadForecast(horizon);
  }

  function goBack() {
    if (window.history.state?.view === view) {
      window.history.back();
    } else {
      navigate("dashboard");
    }
  }

  function addToCart(product: Product) {
    if (product.current_stock < 1) {
      setToast(`${product.name} is out of stock`);
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing)
        return current.map((line) =>
          line.product.id === product.id
            ? {
                ...line,
                quantity: Math.min(line.quantity + 1, product.current_stock),
              }
            : line,
        );
      return [...current, { product, quantity: 1 }];
    });
  }

  function updateQuantity(productId: number, quantity: number) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setCart((current) =>
      quantity <= 0
        ? current.filter((line) => line.product.id !== productId)
        : current.map((line) =>
            line.product.id === productId
              ? { ...line, quantity: Math.min(quantity, product.current_stock) }
              : line,
          ),
    );
  }

  async function completeSale() {
    setCheckoutBusy(true);
    setPageError("");
    try {
      const result = await api.checkout({
        items: cart.map((line) => ({
          product_id: line.product.id,
          quantity: line.quantity,
        })),
        tax_rate: taxRate,
        discount_percent: discount,
        payment_mode: paymentMode,
        customer_name: customerName.trim() || undefined,
      });
      setInvoiceComplete(result);
      setCart([]);
      setCustomerName("");
      setDiscount(0);
      await loadWorkspace();
      setToast(`Sale ${result.invoice_number} recorded`);
    } catch (error) {
      setPageError(friendlyError(error));
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function submitAssistant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    const userLine = { id: Date.now(), from: "user" as const, text: message };
    setChat((current) => [...current, userLine]);
    setChatInput("");
    setChatBusy(true);
    try {
      const reply: AssistantReply = await api.assistant(message);
      setChat((current) => [
        ...current,
        { id: Date.now() + 1, from: "assistant", text: reply.reply },
      ]);
      if (reply.action) {
        setToast("Stock updated and audit movement recorded");
        await loadWorkspace();
      }
    } catch (error) {
      setChat((current) => [
        ...current,
        { id: Date.now() + 1, from: "assistant", text: friendlyError(error) },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api.createProduct({
        sku: String(form.get("sku")),
        name: String(form.get("name")),
        category: String(form.get("category")),
        cost_price: Number(form.get("cost_price")),
        selling_price: Number(form.get("selling_price")),
        current_stock: Number(form.get("current_stock")),
        reorder_level: Number(form.get("reorder_level")),
      });
      setShowProductForm(false);
      formElement.reset();
      await loadWorkspace();
      setToast("Product added to inventory");
    } catch (error) {
      setPageError(friendlyError(error));
    }
  }

  async function restockProduct(productId: number) {
    try {
      await api.stockAdjustment(
        productId,
        Number(adjustmentQuantity),
        "restock",
        "Stock received",
      );
      setAdjustmentProduct(null);
      await loadWorkspace();
      setToast("Stock received and movement logged");
    } catch (error) {
      setPageError(friendlyError(error));
    }
  }

  function signOut() {
    api.logout();
    setUser(null);
    setView("dashboard");
    window.history.replaceState({ view: "dashboard" }, "", window.location.pathname);
    setView("dashboard");
    window.history.replaceState({ view: "dashboard" }, "", window.location.pathname);
    setDashboard(null);
    setForecast(null);
    setChat([
      {
        id: Date.now(),
        from: "assistant",
        text: "Hi. Ask me about stock, low inventory, or recent sales.",
      },
    ]);
  }

  if (!user) return <LoginScreen onLogin={handleLogin} onSignup={handleSignup} onGoogleLogin={() => api.startGoogleLogin()} googleEnabled={authProviders.google} externalError={authError} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand-row">
          <button
            className="sidebar-brand sidebar-brand-home"
            type="button"
            aria-label="Velaire home"
            onClick={() => navigate("dashboard")}
          >
            <span className="brand-mark">
              <BrandGlyph size={19} />
            </span>
            <span className="brand-name">
              Velaire<span>COMMERCE SYSTEM</span>
            </span>
          </button>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="store-switch">
          <span className="store-avatar">N</span>
          <span className="store-label">
            <strong>Velaire Market</strong>
            <small>Flagship store</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <p className="nav-heading">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const count =
              item.id === "inventory"
                ? dashboard?.kpis.low_stock_count
                : undefined;
            return (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? "nav-item-active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
                {count ? <span className="nav-count">{count}</span> : null}
              </button>
            );
          })}
        </nav>
        <p className="nav-heading nav-heading-lower">MANAGE</p>
        <button
          className={`nav-item ${view === "settings" ? "nav-item-active" : ""}`}
          onClick={() =>
            user.role === "admin"
              ? navigate("settings")
              : setToast("Store settings are managed by an administrator")
          }
        >
          <Settings2 size={17} strokeWidth={1.8} />
          <span>Settings</span>
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setAssistantOpen(true);
            setMobileNavOpen(false);
          }}
        >
          <CircleHelp size={17} strokeWidth={1.8} />
          <span>Help & assistant</span>
          <span className="online-dot" />
        </button>
        <div className="sidebar-bottom">
          <div className="plan-note">
            <span className="plan-symbol">
              <Sparkles size={15} />
            </span>
            <div>
              <strong>Decision support</strong>
              <p>Forecasts refresh from sales</p>
            </div>
          </div>
          <button className="profile-row" onClick={signOut}>
            <span className="profile-avatar">
              {user.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span className="profile-details">
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </span>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            {view !== "dashboard" && (
              <button
                className="icon-button back-button"
                type="button"
                aria-label="Go back"
                title="Go back"
                onClick={goBack}
              >
                <ArrowRight className="back-arrow" size={16} />
              </button>
            )}
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumbs">
              <span>Velaire Market</span>
              <span className="crumb-separator">/</span>
              <strong>
                {navigation.find((item) => item.id === view)?.label ?? "Settings"}
              </strong>
            </div>
          </div>
          <div className="topbar-right">
            <div className="sync-status">
              <span className="sync-dot" /> All systems operational
            </div>
            <button
              className="icon-button notification-button"
              aria-label="Open alerts"
              onClick={() => navigate("inventory")}
            >
              <Bell size={17} />
              {(dashboard?.kpis.low_stock_count ?? 0) > 0 && <i />}
            </button>
            <span className="topbar-divider" />
            <span className="topbar-date">
              <CalendarDays size={15} />
              {dateLabels?.topbar ?? "Today"}
            </span>
          </div>
        </header>

        <div className="page-content">
          {pageError && (
            <div className="error-banner" role="alert">
              <span>{pageError}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setPageError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading && !dashboard ? (
            <div className="loading-state">
              <LoaderCircle className="spin" size={23} />
              <span>Loading store data</span>
            </div>
          ) : null}
          {view === "dashboard" && dashboard && (
            <DashboardView
              data={dashboard}
              invoices={invoices}
              user={user}
              dateLabels={dateLabels}
              onNavigate={navigate}
            />
          )}
          {view === "pos" && (
            <PosView
              products={filteredProducts}
              cart={cart}
              search={search}
              setSearch={setSearch}
              stockFilter={catalogStockFilter}
              setStockFilter={setCatalogStockFilter}
              onAdd={addToCart}
              onQuantity={updateQuantity}
              subtotal={cartSubtotal}
              discount={discount}
              setDiscount={setDiscount}
              taxRate={taxRate}
              setTaxRate={setTaxRate}
              total={cartTotal}
              paymentMode={paymentMode}
              setPaymentMode={setPaymentMode}
              customerName={customerName}
              setCustomerName={setCustomerName}
              busy={checkoutBusy}
              onCheckout={() => void completeSale()}
              completed={invoiceComplete}
              onDismissInvoice={() => setInvoiceComplete(null)}
            />
          )}
          {view === "inventory" && (
            <InventoryView
              products={filteredInventory}
              search={inventorySearch}
              setSearch={setInventorySearch}
              canManage={user.role !== "cashier"}
              showForm={showProductForm}
              setShowForm={setShowProductForm}
              onCreate={createProduct}
              adjustmentProduct={adjustmentProduct}
              setAdjustmentProduct={setAdjustmentProduct}
              adjustmentQuantity={adjustmentQuantity}
              setAdjustmentQuantity={setAdjustmentQuantity}
              onRestock={(id) => void restockProduct(id)}
              onAssistant={() => setAssistantOpen(true)}
            />
          )}
          {view === "forecast" && (
            <ForecastView
              forecast={forecast}
              horizon={horizon}
              loading={loading}
              onHorizon={(days) => {
                setHorizon(days);
                void loadForecast(days);
              }}
            />
          )}
          {view === "forecast" && forecast && (
            <DemandEvaluation forecast={forecast} />
          )}
          {view === "reports" && (
            <ReportsView
              invoices={invoices}
              dashboard={dashboard}
              onPrint={(invoice) => {
                setInvoiceComplete(invoice);
                window.setTimeout(() => window.print(), 100);
              }}
            />
          )}
          {view === "settings" && user.role === "admin" && (
            <SettingsView onHome={() => navigate("dashboard")} />
          )}
        </div>
      </main>

      <button
        className={`assistant-launcher ${assistantOpen ? "assistant-launcher-active" : ""}`}
        aria-label={assistantOpen ? "Close assistant" : "Open assistant"}
        onClick={() => setAssistantOpen((open) => !open)}
      >
        {assistantOpen ? <X size={20} /> : <MessageCircle size={20} />}
        <span>Ask Velaire</span>
        <span className="assistant-pulse" />
      </button>
      {assistantOpen && (
        <AssistantPanel
          chat={chat}
          input={chatInput}
          setInput={setChatInput}
          busy={chatBusy}
          onSubmit={(event) => void submitAssistant(event)}
          onClose={() => setAssistantOpen(false)}
          onSuggestion={(value) => setChatInput(value)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-check">
            <Check size={14} />
          </span>
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="print-only" aria-hidden="true">
        {invoiceComplete && <Receipt invoice={invoiceComplete} />}
      </div>
    </div>
  );
}

function DashboardView({
  data,
  invoices,
  user,
  dateLabels,
  onNavigate,
}: {
  data: DashboardData;
  invoices: Invoice[];
  user: User;
  dateLabels: DateLabels | null;
  onNavigate: (view: View) => void;
}) {
  const metrics = [
    {
      label: "Gross sales",
      value: money(data.kpis.revenue),
      detail: "Last 30 days",
      icon: WalletCards,
      tone: "metric-green",
      trend: "30 days",
    },
    {
      label: "Gross profit",
      value: money(data.kpis.gross_profit),
      detail: `${data.kpis.gross_margin_percent}% margin`,
      icon: TrendingUp,
      tone: "metric-yellow",
      trend: "30 days",
    },
    {
      label: "Transactions",
      value: data.kpis.transactions.toLocaleString(),
      detail: `${data.kpis.units_sold} units sold`,
      icon: CreditCard,
      tone: "metric-blue",
      trend: "30 days",
    },
    {
      label: "Stock at cost",
      value: money(data.kpis.inventory_value),
      detail: `${data.kpis.low_stock_count} items need attention`,
      icon: Boxes,
      tone: "metric-coral",
      trend: "Live",
    },
  ];

  return (
    <div className="view-stack page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {dateLabels?.marketNote ?? "STORE"} / MARKET NOTES
          </p>
          <h1>
            {dateLabels?.greeting ?? "Welcome"}, {user.name.split(" ")[0]}
            <span className="heading-period">.</span>
          </h1>
          <p className="page-subtitle">
            Here's how your store is moving this month.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="button button-secondary"
            onClick={() => onNavigate("reports")}
          >
            <Download size={16} /> Export report
          </button>
          <button
            className="button button-primary"
            onClick={() => onNavigate("pos")}
          >
            <Plus size={16} /> New sale
          </button>
        </div>
      </div>
      <div className="metric-grid">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <article
              className={`metric-card ${metric.tone} reveal-card`}
              style={{ animationDelay: `${index * 55}ms` }}
              key={metric.label}
            >
              <div className="metric-top">
                <span className="metric-icon">
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <span className="metric-change">{metric.trend}</span>
              </div>
              <p className="metric-label">{metric.label}</p>
              <strong className="metric-value">{metric.value}</strong>
              <p className="metric-detail">{metric.detail}</p>
            </article>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <section className="surface sales-surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PERFORMANCE</p>
              <h2>Sales at a glance</h2>
            </div>
            <button
              className="select-button"
              onClick={() => onNavigate("reports")}
            >
              Last 7 days <ChevronDown size={14} />
            </button>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-sales" /> Sales
            </span>
            <span>
              <i className="legend-orders" /> Orders
            </span>
          </div>
          <div className="sales-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.sales_trend}
                margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#176b57" stopOpacity={0.16} />
                    <stop offset="96%" stopColor="#176b57" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#ebe9e0"
                  vertical={false}
                  strokeDasharray="3 6"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => dateLabel(value)}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8a8982", fontSize: 11 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8a8982", fontSize: 11 }}
                  tickFormatter={(value: number) => `$${value}`}
                />
                <Tooltip
                  formatter={(value) => [money(Number(value)), "Sales"]}
                  labelFormatter={(label) => dateLabel(String(label))}
                  contentStyle={{
                    borderRadius: 4,
                    borderColor: "#e8e6dd",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#176b57"
                  strokeWidth={2.3}
                  fill="url(#salesFill)"
                  activeDot={{ r: 4, fill: "#176b57", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footer">
            <span>
              <span className="chart-total">
                {money(
                  data.sales_trend.reduce(
                    (sum, day) => sum + Number(day.sales),
                    0,
                  ),
                )}
              </span>{" "}
              total this week
            </span>
            <span className="chart-footer-note">
              <Activity size={13} /> Updated from live invoices
            </span>
          </div>
        </section>

        <section className="surface category-surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BY CATEGORY</p>
              <h2>What's selling</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Open reports"
              onClick={() => onNavigate("reports")}
            >
              <ArrowRight size={17} />
            </button>
          </div>
          {data.category_mix.length ? (
            <>
              <div className="category-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.category_mix}
                      dataKey="sales"
                      nameKey="category"
                      innerRadius={57}
                      outerRadius={76}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {data.category_mix.map((item, index) => (
                        <Cell
                          key={item.category}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => money(Number(value))}
                      contentStyle={{
                        borderRadius: 4,
                        borderColor: "#e8e6dd",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="category-center">
                  <strong>{data.category_mix.length}</strong>
                  <span>categories</span>
                </div>
              </div>
              <div className="category-legend">
                {data.category_mix.slice(0, 4).map((item, index) => (
                  <div className="category-legend-row" key={item.category}>
                    <span>
                      <i
                        style={{
                          background: chartColors[index % chartColors.length],
                        }}
                      />
                      {item.category}
                    </span>
                    <strong>{money(item.sales)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Tag}
              title="A fresh start"
              detail="Category sales will appear as invoices come in."
            />
          )}
        </section>
      </div>

      <div className="dashboard-grid lower-grid">
        <section className="surface attention-surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">INVENTORY CONTROL</p>
              <h2>
                Needs a closer look{" "}
                <span className="heading-count">
                  {data.kpis.low_stock_count}
                </span>
              </h2>
            </div>
            <button
              className="text-link"
              onClick={() => onNavigate("inventory")}
            >
              View inventory <ArrowRight size={14} />
            </button>
          </div>
          {data.low_stock.length ? (
            <div className="attention-list">
              {data.low_stock.slice(0, 4).map((product) => (
                <div className="attention-row" key={product.id}>
                  <span className="product-monogram">
                    {product.name.slice(0, 1)}
                  </span>
                  <div className="attention-product">
                    <strong>{product.name}</strong>
                    <small>
                      {product.category} · SKU {product.sku}
                    </small>
                  </div>
                  <div className="stock-meter">
                    <span className="stock-meter-track">
                      <i
                        style={{
                          width: `${Math.min(100, (product.current_stock / Math.max(product.reorder_level, 1)) * 100)}%`,
                        }}
                      />
                    </span>
                    <strong>
                      {product.current_stock} <small>left</small>
                    </strong>
                  </div>
                  <span className="attention-badge">Reorder</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Check}
              title="All stocked up"
              detail="Every item is above its reorder level."
              compact
            />
          )}
        </section>

        <section className="surface recent-surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE LATEST</p>
              <h2>Recent sales</h2>
            </div>
            <button className="text-link" onClick={() => onNavigate("reports")}>
              All activity <ArrowRight size={14} />
            </button>
          </div>
          {invoices.length ? (
            <div className="recent-list">
              {invoices.slice(0, 4).map((invoice, index) => (
                <div className="recent-row" key={invoice.id}>
                  <span className={`recent-icon recent-icon-${index % 3}`}>
                    <ShoppingBasket size={15} />
                  </span>
                  <div className="recent-description">
                    <strong>
                      {invoice.customer_name ||
                        invoice.items[0]?.product_name ||
                        "In-store purchase"}
                    </strong>
                    <small>
                      {invoice.invoice_number} · {dateLabel(invoice.created_at)}
                    </small>
                  </div>
                  <strong className="recent-total">
                    {preciseMoney(invoice.total)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CreditCard}
              title="No sales yet"
              detail="Your first checkout will show up here."
              compact
            />
          )}
        </section>
      </div>

      <div className="dashboard-footnote">
        <span>
          <ShieldCheck size={15} /> Business data syncs directly from recorded
          sales
        </span>
        <span>
          <Clock3 size={14} /> 30-day overview · USD
        </span>
      </div>
    </div>
  );
}

function PosView({
  products,
  cart,
  search,
  setSearch,
  stockFilter,
  setStockFilter,
  onAdd,
  onQuantity,
  subtotal,
  discount,
  setDiscount,
  taxRate,
  setTaxRate,
  total,
  paymentMode,
  setPaymentMode,
  customerName,
  setCustomerName,
  busy,
  onCheckout,
  completed,
  onDismissInvoice,
}: {
  products: Product[];
  cart: CartLine[];
  search: string;
  setSearch: (value: string) => void;
  stockFilter: "all" | "in-stock" | "low-stock";
  setStockFilter: (value: "all" | "in-stock" | "low-stock") => void;
  onAdd: (product: Product) => void;
  onQuantity: (id: number, quantity: number) => void;
  subtotal: number;
  discount: number;
  setDiscount: (value: number) => void;
  taxRate: number;
  setTaxRate: (value: number) => void;
  total: number;
  paymentMode: string;
  setPaymentMode: (value: string) => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  busy: boolean;
  onCheckout: () => void;
  completed: Invoice | null;
  onDismissInvoice: () => void;
}) {
  return (
    <div className="view-stack page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COUNTER / NEW TRANSACTION</p>
          <h1>
            Point of sale<span className="heading-period">.</span>
          </h1>
          <p className="page-subtitle">
            Build a basket, check stock, and close out in one step.
          </p>
        </div>
        <div className="pos-availability">
          <span className="sync-dot" /> Stock levels update at checkout
        </div>
      </div>
      {completed && (
        <div className="sale-success">
          <div className="success-symbol">
            <Check size={19} />
          </div>
          <div>
            <strong>Sale recorded · {completed.invoice_number}</strong>
            <span>
              {completed.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
              items · {preciseMoney(completed.total)} · inventory updated
            </span>
          </div>
          <button
            className="button button-secondary"
            onClick={() => window.print()}
          >
            <Printer size={15} /> Print receipt
          </button>
          <button
            className="icon-button"
            aria-label="Dismiss receipt"
            onClick={onDismissInvoice}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="pos-layout">
        <section className="surface catalog-surface">
          <div className="catalog-toolbar">
            <div>
              <p className="eyebrow">PRODUCT CATALOG</p>
              <h2>Choose items</h2>
            </div>
            <span className="catalog-count">{products.length} products</span>
          </div>
          <label className="search-field catalog-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, category, or SKU"
            />
          </label>
          <div className="category-pills">
            <label
              className="catalog-filter-wrap"
              htmlFor="catalog-stock-filter"
            >
              Availability
              <select
                className="catalog-filter"
                id="catalog-stock-filter"
                value={stockFilter}
                onChange={(event) =>
                  setStockFilter(
                    event.target.value as "all" | "in-stock" | "low-stock",
                  )
                }
              >
                <option value="all">All items</option>
                <option value="in-stock">In stock</option>
                <option value="low-stock">Low stock</option>
              </select>
            </label>
          </div>
          <div className="catalog-grid">
            {products.map((product, index) => (
              <button
                className={`catalog-product product-accent-${index % 5}`}
                key={product.id}
                onClick={() => onAdd(product)}
                disabled={product.current_stock < 1}
              >
                <span className="catalog-product-mark">
                  <Package size={20} strokeWidth={1.6} />
                </span>
                <span className="catalog-product-copy">
                  <strong>{product.name}</strong>
                  <small>
                    {product.category} · {product.current_stock} available
                  </small>
                  <b>{preciseMoney(product.selling_price)}</b>
                </span>
                <span className="catalog-add">
                  <Plus size={15} />
                </span>
              </button>
            ))}
          </div>
          {!products.length && (
            <EmptyState
              icon={Search}
              title="No matches"
              detail="Try a product name or SKU."
            />
          )}
        </section>

        <section className="surface cart-surface">
          <div className="cart-heading">
            <div>
              <p className="eyebrow">CURRENT SALE</p>
              <h2>Order details</h2>
            </div>
            <span className="cart-number">DRAFT</span>
          </div>
          <label className="customer-input">
            <Users size={15} />
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Customer name (optional)"
              maxLength={120}
            />
          </label>
          <div className="cart-list">
            {cart.length ? (
              cart.map((line) => (
                <div className="cart-line" key={line.product.id}>
                  <span className="cart-item-symbol">
                    <Package size={16} />
                  </span>
                  <div className="cart-item-details">
                    <strong>{line.product.name}</strong>
                    <small>
                      {preciseMoney(line.product.selling_price)} each
                    </small>
                  </div>
                  <div className="quantity-control">
                    <button
                      aria-label={`Remove one ${line.product.name}`}
                      onClick={() =>
                        onQuantity(line.product.id, line.quantity - 1)
                      }
                    >
                      <Minus size={12} />
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      aria-label={`Add one ${line.product.name}`}
                      onClick={() =>
                        onQuantity(line.product.id, line.quantity + 1)
                      }
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <strong className="cart-line-total">
                    {preciseMoney(
                      Number(line.product.selling_price) * line.quantity,
                    )}
                  </strong>
                </div>
              ))
            ) : (
              <div className="cart-empty">
                <span className="cart-empty-icon">
                  <ShoppingBasket size={22} />
                </span>
                <strong>Your basket is waiting</strong>
                <span>Choose an item to start a sale.</span>
              </div>
            )}
          </div>
          <div className="cart-adjustments">
            <label>
              <span>Discount</span>
              <span className="number-input-wrap">
                <input
                  type="number"
                  min="0"
                  max="75"
                  step="1"
                  value={discount}
                  onChange={(event) =>
                    setDiscount(
                      Math.min(75, Math.max(0, Number(event.target.value))),
                    )
                  }
                  aria-label="Discount percentage"
                />
                <b>%</b>
              </span>
            </label>
            <label>
              <span>Tax rate</span>
              <span className="number-input-wrap">
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.25"
                  value={taxRate}
                  onChange={(event) =>
                    setTaxRate(
                      Math.min(20, Math.max(0, Number(event.target.value))),
                    )
                  }
                  aria-label="Tax rate percentage"
                />
                <b>%</b>
              </span>
            </label>
          </div>
          <div className="payment-select">
            <span>Payment</span>
            <div className="payment-options">
              {[
                ["card", CreditCard, "Card"],
                ["cash", WalletCards, "Cash"],
                ["bank_transfer", BriefcaseBusiness, "Bank"],
              ].map(([value, Icon, label]) => {
                const PaymentIcon = Icon as typeof CreditCard;
                return (
                  <button
                    key={value as string}
                    className={
                      paymentMode === value
                        ? "payment-option payment-option-active"
                        : "payment-option"
                    }
                    onClick={() => setPaymentMode(value as string)}
                  >
                    <PaymentIcon size={14} />
                    {label as string}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="totals-block">
            <div>
              <span>Subtotal</span>
              <span>{preciseMoney(subtotal)}</span>
            </div>
            <div>
              <span>Discount</span>
              <span className="discount-value">
                −{preciseMoney((subtotal * discount) / 100)}
              </span>
            </div>
            <div>
              <span>Tax · {taxRate}%</span>
              <span>
                {preciseMoney(
                  ((subtotal - (subtotal * discount) / 100) * taxRate) / 100,
                )}
              </span>
            </div>
            <div className="total-row">
              <strong>Total due</strong>
              <strong>{preciseMoney(total)}</strong>
            </div>
          </div>
          <button
            className="button button-primary checkout-button"
            disabled={busy || cart.length === 0}
            onClick={onCheckout}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            {busy ? "Completing sale…" : `Charge ${preciseMoney(total)}`}
          </button>
          <p className="checkout-note">
            <ShieldCheck size={13} /> Stock is validated and deducted atomically
          </p>
        </section>
      </div>
    </div>
  );
}

function InventoryView({
  products,
  search,
  setSearch,
  canManage,
  showForm,
  setShowForm,
  onCreate,
  adjustmentProduct,
  setAdjustmentProduct,
  adjustmentQuantity,
  setAdjustmentQuantity,
  onRestock,
  onAssistant,
}: {
  products: Product[];
  search: string;
  setSearch: (value: string) => void;
  canManage: boolean;
  showForm: boolean;
  setShowForm: (value: boolean) => void;
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;
  adjustmentProduct: number | null;
  setAdjustmentProduct: (value: number | null) => void;
  adjustmentQuantity: string;
  setAdjustmentQuantity: (value: string) => void;
  onRestock: (id: number) => void;
  onAssistant: () => void;
}) {
  const attentionCount = products.filter(
    (product) => product.current_stock <= product.reorder_level,
  ).length;
  return (
    <div className="view-stack page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">STOCK / CATALOG CONTROL</p>
          <h1>
            Inventory<span className="heading-period">.</span>
          </h1>
          <p className="page-subtitle">
            Live quantities with a movement trail behind every change.
          </p>
        </div>
        <div className="heading-actions">
          {canManage && (
            <button className="button button-secondary" onClick={onAssistant}>
              <Sparkles size={15} /> Ask to restock
            </button>
          )}
          {canManage && (
            <button
              className="button button-primary"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus size={16} /> Add product
            </button>
          )}
        </div>
      </div>
      <div className="inventory-summary">
        <div className="inventory-summary-item">
          <span className="summary-icon summary-icon-green">
            <Boxes size={17} />
          </span>
          <span>
            <small>Catalog items</small>
            <strong>{products.length}</strong>
          </span>
        </div>
        <span className="summary-rule" />
        <div className="inventory-summary-item">
          <span className="summary-icon summary-icon-coral">
            <Bell size={17} />
          </span>
          <span>
            <small>Below reorder point</small>
            <strong className={attentionCount ? "text-coral" : ""}>
              {attentionCount}
            </strong>
          </span>
        </div>
        <span className="summary-rule" />
        <div className="inventory-summary-item">
          <span className="summary-icon summary-icon-yellow">
            <Truck size={17} />
          </span>
          <span>
            <small>Tracked movements</small>
            <strong>Live ledger</strong>
          </span>
        </div>
        <div className="inventory-forecast-note">
          <Activity size={15} /> Forecast-aware reorder points
        </div>
      </div>
      {showForm && canManage && (
        <form className="surface product-form" onSubmit={onCreate}>
          <div className="form-heading">
            <div>
              <p className="eyebrow">NEW CATALOG ITEM</p>
              <h2>Add a product</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Close add product form"
              onClick={() => setShowForm(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="product-form-grid">
            <label>
              Product name
              <input
                name="name"
                required
                minLength={2}
                placeholder="e.g. Wildflower honey"
              />
            </label>
            <label>
              SKU
              <input
                name="sku"
                required
                minLength={2}
                placeholder="e.g. PAN-024"
              />
            </label>
            <label>
              Category
              <input name="category" required placeholder="e.g. Pantry" />
            </label>
            <label>
              Unit cost
              <input
                name="cost_price"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="0.00"
              />
            </label>
            <label>
              Sell price
              <input
                name="selling_price"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="0.00"
              />
            </label>
            <label>
              Opening stock
              <input
                name="current_stock"
                type="number"
                min="0"
                required
                defaultValue={0}
              />
            </label>
            <label>
              Reorder level
              <input
                name="reorder_level"
                type="number"
                min="0"
                required
                defaultValue={10}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="button button-primary" type="submit">
              <Check size={15} /> Save product
            </button>
          </div>
        </form>
      )}
      <section className="surface inventory-table-surface">
        <div className="table-toolbar">
          <div>
            <p className="eyebrow">PRODUCT REGISTER</p>
            <h2>
              Stock overview{" "}
              <span className="heading-count">{products.length}</span>
            </h2>
          </div>
          <label className="search-field table-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search inventory"
            />
          </label>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>CATEGORY</th>
                <th>UNIT PRICE</th>
                <th>ON HAND</th>
                <th>REORDER AT</th>
                <th>SUPPLIER</th>
                {canManage && <th className="table-actions-heading">ACTION</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const low = product.current_stock <= product.reorder_level;
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="table-product">
                        <span className="product-monogram">
                          {product.name.slice(0, 1)}
                        </span>
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.sku}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="category-label">{product.category}</span>
                    </td>
                    <td>{preciseMoney(product.selling_price)}</td>
                    <td>
                      <span
                        className={`stock-status ${low ? "stock-status-low" : "stock-status-ok"}`}
                      >
                        <i />
                        {product.current_stock} units
                      </span>
                    </td>
                    <td>{product.reorder_level} units</td>
                    <td>{product.supplier_name || "—"}</td>
                    {canManage && (
                      <td className="table-actions-cell">
                        {adjustmentProduct === product.id ? (
                          <div className="inline-restock">
                            <input
                              type="number"
                              min="1"
                              max="100000"
                              value={adjustmentQuantity}
                              aria-label="Restock quantity"
                              onChange={(event) =>
                                setAdjustmentQuantity(event.target.value)
                              }
                            />
                            <button
                              className="icon-button inline-confirm"
                              aria-label={`Confirm restock ${product.name}`}
                              onClick={() => onRestock(product.id)}
                            >
                              <Check size={15} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label="Cancel restock"
                              onClick={() => setAdjustmentProduct(null)}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="icon-button row-action"
                            aria-label={`Restock ${product.name}`}
                            onClick={() => setAdjustmentProduct(product.id)}
                            title="Receive stock"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!products.length && (
          <EmptyState
            icon={Package}
            title="No products found"
            detail="Try changing the search, or add your first product."
          />
        )}
      </section>
      <div className="inventory-footnote">
        <ShieldCheck size={14} /> Every sale, return, and adjustment is recorded
        in the stock movement ledger.
      </div>
    </div>
  );
}

function ForecastView({
  forecast,
  horizon,
  loading,
  onHorizon,
}: {
  forecast: ForecastData | null;
  horizon: number;
  loading: boolean;
  onHorizon: (days: number) => void;
}) {
  return (
    <div className="view-stack page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">INTELLIGENCE / DECISION SUPPORT</p>
          <h1>
            Looking ahead<span className="heading-period">.</span>
          </h1>
          <p className="page-subtitle">
            An explainable view of likely demand, margin, and reorder pressure.
          </p>
        </div>
        <div className="horizon-switch" aria-label="Forecast horizon">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              className={horizon === days ? "horizon-active" : ""}
              onClick={() => onHorizon(days)}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>
      {forecast && (
        <div className="forecast-source">
          <span className="source-icon">
            <Sparkles size={15} />
          </span>
          <span>
            <strong>Model {forecast.model_version}</strong>
            <small>
              {forecast.data_source} ·{" "}
              {new Date(forecast.generated_at).toLocaleString()}
            </small>
          </span>
          <span className="synthetic-badge">DEMO DATA</span>
        </div>
      )}
      {loading && !forecast ? (
        <div className="loading-state">
          <LoaderCircle className="spin" size={23} />
          <span>Training and scoring forecast</span>
        </div>
      ) : forecast ? (
        <>
          <div className="forecast-summary-grid">
            <article className="forecast-summary forecast-summary-dark">
              <span>
                Projected gross profit <small>NEXT {horizon} DAYS</small>
              </span>
              <strong>{money(forecast.total_predicted_profit)}</strong>
              <p>
                <TrendingUp size={14} /> Product-level model estimate
              </p>
            </article>
            <article className="forecast-summary forecast-summary-pale">
              <span>
                Expected units sold <small>NEXT {horizon} DAYS</small>
              </span>
              <strong>
                {Math.round(forecast.total_predicted_demand).toLocaleString()}
              </strong>
              <p>
                <Activity size={14} /> Based on recent sales velocity
              </p>
            </article>
            <article className="forecast-summary forecast-summary-plain">
              <span>
                Products to review <small>MODEL REORDER POINT</small>
              </span>
              <strong>
                {forecast.products
                  .filter((item) => item.status === "reorder")
                  .length.toString()
                  .padStart(2, "0")}
              </strong>
              <p>
                <Bell size={14} /> Compare with supplier lead time
              </p>
            </article>
          </div>
          <section className="surface forecast-table-surface">
            <div className="table-toolbar">
              <div>
                <p className="eyebrow">PRODUCT-LEVEL OUTLOOK</p>
                <h2>Profit & stock signals</h2>
              </div>
              <span className="model-chip">
                <Activity size={14} /> Random Forest · {horizon}d
              </span>
            </div>
            <div className="table-scroll">
              <table className="data-table forecast-table">
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>DAILY RATE</th>
                    <th>PROJECTED PROFIT</th>
                    <th>EXPECTED DEMAND</th>
                    <th>REORDER POINT</th>
                    <th>STOCK STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.products.map((item) => (
                    <tr key={item.product_id}>
                      <td>
                        <div className="table-product">
                          <span className="product-monogram">
                            {item.name.slice(0, 1)}
                          </span>
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.category}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.daily_velocity.toFixed(1)}{" "}
                        <span className="muted-cell">/ day</span>
                      </td>
                      <td>
                        <strong>{money(item.predicted_profit)}</strong>
                      </td>
                      <td>{Math.round(item.predicted_demand)} units</td>
                      <td>{item.predicted_reorder_point} units</td>
                      <td>
                        <span
                          className={`stock-status ${item.status === "reorder" ? "stock-status-low" : "stock-status-ok"}`}
                        >
                          <i />
                          {item.status === "reorder"
                            ? "Review order"
                            : "On track"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="evaluation-grid">
            <section className="surface evaluation-surface">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">MODEL EVALUATION</p>
                  <h2>Compare before you trust</h2>
                </div>
                <span className="model-chip">
                  {forecast.evaluation.profit_holdout_rows} holdout rows
                </span>
              </div>
              <p className="evaluation-copy">
                Profit models scored on the same held-out synthetic records.
                Lower error is better; R² closer to 1 fits the fixture better.
              </p>
              <div className="table-scroll">
                <table className="data-table evaluation-table">
                  <thead>
                    <tr>
                      <th>MODEL</th>
                      <th>RMSE</th>
                      <th>MAE</th>
                      <th>R²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.evaluation.profit_comparison.map((model) => (
                      <tr key={model.model}>
                        <td>{model.model}</td>
                        <td>{preciseMoney(model.rmse)}</td>
                        <td>{preciseMoney(model.mae)}</td>
                        <td>{model.r2.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="caveat-note">
                <ShieldCheck size={15} />
                <span>{forecast.caveat}</span>
              </div>
            </section>
            <section className="surface drivers-surface">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">WHAT MOVES THE MODEL</p>
                  <h2>Most useful signals</h2>
                </div>
                <Activity size={17} className="muted-icon" />
              </div>
              <div className="drivers-list">
                {forecast.evaluation.feature_importance
                  .slice(0, 5)
                  .map((item, index) => (
                    <div className="driver-row" key={item.feature}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{item.feature.replaceAll("_", " ")}</strong>
                        <i>
                          <b
                            style={{
                              width: `${Math.max(7, item.importance * 100)}%`,
                            }}
                          />
                        </i>
                      </div>
                      <strong>{Math.round(item.importance * 100)}%</strong>
                    </div>
                  ))}
              </div>
              <p className="driver-footnote">
                Feature importance describes the model's use of each signal, not
                proof of causation.
              </p>
            </section>
          </div>
        </>
      ) : (
        <div className="surface empty-forecast">
          <EmptyState
            icon={Activity}
            title="Forecast unavailable"
            detail="Refresh the view once the model service is online."
          />
        </div>
      )}
    </div>
  );
}

function DemandEvaluation({ forecast }: { forecast: ForecastData }) {
  return (
    <section className="surface demand-comparison-surface page-enter">
      <div className="section-heading demand-comparison-heading">
        <div>
          <p className="eyebrow">DEMAND FORECAST / BASELINE CHECK</p>
          <h2>Does it improve on recent velocity?</h2>
        </div>
        <span className="model-chip">
          {forecast.evaluation.demand_holdout_rows} holdout rows
        </span>
      </div>
      <p className="demand-comparison-intro">
        Random Forest is compared with predicting each product's recent
        seven-day velocity on the same synthetic holdout.
      </p>
      <div className="table-scroll">
        <table className="data-table evaluation-table demand-comparison-table">
          <thead>
            <tr>
              <th>MODEL</th>
              <th>RMSE · UNITS</th>
              <th>MAE · UNITS</th>
              <th>R²</th>
            </tr>
          </thead>
          <tbody>
            {forecast.evaluation.demand_comparison.map((model) => (
              <tr key={model.model}>
                <td>{model.model}</td>
                <td>{model.rmse.toFixed(2)}</td>
                <td>{model.mae.toFixed(2)}</td>
                <td>{model.r2.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="demand-comparison-footnote">
        Synthetic holdout results are illustrative only; validate against a
        licensed, time-based retail dataset before relying on a forecast.
      </p>
    </section>
  );
}

function ReportsView({
  invoices,
  dashboard,
  onPrint,
}: {
  invoices: Invoice[];
  dashboard: DashboardData | null;
  onPrint: (invoice: Invoice) => void;
}) {
  function downloadCsv() {
    const rows = [
      ["Invoice", "Date", "Items", "Payment", "Total"],
      ...invoices.map((invoice) => [
        invoice.invoice_number,
        invoice.created_at,
        String(invoice.items.reduce((sum, item) => sum + item.quantity, 0)),
        invoice.payment_mode,
        invoice.total,
      ]),
    ];
    const content = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    link.download = "velaire-sales.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <div className="view-stack page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RECORDS / STORE PERFORMANCE</p>
          <h1>
            Reports<span className="heading-period">.</span>
          </h1>
          <p className="page-subtitle">
            Invoices and business totals, directly from the transaction ledger.
          </p>
        </div>
        <button className="button button-primary" onClick={downloadCsv}>
          <Download size={16} /> Download CSV
        </button>
      </div>
      <div className="report-summary-row">
        <div>
          <small>Gross sales · 30 days</small>
          <strong>{money(dashboard?.kpis.revenue)}</strong>
        </div>
        <div>
          <small>Gross profit · 30 days</small>
          <strong>{money(dashboard?.kpis.gross_profit)}</strong>
        </div>
        <div>
          <small>Transactions · 30 days</small>
          <strong>{dashboard?.kpis.transactions ?? 0}</strong>
        </div>
        <div>
          <small>Recorded invoices</small>
          <strong>{invoices.length}</strong>
        </div>
      </div>
      <section className="surface report-table-surface">
        <div className="table-toolbar">
          <div>
            <p className="eyebrow">TRANSACTION REGISTER</p>
            <h2>Sales ledger</h2>
          </div>
          <span className="model-chip">
            <ShieldCheck size={14} /> Persisted records
          </span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>INVOICE</th>
                <th>DATE</th>
                <th>ITEMS</th>
                <th>PAYMENT</th>
                <th>CASHIER</th>
                <th>TOTAL</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <strong className="invoice-id">
                      {invoice.invoice_number}
                    </strong>
                  </td>
                  <td>
                    {new Date(invoice.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    {invoice.items.reduce(
                      (sum, item) => sum + item.quantity,
                      0,
                    )}{" "}
                    items
                  </td>
                  <td>
                    <span className="payment-label">
                      {invoice.payment_mode.replace("_", " ")}
                    </span>
                  </td>
                  <td>Store team</td>
                  <td>
                    <strong>{preciseMoney(invoice.total)}</strong>
                  </td>
                  <td>
                    <button
                      className="icon-button row-action"
                      aria-label={`Print ${invoice.invoice_number}`}
                      onClick={() => onPrint(invoice)}
                    >
                      <Printer size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!invoices.length && (
          <EmptyState
            icon={FileBarChart}
            title="No reports yet"
            detail="Recorded sales will appear in this register."
          />
        )}
      </section>
      <div className="report-disclaimer">
        <ShieldCheck size={15} />
        <span>
          For operational insight only. Forecast metrics based on a synthetic
          training fixture are not financial guidance.
        </span>
      </div>
    </div>
  );
}

function AssistantPanel({
  chat,
  input,
  setInput,
  busy,
  onSubmit,
  onClose,
  onSuggestion,
}: {
  chat: ChatLine[];
  input: string;
  setInput: (value: string) => void;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onSuggestion: (value: string) => void;
}) {
  return (
    <section className="assistant-panel" aria-label="Velaire assistant">
      <header className="assistant-header">
        <span className="assistant-avatar">
          <Sparkles size={17} />
        </span>
        <div>
          <strong>Velaire assistant</strong>
          <small>
            <i /> Store-aware · permission checked
          </small>
        </div>
        <button
          className="icon-button"
          aria-label="Close assistant"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>
      <div className="assistant-context">
        <span>
          <ShieldCheck size={13} /> Replies use your live store records
        </span>
      </div>
      <div className="assistant-messages" aria-live="polite">
        {chat.map((line) => (
          <div className={`chat-line chat-${line.from}`} key={line.id}>
            {line.from === "assistant" && (
              <span className="chat-avatar">
                <Sparkles size={12} />
              </span>
            )}
            <p>{line.text}</p>
          </div>
        ))}
        {busy && (
          <div className="chat-line chat-assistant">
            <span className="chat-avatar">
              <Sparkles size={12} />
            </span>
            <p className="typing-dots">
              <i />
              <i />
              <i />
            </p>
          </div>
        )}
      </div>
      <div className="assistant-suggestions">
        <button onClick={() => onSuggestion("Which products are low stock?")}>
          Low stock
        </button>
        <button onClick={() => onSuggestion("Summarize sales today")}>
          Today's sales
        </button>
        <button onClick={() => onSuggestion("Stock for Market greens")}>
          Check stock
        </button>
      </div>
      <form className="assistant-input" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about your store…"
          aria-label="Message Velaire assistant"
          maxLength={500}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!input.trim() || busy}
        >
          <Send size={16} />
        </button>
      </form>
      <p className="assistant-disclaimer">
        Actions require an exact product and a permitted role.
      </p>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
  compact = false,
}: {
  icon: typeof Package;
  title: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "empty-state-compact" : ""}`}>
      <span>
        <Icon size={18} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function Receipt({ invoice }: { invoice: Invoice }) {
  return (
    <div className="receipt">
      <div className="receipt-header">
        <BrandGlyph size={22} />
        <span>VELAIRE MARKET</span>
        <small>SALE RECEIPT</small>
      </div>
      <div className="receipt-meta">
        <span>{invoice.invoice_number}</span>
        <span>{new Date(invoice.created_at).toLocaleString()}</span>
      </div>
      <div className="receipt-lines">
        {invoice.items.map((item) => (
          <div key={`${item.sku}-${item.quantity}`}>
            <span>
              {item.quantity} × {item.product_name}
            </span>
            <span>{preciseMoney(item.line_total)}</span>
          </div>
        ))}
      </div>
      <div className="receipt-total">
        <strong>Total paid</strong>
        <strong>{preciseMoney(invoice.total)}</strong>
      </div>
      <p>Thank you for shopping local.</p>
    </div>
  );
}

export default App;
