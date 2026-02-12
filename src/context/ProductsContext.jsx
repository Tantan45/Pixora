import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { products as seedProducts } from "../data/products";

const STORAGE_KEY = "pixoraProducts";
const ProductsContext = createContext(null);
const hasImage = (item) =>
  typeof item?.image === "string" && item.image.trim().length > 0;
const toValidStock = (value, category = "") => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  if (category === "Accessories") return 30;
  if (category === "Lenses") return 12;
  return 8;
};
const REMOVED_PRODUCT_IDS = new Set([
  "cam-fujifilm-x1",
  "cam-fujifilm-xt5",
  "cam-fujifilm-xe4",
  "cam-fujifilm-xt30-ii",
  "cam-fujifilm-gfx100s",
]);
const SEED_IMAGE_BY_ID = new Map(
  seedProducts
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        item.id.trim() &&
        typeof item.image === "string" &&
        item.image.trim().length > 0,
    )
    .map((item) => [item.id, item.image]),
);

const isVisibleProduct = (item) =>
  item &&
  typeof item.id === "string" &&
  item.id.trim() &&
  !REMOVED_PRODUCT_IDS.has(item.id) &&
  hasImage(item);

const withSeedImage = (item) => {
  if (!item || typeof item !== "object") return item;
  const seedImage = SEED_IMAGE_BY_ID.get(item.id);
  if (!seedImage) return item;
  return { ...item, image: seedImage };
};

const withNormalizedStock = (item) => {
  if (!item || typeof item !== "object") return item;
  return { ...item, stock: toValidStock(item.stock, item.category) };
};

const sanitizeProducts = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => withNormalizedStock(withSeedImage(item)))
    .filter((item) => isVisibleProduct(item));

const mergeSeedProducts = (storedProducts) => {
  const validStored = sanitizeProducts(storedProducts);
  const storedIds = new Set(validStored.map((item) => item.id));
  const missingSeed = sanitizeProducts(seedProducts).filter(
    (item) => !storedIds.has(item.id),
  );
  return [...validStored, ...missingSeed];
};

const loadProducts = () => {
  if (typeof window === "undefined") return sanitizeProducts(seedProducts);
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return sanitizeProducts(seedProducts);
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.length)
      return sanitizeProducts(seedProducts);
    return mergeSeedProducts(parsed);
  } catch {
    return sanitizeProducts(seedProducts);
  }
};

export function ProductsProvider({ children }) {
  const [products, setProductsState] = useState(loadProducts);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  const setProducts = useCallback((next) => {
    setProductsState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      return sanitizeProducts(resolved);
    });
  }, []);

  const addProduct = useCallback((product) => {
    if (!isVisibleProduct(product)) return;
    setProductsState((prev) => sanitizeProducts([product, ...prev]));
  }, []);

  const updateProduct = useCallback((id, patch) => {
    setProductsState((prev) =>
      sanitizeProducts(
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      ),
    );
  }, []);

  const adjustStock = useCallback((id, quantityDelta) => {
    setProductsState((prev) =>
      sanitizeProducts(
        prev.map((item) => {
          if (item.id !== id) return item;
          const current = Number(item.stock ?? 0);
          const delta = Number(quantityDelta ?? 0);
          const nextStock = Number.isFinite(current + delta)
            ? Math.max(0, Math.floor(current + delta))
            : current;
          return { ...item, stock: nextStock };
        }),
      ),
    );
  }, []);

  const removeProduct = useCallback((id) => {
    setProductsState((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const upsertProduct = useCallback((product) => {
    setProductsState((prev) => {
      if (!isVisibleProduct(product)) {
        return prev.filter((item) => item.id !== product?.id);
      }
      const index = prev.findIndex((item) => item.id === product.id);
      if (index === -1) return sanitizeProducts([product, ...prev]);
      const next = [...prev];
      next[index] = { ...prev[index], ...product };
      return sanitizeProducts(next);
    });
  }, []);

  const value = useMemo(
    () => ({
      products,
      setProducts,
      addProduct,
      updateProduct,
      adjustStock,
      removeProduct,
      upsertProduct,
    }),
    [products, setProducts, addProduct, updateProduct, adjustStock, removeProduct, upsertProduct],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) {
    throw new Error("useProducts must be used inside ProductsProvider");
  }
  return ctx;
}
