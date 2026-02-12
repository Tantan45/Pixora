import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { categories, products as seedProducts } from "../../data/products";
import { useProducts } from "../../context/ProductsContext";
import { resolveAuthState, signOutEverywhere } from "../../lib/auth";
import {
  ORDER_STATUS_LABELS,
  SHIPPING_STATUS_LABELS,
  SHIPPING_STATUS_OPTIONS,
  confirmOrder,
  getAutoConfirmOrders,
  getRevenueMetrics,
  loadOrders,
  setAutoConfirmOrders,
  updateShippingStatus,
} from "../../lib/orders";

const formatPrice = (value) => `PHP ${Number(value).toLocaleString("en-PH")}`;
const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getDefaultCategory = () => categories[0]?.name ?? "Cameras";
const toStockValue = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const buildId = (name) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-");
  return `${base || "item"}-${Date.now()}`;
};

const buildPriceDrafts = (items) =>
  Object.fromEntries(items.map((item) => [item.id, String(item.price)]));

const buildStockDrafts = (items) =>
  Object.fromEntries(items.map((item) => [item.id, String(toStockValue(item.stock))]));

const shortOrderId = (id) => String(id ?? "").slice(0, 8).toUpperCase();

const orderStatusClass = (status) => {
  if (status === "confirmed") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  if (status === "pending") {
    return "bg-amber-100 text-amber-800 border border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
};

const shippingStatusClass = (status) => {
  if (status === "delivered") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  if (status === "shipped") {
    return "bg-blue-100 text-blue-800 border border-blue-200";
  }
  if (status === "processing") {
    return "bg-violet-100 text-violet-800 border border-violet-200";
  }
  if (status === "awaiting_confirmation") {
    return "bg-amber-100 text-amber-800 border border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
};

const SALE_CALENDAR_STORAGE_KEY = "pixoraAnnualSaleCalendar";
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DEFAULT_CAMPAIGNS = [
  "New Year Creator Sale",
  "Love Month Bundle Drop",
  "Summer Gear Refresh",
  "Holy Week Essentials",
  "Mid-Year Camera Upgrade",
  "Rainy Season Studio Sale",
  "Freelancer Boost Week",
  "Back-to-School Creator Sale",
  "Ber Months Kickoff",
  "10.10 Pro Gear Deals",
  "11.11 Mega Sale",
  "Holiday Year-End Blowout",
];
const DEFAULT_RENEWAL_TARGETS = [
  28000, 22000, 25000, 28000, 27000, 26000, 36000, 34000, 38000, 31000, 52000,
  25000,
];
const DEFAULT_NEW_REVENUE_TARGETS = [
  40000, 34000, 35000, 39000, 26000, 30000, 39000, 29000, 36000, 41000, 41000,
  34000,
];

const toMoneyValue = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
};

const toDateInput = (year, month, day) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const buildDefaultSaleCalendar = (year = new Date().getFullYear()) =>
  MONTH_LABELS.map((monthName, index) => {
    const month = index + 1;
    return {
      monthIndex: index,
      monthName,
      campaign: DEFAULT_CAMPAIGNS[index],
      startDate: toDateInput(year, month, 8),
      endDate: toDateInput(year, month, 15),
      discount: index >= 10 ? "Up to 35%" : "Up to 20%",
      renewalsTarget: DEFAULT_RENEWAL_TARGETS[index] ?? 25000,
      newRevenueTarget: DEFAULT_NEW_REVENUE_TARGETS[index] ?? 30000,
      notes: "",
    };
  });

const normalizeSaleMonth = (value, index, year = new Date().getFullYear()) => {
  const fallback = buildDefaultSaleCalendar(year)[index];
  if (!value || typeof value !== "object") return fallback;
  return {
    monthIndex: index,
    monthName: MONTH_LABELS[index],
    campaign:
      typeof value.campaign === "string" && value.campaign.trim()
        ? value.campaign
        : fallback.campaign,
    startDate:
      typeof value.startDate === "string" && value.startDate
        ? value.startDate
        : fallback.startDate,
    endDate:
      typeof value.endDate === "string" && value.endDate
        ? value.endDate
        : fallback.endDate,
    discount:
      typeof value.discount === "string" && value.discount.trim()
        ? value.discount
        : fallback.discount,
    renewalsTarget: toMoneyValue(
      value.renewalsTarget,
      fallback.renewalsTarget ?? 0,
    ),
    newRevenueTarget: toMoneyValue(
      value.newRevenueTarget,
      fallback.newRevenueTarget ?? 0,
    ),
    notes: typeof value.notes === "string" ? value.notes : "",
  };
};

const loadSaleCalendar = () => {
  if (typeof window === "undefined") return buildDefaultSaleCalendar();
  const stored = localStorage.getItem(SALE_CALENDAR_STORAGE_KEY);
  if (!stored) return buildDefaultSaleCalendar();

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length !== 12) {
      return buildDefaultSaleCalendar();
    }
    return parsed.map((item, index) => normalizeSaleMonth(item, index));
  } catch {
    return buildDefaultSaleCalendar();
  }
};

