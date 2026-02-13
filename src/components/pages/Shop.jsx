import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useProducts } from "../../context/ProductsContext";

const formatPrice = (value) => `PHP ${Number(value).toLocaleString("en-PH")}`;
const PINNED_CATEGORIES = ["Mirrorless", "Accessories"];
const hasUsableImage = (item) =>
  typeof item?.image === "string" && item.image.trim().length > 0;
const getStockCount = (item) => {
  const stock = Number(item?.stock);
  if (!Number.isFinite(stock)) return 0;
  return Math.max(0, Math.floor(stock));
};

export default function Shop() {
  const { addItem, items } = useCart();
  const { products: allProducts } = useProducts();
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isAddedModalOpen, setIsAddedModalOpen] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);

  const productsWithImages = useMemo(
    () => allProducts.filter((item) => hasUsableImage(item)),
    [allProducts],
  );

  const categoryFilters = useMemo(() => {
    const discovered = new Set(
      productsWithImages
        .map((item) => item.category)
        .filter((category) => typeof category === "string" && category.trim()),
    );

    const filters = ["All"];
    PINNED_CATEGORIES.forEach((category) => {
      if (!filters.includes(category)) filters.push(category);
      discovered.delete(category);
    });

    return [...filters, ...Array.from(discovered)];
  }, [productsWithImages]);

  const products = useMemo(() => {
    if (activeCategory === "All") return productsWithImages;
    return productsWithImages.filter((item) => item.category === activeCategory);
  }, [activeCategory, productsWithImages]);

  const mirrorlessCount = useMemo(
    () =>
      productsWithImages.filter((item) => item.category === "Mirrorless")
        .length,
    [productsWithImages],
  );
  const accessoriesCount = useMemo(
    () =>
      productsWithImages.filter((item) => item.category === "Accessories")
        .length,
    [productsWithImages],
  );
  const cartQuantityById = useMemo(
    () =>
      items.reduce((acc, item) => {
        acc[item.id] = Number(item.quantity ?? 0);
        return acc;
      }, {}),
    [items],
  );

  useEffect(() => {
    if (!isAddedModalOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsAddedModalOpen(false);
        setSelectedProduct(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAddedModalOpen]);

  useEffect(() => {
    if (!recentlyAddedId) return undefined;
    const timer = window.setTimeout(() => {
      setRecentlyAddedId(null);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [recentlyAddedId]);

  const closeAddedModal = () => {
    setIsAddedModalOpen(false);
    setSelectedProduct(null);
  };

  const handleAddToCart = (product) => {
    const stock = getStockCount(product);
    const currentInCart = Number(cartQuantityById[product.id] ?? 0);
    if (currentInCart >= stock) return;

    const added = addItem(product, 1);
    if (!added) return;
    setRecentlyAddedId(product.id);
    setSelectedProduct(product);
    setIsAddedModalOpen(true);
  };

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Shop</p>
            <h1 className="serif mt-2 text-3xl sm:text-4xl font-semibold text-slate-900">
              All Fujifilm camera, lenses, and creator gear
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Explore every item in the Pixora catalog, with category filters
              for quick browsing.
            </p>
          </div>
          <Link
            to="/cart"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Go to cart
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {categoryFilters.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                activeCategory === category
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
            Mirrorless: {mirrorlessCount}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
            Accessories: {accessoriesCount}
          </span>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const isRecentlyAdded = recentlyAddedId === product.id;
          const stockCount = getStockCount(product);
          const inCart = Number(cartQuantityById[product.id] ?? 0);
          const availableToAdd = Math.max(0, stockCount - inCart);
          const isOutOfStock = stockCount <= 0;
          const isMaxedInCart = !isOutOfStock && availableToAdd <= 0;

          return (
            <div
              key={product.id}
              className="group rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1"
            >
              <Link
                to={`/product/${product.id}`}
                className="block"
                aria-label={`View ${product.name}`}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  className="h-52 w-full rounded-2xl object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {product.category}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {product.name}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {formatPrice(product.price)}
                  </p>
                  <p
                    className={`text-xs ${
                      isOutOfStock
                        ? "text-rose-600"
                        : availableToAdd <= 3
                          ? "text-amber-600"
                          : "text-emerald-700"
                    }`}
                  >
                    {isOutOfStock
                      ? "Out of stock"
                      : `${stockCount} in stock (${availableToAdd} available to add)`}
                  </p>
                </div>
              </Link>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => handleAddToCart(product)}
                  disabled={isOutOfStock || isMaxedInCart}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold text-white ${
                    isOutOfStock || isMaxedInCart
                      ? "bg-slate-300 cursor-not-allowed"
                      : isRecentlyAdded
                      ? "bg-emerald-600 hover:bg-emerald-600"
                      : "bg-slate-900 hover:bg-slate-800"
                  }`}
                >
                  {isOutOfStock
                    ? "Out of stock"
                    : isMaxedInCart
                      ? "Max stock reached"
                      : isRecentlyAdded
                        ? "Added to cart"
                        : "Add to cart"}
                </button>
                <Link
                  to={`/product/${product.id}`}
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 text-center hover:border-slate-300"
                >
                  View
                </Link>
              </div>
            </div>
          );
        })}
      </section>

      {isAddedModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close add to cart modal"
            onClick={closeAddedModal}
            className="absolute inset-0 bg-slate-900/55"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="added-to-cart-title"
            className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <button
              type="button"
              onClick={closeAddedModal}
              className="absolute right-4 top-4 rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Close
            </button>

            <h2 id="added-to-cart-title" className="serif text-2xl font-semibold text-slate-900">
              Added to cart
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {selectedProduct.name} has been added to your cart.
            </p>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{selectedProduct.category}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedProduct.name}</p>
              <p className="text-sm text-slate-600">{formatPrice(selectedProduct.price)}</p>
              <p className="text-xs text-slate-500">
                Stock left: {getStockCount(selectedProduct)}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeAddedModal}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
              >
                Continue shopping
              </button>
              <Link
                to="/cart"
                onClick={closeAddedModal}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
              >
                Go to cart
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
