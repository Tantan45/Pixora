import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { products as seedProducts } from "../../data/products";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useCart } from "../../context/CartContext";
import { useProducts } from "../../context/ProductsContext";

const formatPrice = (value) => `PHP ${Number(value).toLocaleString("en-PH")}`;
const getStockCount = (item) => {
  const stock = Number(item?.stock);
  if (!Number.isFinite(stock)) return 0;
  return Math.max(0, Math.floor(stock));
};
const DEFAULT_IMAGE =
  seedProducts.find((item) => item.id === "cam-fujifilm-xs20")?.image ??
  seedProducts.find((item) => typeof item?.image === "string" && item.image.trim().length > 0)
    ?.image ??
  "";

const normalizeProduct = (item) => ({
  id: item.id ?? item.slug ?? "item",
  name: item.name ?? item.title ?? "Untitled",
  category: item.category ?? "Accessories",
  price: Number(item.price ?? 0),
  stock: getStockCount(item),
  image: item.image ?? item.image_url ?? DEFAULT_IMAGE,
  description: item.description ?? "",
  highlights: item.highlights ?? ["Verified stock", "One-year warranty", "Local support"],
});

export default function Product() {
  const { id } = useParams();
  const { addItem, items } = useCart();
  const { products, upsertProduct } = useProducts();
  const [loading, setLoading] = useState(false);

  const product = useMemo(() => products.find((p) => p.id === id), [products, id]);
  const highlights =
    Array.isArray(product?.highlights) && product.highlights.length
      ? product.highlights
      : ["Verified stock", "One-year warranty", "Local support"];
  const accessoryPicks = products.filter(
    (p) => p.id !== id && p.category === "Accessories",
  );
  const recommendations =
    accessoryPicks.length > 0
      ? accessoryPicks.slice(0, 3)
      : products.filter((p) => p.id !== id).slice(0, 3);
  const quantityInCart = useMemo(
    () => Number(items.find((item) => item.id === id)?.quantity ?? 0),
    [items, id],
  );
  const stockCount = getStockCount(product);
  const availableToAdd = Math.max(0, stockCount - quantityInCart);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let isActive = true;
    async function fetchProduct() {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (isActive && !error && data) {
        upsertProduct(normalizeProduct(data));
      }

      if (isActive) {
        setLoading(false);
      }
    }

    fetchProduct();

    return () => {
      isActive = false;
    };
  }, [id, upsertProduct]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading product...</p>;
  }

  if (!product) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-600">Product not found. Browse the collection to pick another item.</p>
        <Link
          to="/shop"
          className="mt-4 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-start">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div
            className="h-96 rounded-2xl bg-cover bg-center"
            style={{ backgroundImage: `url(${product.image})` }}
            aria-label={product.name}
          />
        </div>
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">{product.category}</p>
          <h1 className="serif text-3xl font-semibold text-slate-900">{product.name}</h1>
          <p className="text-lg font-semibold text-[var(--accent)]">{formatPrice(product.price)}</p>
          <p className="text-sm text-slate-600">{product.description}</p>
          <p
            className={`text-sm font-semibold ${
              stockCount <= 0
                ? "text-rose-600"
                : availableToAdd <= 2
                  ? "text-amber-600"
                  : "text-emerald-700"
            }`}
          >
            {stockCount <= 0
              ? "Out of stock"
              : `${stockCount} in stock (${availableToAdd} available to add)`}
          </p>
          <div className="grid gap-2 text-sm text-slate-600">
            {highlights.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                {item}
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => addItem(product, 1)}
              disabled={availableToAdd <= 0}
              className={`flex-1 rounded-full px-5 py-3 text-sm font-semibold text-white ${
                availableToAdd <= 0
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              {availableToAdd <= 0 ? "Out of stock" : "Add to cart"}
            </button>
            <Link
              to="/cart"
              className="flex-1 rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 text-center hover:border-slate-300"
            >
              Go to cart
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            Orders over PHP 50,000 include insured delivery and priority packing.
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="serif text-2xl font-semibold text-slate-900">Recommended add-ons</h2>
          <Link to="/shop" className="text-sm font-semibold text-slate-600">View catalog</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {recommendations.map((item) => {
            const inCart = Number(
              items.find((cartItem) => cartItem.id === item.id)?.quantity ?? 0,
            );
            const stock = getStockCount(item);
            const available = Math.max(0, stock - inCart);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => addItem(item, 1)}
                disabled={available <= 0}
                className={`group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition ${
                  available <= 0
                    ? "cursor-not-allowed opacity-65"
                    : "hover:-translate-y-1 hover:shadow-lg"
                }`}
                aria-label={`Add ${item.name} to cart`}
              >
                <div
                  className="h-32 rounded-xl bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.02]"
                  style={{ backgroundImage: `url(${item.image})` }}
                  aria-label={item.name}
                />
                <p className="mt-3 text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{formatPrice(item.price)}</p>
                <p className="text-xs text-slate-500">
                  {available <= 0 ? "Out of stock" : `${available} left`}
                </p>
                <span className="mt-3 inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {available <= 0 ? "Unavailable" : "Add to cart"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
