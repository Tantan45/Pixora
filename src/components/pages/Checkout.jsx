import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";

const formatPrice = (value) => `PHP ${Number(value).toLocaleString("en-PH")}`;

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const [isPlaced, setIsPlaced] = useState(false);

  const handlePlaceOrder = () => {
    clearCart();
    setIsPlaced(true);
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
          Your checkout list was submitted successfully.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/shop"
            className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
          >
            Continue shopping
          </Link>
          <Link
            to="/cart"
            className="inline-flex rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
          >
            View cart
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
          <button
            type="button"
            onClick={handlePlaceOrder}
            className="mt-6 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Place order
          </button>
        </div>
      </aside>
    </div>
  );
}
