import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { products as seedProducts, categories, testimonials } from "../../data/products";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useCart } from "../../context/CartContext";
import { useProducts } from "../../context/ProductsContext";

const formatPrice = (value) => `PHP ${Number(value).toLocaleString("en-PH")}`;
const DEFAULT_IMAGE =
  seedProducts.find((item) => item.id === "cam-fujifilm-xs20")?.image ??
  seedProducts.find((item) => typeof item?.image === "string" && item.image.trim().length > 0)
    ?.image ??
  "";

const normalizeProduct = (item) => ({
  id: item.id ?? item.slug ?? item.name?.toLowerCase().replace(/\s+/g, "-") ?? "item",
  name: item.name ?? item.title ?? "Untitled",
  category: item.category ?? "Accessories",
  price: Number(item.price ?? 0),
  image: item.image ?? item.image_url ?? DEFAULT_IMAGE,
  description: item.description ?? "",
  highlights: item.highlights ?? [],
});

const mergeProductsById = (baseProducts, incomingProducts) => {
  const byId = new Map(baseProducts.map((item) => [item.id, item]));
  incomingProducts.forEach((item) => {
    const previous = byId.get(item.id);
    byId.set(item.id, previous ? { ...previous, ...item } : item);
  });
  return Array.from(byId.values());
};

export default function Home() {
  const { addItem } = useCart();
  const { products, setProducts } = useProducts();
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let isActive = true;
    async function loadProducts() {
      setStatus("Loading latest inventory from Supabase...");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .limit(12);
      if (isActive && !error && data?.length) {
        const normalized = data.map(normalizeProduct);
        setProducts((prev) =>
          mergeProductsById(mergeProductsById(seedProducts, prev), normalized),
        );
        setStatus("");
        return;
      }
      if (isActive) {
        setStatus("Showing curated collection.");
      }
    }

    loadProducts();

    return () => {
      isActive = false;
    };
  }, [setProducts]);

  const featured = useMemo(() => products.slice(0, 6), [products]);
  const accessories = useMemo(() => products.filter((p) => p.category === "Accessories").slice(0, 3), [products]);

  return (
    <div className="space-y-16">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Pixora Store</p>
          <h1 className="serif mt-4 text-4xl sm:text-5xl font-semibold text-slate-900 leading-tight">
            Camera kits and accessories tuned for modern storytellers.
          </h1>
          <p className="mt-4 text-slate-600 text-base">
            Shop curated mirrorless bodies, lenses, lighting, and audio built for consistent results on every shoot.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              to="/shop"
              className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Browse collection
            </Link>
            <Link
              to="/cart"
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              View cart
            </Link>
          </div>
          {status && <p className="mt-4 text-xs text-slate-500">{status}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {featured.slice(0, 4).map((item) => (
            <Link
              key={item.id}
              to={`/product/${item.id}`}
              className="group rounded-3xl bg-white shadow-sm border border-slate-200 p-3 transition hover:-translate-y-1 hover:shadow-lg"
              aria-label={`View ${item.name}`}
            >
              <div
                className="h-36 rounded-2xl bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.02]"
                style={{ backgroundImage: `url(${item.image})` }}
                aria-label={item.name}
              />
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.category}</p>
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-600">{formatPrice(item.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {categories.map((category) => (
          <div key={category.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{category.name}</p>
            <p className="text-xs text-slate-500 mt-2">{category.detail}</p>
          </div>
        ))}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Featured</p>
            <h2 className="serif text-3xl font-semibold text-slate-900">Popular gear this season</h2>
          </div>
          <Link to="/shop" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            View all products
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((product) => (
            <div
              key={product.id}
              className="group rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1"
            >
              <Link to={`/product/${product.id}`} className="block" aria-label={`View ${product.name}`}>
                <div
                  className="h-48 rounded-2xl bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.02]"
                  style={{ backgroundImage: `url(${product.image})` }}
                  aria-label={product.name}
                />
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{product.category}</p>
                  <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-600">{formatPrice(product.price)}</p>
                </div>
              </Link>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => addItem(product, 1)}
                  className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Add to cart
                </button>
                <Link
                  to={`/product/${product.id}`}
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 text-center hover:border-slate-300"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[var(--accent)]">Accessory kits</p>
          <h2 className="serif mt-3 text-3xl font-semibold text-slate-900">Build a complete studio in one box</h2>
          <p className="mt-3 text-sm text-slate-600">
            Combine lighting, audio, and travel essentials with packs built for creators who want to shoot immediately.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {accessories.map((item) => (
              <Link
                key={item.id}
                to={`/product/${item.id}`}
                className="group rounded-2xl border border-slate-200 p-3 transition hover:-translate-y-1 hover:shadow-md"
                aria-label={`View ${item.name}`}
              >
                <div
                  className="h-24 rounded-xl bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.02]"
                  style={{ backgroundImage: `url(${item.image})` }}
                  aria-label={item.name}
                />
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{formatPrice(item.price)}</p>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-[var(--paper)] p-6 shadow-sm">
          <p className="text-sm font-semibold text-[var(--accent-2)]">Why Pixora</p>
          <h3 className="serif mt-3 text-2xl font-semibold text-slate-900">Built for reliable delivery and verified stock.</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>Studio-grade checks before dispatch.</li>
            <li>Optional insurance on premium gear.</li>
            <li>Flexible payment reminders for semester projects.</li>
          </ul>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Inclusion</p>
            <p className="mt-2 text-sm text-slate-600">
              Every order includes setup tips, care instructions, and a quick-start checklist for your shoot.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Reviews</p>
            <h2 className="serif text-3xl font-semibold text-slate-900">Creators love the workflow</h2>
          </div>
          <Link to="/login" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Join Pixora
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {testimonials.map((review) => (
            <div key={review.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">"{review.quote}"</p>
              <p className="mt-3 text-xs font-semibold text-slate-900">{review.name}</p>
              <p className="text-xs text-slate-500">{review.role}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
