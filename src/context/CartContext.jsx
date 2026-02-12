import React, { createContext, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);
const INFINITE_STOCK = Number.POSITIVE_INFINITY;

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
  const [items, setItems] = useState([]);

  const addItem = (product, qty = 1) => {
    const requestedQty = Math.max(1, toQuantity(qty, 1));
    const stockLimit = toStockLimit(product);
    if (stockLimit <= 0) return;

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
  };

  const updateQuantity = (id, quantity) => {
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
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setItems([]);

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
    [items, summary],
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
