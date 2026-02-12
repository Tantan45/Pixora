import { useEffect, useMemo, useState } from "react";
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

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal, itemCount, clearCart } = useCart();
  const { products, updateProduct } = useProducts();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
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

  useEffect(() => {
    if (!isCheckoutOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsCheckoutOpen(false);
        setIsOrderPlaced(false);
        setCheckoutError("");
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCheckoutOpen]);

  const openCheckoutPopup = () => {
    setIsOrderPlaced(false);
    setCheckoutError("");
    setPlacedOrder(null);
    setIsCheckoutOpen(true);
  };

  const closeCheckoutPopup = () => {
    setIsCheckoutOpen(false);
    setIsOrderPlaced(false);
    setCheckoutError("");
    setPlacedOrder(null);
  };

  const handlePlaceOrder = async () => {
    if (!items.length || isPlacingOrder) return;

    setIsPlacingOrder(true);
    setCheckoutError("");

    const auth = await resolveAuthState();
    if (!auth.isAuthenticated || !auth.email) {
      setCheckoutError("Please sign in first before placing an order.");
      setIsPlacingOrder(false);
      return;
    }

    const stockIssues = items.filter((item) => item.quantity > getCurrentStock(item));
    if (stockIssues.length) {
      const names = stockIssues.map((item) => item.name).join(", ");
      setCheckoutError(
        `Insufficient stock for: ${names}. Please adjust cart quantity and try again.`,
      );
      setIsPlacingOrder(false);
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
    setIsOrderPlaced(true);
    setIsPlacingOrder(false);
  };

  if (items.length === 0 && !isCheckoutOpen) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="serif text-3xl font-semibold text-slate-900">Your cart is empty</h1>
        <p className="mt-3 text-sm text-slate-600">Browse curated cameras and accessories to start building your kit.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/shop"
            className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            Back to shop
          </Link>
          <Link
            to="/orders"
            className="inline-flex rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
          >
            View orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="serif text-3xl font-semibold text-slate-900">Cart ({itemCount} items)</h1>
            <Link to="/shop" className="text-sm font-semibold text-slate-600">Continue shopping</Link>
          </div>
          <div className="space-y-4">
            {items.map((item) => {
              const stock = getCurrentStock(item);
              const canIncrease = item.quantity < stock;

              return (
                <div
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="grid gap-4 md:grid-cols-[140px_1fr_auto] items-center">
                    <div
                      className="h-28 rounded-2xl bg-cover bg-center"
                      style={{ backgroundImage: `url(${item.image})` }}
                      aria-label={item.name}
                    />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{item.category}</p>
                      <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-600">{formatPrice(item.price)}</p>
                      <p className="mt-1 text-xs text-slate-500">Stock: {stock}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="h-8 w-8 rounded-full border border-slate-200 text-slate-700 hover:border-slate-300"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              Math.min(item.quantity + 1, stock),
                            )
                          }
                          disabled={!canIncrease}
                          className={`h-8 w-8 rounded-full border text-slate-700 ${
                            canIncrease
                              ? "border-slate-200 hover:border-slate-300"
                              : "border-slate-100 cursor-not-allowed text-slate-300"
                          }`}
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="ml-4 text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Remove
                        </button>
                      </div>
                      {!canIncrease && stock > 0 && (
                        <p className="mt-2 text-xs text-amber-600">
                          Max quantity reached for this item.
                        </p>
                      )}
                      {stock <= 0 && (
                        <p className="mt-2 text-xs text-rose-600">
                          Out of stock. Remove this item or wait for restock.
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-900">
                      {formatPrice(item.price * item.quantity)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="serif text-2xl font-semibold text-slate-900">Order summary</h2>
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
            <button
              type="button"
              onClick={openCheckoutPopup}
              className="mt-6 block w-full rounded-full bg-[var(--accent)] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Proceed to checkout
            </button>
            <p className="mt-3 text-xs text-slate-500">Sign in is required before final checkout.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Need help?</p>
            <p className="mt-2">Chat with our gear advisors for bundle recommendations.</p>
          </div>
        </aside>
      </div>

      {isCheckoutOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close checkout popup"
            onClick={closeCheckoutPopup}
            className="absolute inset-0 bg-slate-900/55"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-popup-title"
            className="relative z-10 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <button
              type="button"
              onClick={closeCheckoutPopup}
              className="absolute right-4 top-4 rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Close
            </button>

            {!isOrderPlaced ? (
              <>
                <h2 id="checkout-popup-title" className="serif text-2xl font-semibold text-slate-900">
                  Checkout
                </h2>
                <p className="mt-1 text-sm text-slate-600">Review your order before placing it.</p>

                <div className="mt-5 max-h-64 space-y-3 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          Qty {item.quantity} x {formatPrice(item.price)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-base font-semibold text-slate-900">
                    <span>Total</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                </div>

                {checkoutError && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {checkoutError}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeCheckoutPopup}
                    className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={items.length === 0 || isPlacingOrder}
                    className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPlacingOrder ? "Placing order..." : "Place order"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  If auto-confirm is enabled in admin settings, this order will be confirmed immediately.
                </p>
              </>
            ) : (
              <div className="py-6 text-center">
                <h2 id="checkout-popup-title" className="serif text-3xl font-semibold text-slate-900">
                  Order placed
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Order #{shortOrderId(placedOrder?.id)} was submitted successfully.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Status: {ORDER_STATUS_LABELS[placedOrder?.status] ?? "Pending"}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={closeCheckoutPopup}
                    className="inline-flex rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
                  >
                    Close
                  </button>
                  <Link
                    to="/orders"
                    onClick={closeCheckoutPopup}
                    className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                  >
                    View my orders
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
