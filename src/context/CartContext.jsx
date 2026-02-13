import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { getStoredAuth } from "../lib/auth";

const CartContext = createContext(null);
const INFINITE_STOCK = Number.POSITIVE_INFINITY;
const POST_AUTH_REDIRECT_KEY = "pixoraPostAuthRedirect";
const AUTH_NOTICE_KEY = "pixoraAuthNotice";

const toStockLimit = (item) => {
  const stock = Number(item?.stock);
  if (!Number.isFinite(stock)) return INFINITE_STOCK;
  return Math.max(0, Math.floor(stock));
};

const toQuantity = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

export function CartProvider({ children }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  const ensureSignedIn = useCallback(() => {
    const auth = getStoredAuth();
    if (auth.isAuthenticated && auth.email) return true;

    if (typeof window !== "undefined") {
      try {
        const nextUrl = `${window.location.pathname}${window.location.search}`;
        sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, nextUrl);
        sessionStorage.setItem(AUTH_NOTICE_KEY, "cart");
      } catch {
        // Ignore storage errors.
      }
    }

    navigate("/login");
    return false;
  }, [navigate]);

  const addItem = useCallback((product, qty = 1) => {
    if (!ensureSignedIn()) return false;

    const requestedQty = Math.max(1, toQuantity(qty, 1));
    const stockLimit = toStockLimit(product);
    if (stockLimit <= 0) return false;

    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        const nextStock = toStockLimit(product);
        const nextQuantity = Math.min(existing.quantity + requestedQty, nextStock);

        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                ...product,
                stock: nextStock,
                quantity: nextQuantity,
              }
            : item,
        );
      }

      return [
        ...prev,
        {
          ...product,
          stock: stockLimit,
          quantity: Math.min(requestedQty, stockLimit),
        },
      ];
    });

    return true;
  }, [ensureSignedIn]);

  const updateQuantity = useCallback((id, quantity) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const stockLimit = toStockLimit(item);
          const nextQuantity = toQuantity(quantity, item.quantity);
          return {
            ...item,
            quantity: Math.min(nextQuantity, stockLimit),
          };
        })
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const summary = useMemo(() => {
    const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
    const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    return { itemCount, subtotal };
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      itemCount: summary.itemCount,
      subtotal: summary.subtotal,
    }),
    [items, summary, addItem, updateQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return ctx;
}
