import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { resolveAuthState } from "../../lib/auth";
import { useProducts } from "../../context/ProductsContext";
import {
  ORDER_STATUS_LABELS,
  ORDER_STORAGE_KEY,
  SHIPPING_STATUS_LABELS,
  canOrderBeCancelled,
  cancelOrder,
  getOrdersForUser,
} from "../../lib/orders";

const formatPrice = (value) => `PHP ${Number(value).toLocaleString("en-PH")}`;
const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

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

const shortOrderId = (id) => String(id ?? "").slice(0, 8).toUpperCase();

export default function Orders() {
  const { adjustStock } = useProducts();
  const [auth, setAuth] = useState({
    checked: false,
    isAuthenticated: false,
    email: "",
  });
  const [orders, setOrders] = useState([]);
  const [cancellingOrderId, setCancellingOrderId] = useState("");
  const [actionError, setActionError] = useState("");

  const refreshOrders = useCallback((email) => {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!normalizedEmail) {
      setOrders([]);
      return;
    }
    setOrders(getOrdersForUser(normalizedEmail));
  }, []);

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      const state = await resolveAuthState();
      if (!isActive) return;
      setAuth({
        checked: true,
        isAuthenticated: state.isAuthenticated,
        email: state.email ?? "",
      });
      refreshOrders(state.email);
    }

    bootstrap();
    return () => {
      isActive = false;
    };
  }, [refreshOrders]);

  useEffect(() => {
    if (!auth.email) return undefined;

    const handleStorage = (event) => {
      if (!event.key || event.key === ORDER_STORAGE_KEY) {
        refreshOrders(auth.email);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [auth.email, refreshOrders]);

  const handleCancelOrder = (order) => {
    if (!order || !auth.email || cancellingOrderId) return;

    setActionError("");
    if (!canOrderBeCancelled(order)) {
      setActionError("This order can no longer be cancelled.");
      return;
    }

    setCancellingOrderId(order.id);
    const cancelled = cancelOrder(order.id, auth.email);

    if (!cancelled) {
      setActionError("Unable to cancel order right now. Please refresh and try again.");
      setCancellingOrderId("");
      return;
    }

    order.items.forEach((item) => {
      adjustStock(item.product_id, item.quantity);
    });

    refreshOrders(auth.email);
    setCancellingOrderId("");
  };

  if (!auth.checked) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
        Checking your account...
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="serif text-3xl font-semibold text-slate-900">My orders</h1>
        <p className="mt-3 text-sm text-slate-600">
          Sign in first to view your order and shipping logs.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
          <Link
            to="/shop"
            className="inline-flex rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="serif text-3xl font-semibold text-slate-900">No orders yet</h1>
        <p className="mt-3 text-sm text-slate-600">
          Your placed orders will appear here with shipping updates.
        </p>
        <Link
          to="/shop"
          className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Orders</p>
            <h1 className="serif mt-2 text-3xl font-semibold text-slate-900">
              Shipping and purchase log
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Signed in as <span className="font-semibold">{auth.email}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => refreshOrders(auth.email)}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>
        {actionError && (
          <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError}
          </p>
        )}
      </section>

      {orders.map((order) => (
        <section
          key={order.id}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Order #{shortOrderId(order.id)}
              </h2>
              <p className="text-xs text-slate-500">
                Placed {formatDateTime(order.created_at)}
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
                {SHIPPING_STATUS_LABELS[order.shipping_status] ?? "Shipping update pending"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {order.items.map((item) => (
              <div
                key={`${order.id}-${item.product_id}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                <p className="text-xs text-slate-500">
                  Qty {item.quantity} x {formatPrice(item.unit_price)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Timeline
            </p>
            <div className="mt-2 space-y-2">
              {order.timeline.map((entry) => (
                <div key={entry.id} className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{entry.message}</span>
                  <span className="ml-2 text-slate-500">{formatDateTime(entry.at)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-900">
            <span>Total</span>
            <div className="flex items-center gap-3">
              <span>{formatPrice(order.subtotal)}</span>
              {canOrderBeCancelled(order) && (
                <button
                  type="button"
                  onClick={() => handleCancelOrder(order)}
                  disabled={cancellingOrderId === order.id}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancellingOrderId === order.id ? "Cancelling..." : "Cancel order"}
                </button>
              )}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