export default function Admin() {
  const navigate = useNavigate();
  const { products, setProducts, addProduct, updateProduct, removeProduct } =
    useProducts();

  const [auth, setAuth] = useState({
    checked: false,
    isAuthed: false,
    email: "",
  });

  const [priceDrafts, setPriceDrafts] = useState(() => buildPriceDrafts(products));
  const [stockDrafts, setStockDrafts] = useState(() => buildStockDrafts(products));
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [orders, setOrders] = useState(() => loadOrders());
  const [autoConfirm, setAutoConfirm] = useState(() => getAutoConfirmOrders());
  const [saleCalendar, setSaleCalendar] = useState(() => loadSaleCalendar());

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: getDefaultCategory(),
    price: "",
    stock: "12",
    image: "",
  });

  const refreshOrders = useCallback(() => {
    setOrders(loadOrders());
  }, []);

  useEffect(() => {
    let isActive = true;

    async function checkAuth() {
      const state = await resolveAuthState();
      if (!isActive) return;

      setAuth({
        checked: true,
        isAuthed: Boolean(state.isAuthenticated && state.isAdmin),
        email: state.email ?? "",
      });
    }

    checkAuth();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setPriceDrafts(buildPriceDrafts(products));
    setStockDrafts(buildStockDrafts(products));
  }, [products]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (!event.key || event.key === "pixoraOrders") {
        refreshOrders();
      }
      if (!event.key || event.key === "pixoraAutoConfirmOrders") {
        setAutoConfirm(getAutoConfirmOrders());
      }
      if (!event.key || event.key === SALE_CALENDAR_STORAGE_KEY) {
        setSaleCalendar(loadSaleCalendar());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refreshOrders]);

  const productMetrics = useMemo(() => {
    const totalProducts = products.length;
    const totalUnits = products.reduce(
      (sum, item) => sum + toStockValue(item.stock),
      0,
    );
    const inventoryValue = products.reduce(
      (sum, item) => sum + Number(item.price || 0) * toStockValue(item.stock),
      0,
    );
    const lowStockCount = products.filter(
      (item) => toStockValue(item.stock) <= 5,
    ).length;

    return {
      totalProducts,
      totalUnits,
      inventoryValue,
      lowStockCount,
    };
  }, [products]);

  const revenueMetrics = useMemo(() => getRevenueMetrics(orders), [orders]);
  const saleChartMetrics = useMemo(() => {
    const points = saleCalendar.map((month, index) => {
      const renewals = toMoneyValue(
        month.renewalsTarget,
        DEFAULT_RENEWAL_TARGETS[index] ?? 0,
      );
      const newRevenue = toMoneyValue(
        month.newRevenueTarget,
        DEFAULT_NEW_REVENUE_TARGETS[index] ?? 0,
      );
      const total = renewals + newRevenue;
      return {
        monthIndex: month.monthIndex,
        monthName: month.monthName,
        monthShort: month.monthName.slice(0, 3),
        renewals,
        newRevenue,
        total,
      };
    });

    const averageTotal = points.length
      ? points.reduce((sum, month) => sum + month.total, 0) / points.length
      : 0;
    const maxTotal = Math.max(
      1,
      ...points.map((month) => month.total),
      Math.ceil(averageTotal),
    );

    return {
      points,
      averageTotal,
      maxTotal,
    };
  }, [saleCalendar]);

  if (!auth.checked) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
        Checking admin access...
      </div>
    );
  }

  if (!auth.isAuthed) {
    return <Navigate to="/login" replace />;
  }

  const handleSignOut = async () => {
    await signOutEverywhere();
    navigate("/login");
  };

  const handlePriceDraftChange = (id, value) => {
    setPriceDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const handleStockDraftChange = (id, value) => {
    setStockDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const handlePriceSave = (id) => {
    const draft = priceDrafts[id];
    const nextPrice = Number(draft);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) return;
    updateProduct(id, { price: Math.floor(nextPrice) });
  };

  const handleStockSave = (id) => {
    const draft = stockDrafts[id];
    const nextStock = Number(draft);
    if (!Number.isFinite(nextStock) || nextStock < 0) return;
    updateProduct(id, { stock: Math.floor(nextStock) });
  };

  const handleDeleteProduct = (id) => {
    removeProduct(id);
    setPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setStockDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRestoreProducts = () => {
    setProducts(seedProducts);
    setShowAddForm(false);
    setFormError("");
  };

  const handleAddProductSubmit = (event) => {
    event.preventDefault();
    setFormError("");

    if (!newProduct.name.trim() || newProduct.price === "") {
      setFormError("Name and price are required.");
      return;
    }

    const priceValue = Number(newProduct.price);
    const stockValue = Number(newProduct.stock);

    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setFormError("Price must be a valid non-negative number.");
      return;
    }

    if (!Number.isFinite(stockValue) || stockValue < 0) {
      setFormError("Stock must be a valid non-negative number.");
      return;
    }

    const id = buildId(newProduct.name);
    const product = {
      id,
      name: newProduct.name.trim(),
      category: newProduct.category || getDefaultCategory(),
      price: Math.floor(priceValue),
      stock: Math.floor(stockValue),
      image: newProduct.image || seedProducts[0]?.image,
      description: "New product added from admin.",
      highlights: ["New listing"],
    };

    addProduct(product);
    setNewProduct({
      name: "",
      category: getDefaultCategory(),
      price: "",
      stock: "12",
      image: "",
    });
    setShowAddForm(false);
  };

  const handleAutoConfirmToggle = (enabled) => {
    setAutoConfirm(enabled);
    setAutoConfirmOrders(enabled);
  };

  const handleConfirmOrder = (orderId) => {
    confirmOrder(orderId, auth.email || "admin");
    refreshOrders();
  };

  const handleShippingStatusChange = (orderId, status) => {
    updateShippingStatus(orderId, status, auth.email || "admin");
    refreshOrders();
  };

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Admin</p>
            <h1 className="serif mt-2 text-3xl sm:text-4xl font-semibold text-slate-900">
              Pixora operations dashboard
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Manage products, inventory, customer orders, and shipping logs.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Signed in as {auth.email || "admin"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/shop"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              View storefront
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total products</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {productMetrics.totalProducts}
          </p>
          <p className="mt-2 text-sm text-slate-500">Active SKUs in catalog</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Inventory units</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {productMetrics.totalUnits}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {productMetrics.lowStockCount} low-stock items
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total revenue</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatPrice(revenueMetrics.totalRevenue)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Confirmed orders: {revenueMetrics.confirmedCount}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">This month</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatPrice(revenueMetrics.monthRevenue)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Pending orders: {revenueMetrics.pendingCount}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="serif text-2xl font-semibold text-slate-900">Order automation</h2>
            <p className="mt-1 text-sm text-slate-600">
              Auto-confirm new orders after checkout.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={autoConfirm}
              onChange={(event) => handleAutoConfirmToggle(event.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {autoConfirm ? "Enabled" : "Disabled"}
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="serif text-2xl font-semibold text-slate-900">
            Annual sale calendar
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Projected monthly sales trend for renewals and new revenue.
          </p>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Annual sales projection
              </p>
              <p className="text-xs text-slate-500">
                Stack view of renewals + new revenue by month
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Average
              </p>
              <p className="text-sm font-semibold text-rose-600">
                {formatPrice(Math.round(saleChartMetrics.averageTotal))}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="relative">
                <div
                  className="absolute inset-x-0 z-10 border-t border-dashed border-rose-400"
                  style={{
                    top: `${100 - (saleChartMetrics.averageTotal / saleChartMetrics.maxTotal) * 100}%`,
                  }}
                />
                <div className="grid h-56 grid-cols-12 gap-3 items-end">
                  {saleChartMetrics.points.map((month) => (
                    <div
                      key={`bar-${month.monthName}`}
                      className="mx-auto flex h-full w-11 flex-col justify-end overflow-hidden rounded-md border border-slate-200 bg-slate-100/80"
                    >
                      <div
                        className="bg-emerald-700"
                        style={{
                          height: `${(month.renewals / saleChartMetrics.maxTotal) * 100}%`,
                        }}
                        title={`${month.monthShort} renewals: ${formatPrice(month.renewals)}`}
                      />
                      <div
                        className="bg-emerald-400"
                        style={{
                          height: `${(month.newRevenue / saleChartMetrics.maxTotal) * 100}%`,
                        }}
                        title={`${month.monthShort} new revenue: ${formatPrice(month.newRevenue)}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-12 gap-3">
                {saleChartMetrics.points.map((month) => (
                  <div key={`label-${month.monthName}`} className="text-center">
                    <p className="text-[11px] font-semibold text-slate-700">
                      {month.monthShort}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {(month.total / 1000).toFixed(0)}k
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-emerald-700" />
              Renewals
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-emerald-400" />
              New Revenue
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-0 w-6 border-t border-dashed border-rose-400" />
              Average: {formatPrice(Math.round(saleChartMetrics.averageTotal))}
            </span>
          </div>
        </div>

      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="serif text-2xl font-semibold text-slate-900">
              Product inventory
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreProducts}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-900 hover:text-white"
              >
                Restore default items
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm((prev) => !prev)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-900 hover:text-white"
              >
                {showAddForm ? "Close" : "Add product"}
              </button>
            </div>
          </div>

          {showAddForm && (
            <form
              onSubmit={handleAddProductSubmit}
              className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  Name
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="Product name"
                    value={newProduct.name}
                    onChange={(event) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Category
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    value={newProduct.category}
                    onChange={(event) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        category: event.target.value,
                      }))
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Price (PHP)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="0"
                    value={newProduct.price}
                    onChange={(event) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        price: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Stock
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="0"
                    value={newProduct.stock}
                    onChange={(event) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        stock: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                  Image URL
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="https://..."
                    value={newProduct.image}
                    onChange={(event) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        image: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              {formError && <p className="text-xs text-rose-600">{formError}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                >
                  Save product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError("");
                  }}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 space-y-3">
            {products.map((item) => {
              const isLowStock = toStockValue(item.stock) <= 5;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.category}</p>
                      {isLowStock && (
                        <p className="mt-1 text-xs font-semibold text-amber-600">
                          Low stock alert
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(item.id)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-[10px] uppercase tracking-wide text-slate-500">
                      Price
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
                          value={priceDrafts[item.id] ?? String(item.price ?? "")}
                          onChange={(event) =>
                            handlePriceDraftChange(item.id, event.target.value)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => handlePriceSave(item.id)}
                          className="text-xs font-semibold text-[var(--accent)] hover:text-slate-900"
                        >
                          Save
                        </button>
                      </div>
                    </label>

                    <label className="text-[10px] uppercase tracking-wide text-slate-500">
                      Stock
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
                          value={stockDrafts[item.id] ?? String(item.stock ?? "")}
                          onChange={(event) =>
                            handleStockDraftChange(item.id, event.target.value)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => handleStockSave(item.id)}
                          className="text-xs font-semibold text-[var(--accent)] hover:text-slate-900"
                        >
                          Save
                        </button>
                      </div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-[var(--paper)] p-6 shadow-sm">
          <h2 className="serif text-2xl font-semibold text-slate-900">Revenue snapshot</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatPrice(revenueMetrics.todayRevenue)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">This month</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatPrice(revenueMetrics.monthRevenue)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Inventory value</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatPrice(productMetrics.inventoryValue)}
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            Revenue is calculated from confirmed orders only.
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="serif text-2xl font-semibold text-slate-900">Customer orders</h2>
          <button
            type="button"
            onClick={refreshOrders}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Refresh orders
          </button>
        </div>

        {!orders.length ? (
          <p className="mt-4 text-sm text-slate-600">
            No orders yet. Orders will appear here once customers checkout.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Order #{shortOrderId(order.id)}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {order.user_email || "Unknown user"} - {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusClass(order.status)}`}
                    >
                      {ORDER_STATUS_LABELS[order.status] ?? "Unknown"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${shippingStatusClass(order.shipping_status)}`}
                    >
                      {SHIPPING_STATUS_LABELS[order.shipping_status] ?? "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {order.items.map((item) => (
                    <div
                      key={`${order.id}-${item.product_id}`}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                      <p className="text-xs text-slate-500">
                        Qty {item.quantity} x {formatPrice(item.unit_price)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Total: {formatPrice(order.subtotal)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {order.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleConfirmOrder(order.id)}
                        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Confirm order
                      </button>
                    )}
                    <select
                      value={order.shipping_status}
                      onChange={(event) =>
                        handleShippingStatusChange(order.id, event.target.value)
                      }
                      disabled={order.status === "pending"}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {SHIPPING_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {SHIPPING_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Timeline</p>
                  <div className="mt-1 space-y-1">
                    {order.timeline.map((entry) => (
                      <p key={entry.id} className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">{entry.message}</span>
                        <span className="ml-2 text-slate-500">{formatDate(entry.at)}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
