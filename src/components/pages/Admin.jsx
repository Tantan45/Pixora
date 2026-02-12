import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { products as seedProducts, categories } from "../../data/products";
import { useProducts } from "../../context/ProductsContext";

const formatPrice = (value) => `PHP ${Number(value).toLocaleString("en-PH")}`;

const getDefaultCategory = () => categories[0]?.name ?? "Cameras";

const buildId = (name) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-");
  return `${base || "item"}-${Date.now()}`;
};

const buildPriceDrafts = (items) =>
  Object.fromEntries(items.map((item) => [item.id, String(item.price)]));

export default function Admin() {
  const navigate = useNavigate();
  const { products, setProducts, addProduct, updateProduct, removeProduct } =
    useProducts();
  const [priceDrafts, setPriceDrafts] = useState(() =>
    buildPriceDrafts(products),
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: getDefaultCategory(),
    price: "",
    image: "",
  });

  const metrics = useMemo(() => {
    const totalProducts = products.length;
    const totalValue = products.reduce(
      (sum, item) => sum + Number(item.price || 0),
      0,
    );
    const topCategory = categories[0]?.name ?? "Cameras";
    return {
      totalProducts,
      totalValue,
      topCategory,
    };
  }, [products]);

  const isAuthed =
    typeof window !== "undefined" &&
    (localStorage.getItem("pixoraAdmin") === "true" ||
      localStorage.getItem("pixoraAdminUser"));

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  const handleSignOut = () => {
    localStorage.removeItem("pixoraAdmin");
    localStorage.removeItem("pixoraAdminUser");
    navigate("/login");
  };

  const handlePriceDraftChange = (id, value) => {
    setPriceDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const handlePriceSave = (id) => {
    const draft = priceDrafts[id];
    const nextPrice = Number(draft);
    if (!Number.isFinite(nextPrice)) return;
    updateProduct(id, { price: nextPrice });
    setPriceDrafts((prev) => ({ ...prev, [id]: String(nextPrice) }));
  };

  const handleDeleteProduct = (id) => {
    removeProduct(id);
    setPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRestoreProducts = () => {
    setProducts(seedProducts);
    setPriceDrafts(buildPriceDrafts(seedProducts));
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
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setFormError("Price must be a valid number.");
      return;
    }

    const id = buildId(newProduct.name);
    const product = {
      id,
      name: newProduct.name.trim(),
      category: newProduct.category || getDefaultCategory(),
      price: priceValue,
      image: newProduct.image || seedProducts[0]?.image,
      description: "New product added from admin.",
      highlights: ["New listing"],
    };

    addProduct(product);
    setPriceDrafts((prev) => ({ ...prev, [id]: String(priceValue) }));
    setNewProduct({
      name: "",
      category: getDefaultCategory(),
      price: "",
      image: "",
    });
    setShowAddForm(false);
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
              Manage products, inventory status, and customer activity in one
              place.
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Total products
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {metrics.totalProducts}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Active SKUs in the catalog
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Catalog value
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatPrice(metrics.totalValue)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Based on current list prices
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Top category
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {metrics.topCategory}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Most requested this week
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="serif text-2xl font-semibold text-slate-900">
              Recent products
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
              {formError && (
                <p className="text-xs text-rose-600">{formError}</p>
              )}
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
                <span className="text-xs text-slate-500">
                  Changes are stored locally.
                </span>
              </div>
            </form>
          )}

          <div className="mt-4 space-y-3">
            {products.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.category}</p>
                </div>
                <div className="text-right">
                  <label className="text-[10px] uppercase tracking-wide text-slate-500">
                    Price
                  </label>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
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
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(item.id)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatPrice(item.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-[var(--paper)] p-6 shadow-sm">
          <h2 className="serif text-2xl font-semibold text-slate-900">Tasks</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              Review low-stock accessories and place replenishment order.
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              Publish the spring creator bundle and update hero copy.
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              Verify latest payouts and reconcile shipping labels.
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            Admin tools are demo-only in this project build.
          </div>
        </div>
      </section>
    </div>
  );
}
