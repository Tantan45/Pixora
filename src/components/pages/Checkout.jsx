import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useProducts } from "../../context/ProductsContext";
import { resolveAuthState } from "../../lib/auth";
import {
  ORDER_STATUS_LABELS,
  createOrder,
  getAutoConfirmOrders,
} from "../../lib/orders";

const formatPrice = (value) => `PHP ${Number(value).toLocaleString("en-PH")}`;
const toStock = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};
const shortOrderId = (id) => String(id ?? "").slice(0, 8).toUpperCase();

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { products, updateProduct } = useProducts();
  const [isPlaced, setIsPlaced] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [placedOrder, setPlacedOrder] = useState(null);

  const stockById = useMemo(
    () =>
      new Map(
        products.map((product) => [product.id, toStock(product.stock)]),
      ),
    [products],
  );

  const getCurrentStock = (item) => {
    const catalogStock = stockById.get(item.id);
    if (Number.isFinite(catalogStock)) return catalogStock;
    return toStock(item.stock);
  };

  const handlePlaceOrder = async () => {
    if (!items.length || isPlacing) return;

    setIsPlacing(true);
    setCheckoutError("");

    const auth = await resolveAuthState();
    if (!auth.isAuthenticated || !auth.email) {
      setCheckoutError("Please sign in first before placing an order.");
      setIsPlacing(false);
      return;
    }

    const stockIssues = items.filter((item) => item.quantity > getCurrentStock(item));
    if (stockIssues.length) {
      const names = stockIssues.map((item) => item.name).join(", ");
      setCheckoutError(
        `Insufficient stock for: ${names}. Please adjust cart quantity and try again.`,
      );
      setIsPlacing(false);
      return;
    }

    const order = createOrder({
      userId: auth.user?.id ?? null,
      userEmail: auth.email,
      subtotal,
      autoConfirm: getAutoConfirmOrders(),
      items: items.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        unit_price: item.price,
        quantity: item.quantity,
        image: item.image,
        category: item.category,
      })),
    });

    items.forEach((item) => {
      const currentStock = getCurrentStock(item);
      updateProduct(item.id, {
        stock: Math.max(0, currentStock - item.quantity),
      });
    });

    clearCart();
    setPlacedOrder(order);
    setIsPlaced(true);
    setIsPlacing(false);
  };

  if (!items.length && !isPlaced) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="serif text-3xl font-semibold text-slate-900">
          Checkout list is empty
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Add products to your cart first, then return to checkout.
        </p>
        <Link
          to="/shop"
          className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  if (isPlaced) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="serif text-3xl font-semibold text-slate-900">
          Order placed
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Order #{shortOrderId(placedOrder?.id)} was submitted successfully.
        </p>
        <p className="text-xs text-slate-500">
          Status: {ORDER_STATUS_LABELS[placedOrder?.status] ?? "Pending"}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/shop"
            className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            Continue shopping
          </Link>
          <Link
            to="/orders"
            className="inline-flex rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
          >
            View my orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="serif text-3xl font-semibold text-slate-900">
            Checkout list
          </h1>
          <Link to="/cart" className="text-sm font-semibold text-slate-600">
            Back to cart
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    Qty {item.quantity} x {formatPrice(item.price)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {formatPrice(item.quantity * item.price)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="serif text-2xl font-semibold text-slate-900">
            Payment summary
          </h2>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tax</span>
              <span>Included</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {checkoutError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {checkoutError}
            </div>
          )}
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isPlacing}
            className="mt-6 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPlacing ? "Placing order..." : "Place order"}
          </button>
          <p className="mt-3 text-xs text-slate-500">
            Sign in is required to place orders and track shipping logs.
          </p>
        </div>
      </aside>
    </div>
  );
}
