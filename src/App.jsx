import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useCart } from "./context/CartContext.jsx";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import {
  clearStoredAuth,
  isAdminEmail,
  persistAuthSession,
  resolveAuthState,
  signOutEverywhere,
} from "./lib/auth";

const THEME_KEY = "pixoraTheme";
const OAUTH_HASH_MARKERS = [
  "access_token=",
  "refresh_token=",
  "provider_token=",
  "error_description=",
];
const OAUTH_QUERY_KEYS = ["code", "state", "error", "error_description"];

const hasOAuthCallbackParams = () => {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash ?? "";
  const searchParams = new URLSearchParams(window.location.search ?? "");
  return (
    OAUTH_HASH_MARKERS.some((marker) => hash.includes(marker)) ||
    OAUTH_QUERY_KEYS.some((key) => searchParams.has(key))
  );
};

const clearOAuthCallbackParams = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  OAUTH_QUERY_KEYS.forEach((key) => {
    url.searchParams.delete(key);
  });

  const hasHashAuthData = OAUTH_HASH_MARKERS.some((marker) =>
    url.hash.includes(marker),
  );
  if (hasHashAuthData) {
    url.hash = "";
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(
    window.history.state,
    document.title,
    nextUrl,
  );
};

const getInitialTheme = () => {
  if (typeof window === "undefined") return "light";
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

const navItems = [
  { label: "Home", to: "/" },
  { label: "Shop", to: "/shop" },
  { label: "Cart", to: "/cart" },
  { label: "Orders", to: "/orders" },
];

export default function App({ children }) {
  const { itemCount } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    let isMounted = true;
    async function syncSession() {
      const auth = await resolveAuthState();
      if (!isMounted) return;
      setUser(auth.user ?? (auth.email ? { email: auth.email, demo: true } : null));
      setIsAdmin(Boolean(auth.isAdmin));
      if (auth.isAuthenticated && hasOAuthCallbackParams()) {
        clearOAuthCallbackParams();
      }
    }

    syncSession();

    // Listen for auth changes
    if (isSupabaseConfigured) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user?.email) {
          clearStoredAuth();
          setUser(null);
          setIsAdmin(false);
          return;
        }

        const authEmail = session.user.email.toLowerCase().trim();
        const admin = isAdminEmail(authEmail);
        persistAuthSession({ email: authEmail, isAdmin: admin });
        setUser(session.user);
        setIsAdmin(admin);
        if (hasOAuthCallbackParams()) {
          clearOAuthCallbackParams();
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    const timer = window.setTimeout(() => {
      root.classList.remove("theme-switching");
    }, 260);
    return () => window.clearTimeout(timer);
  }, [theme]);

  async function handleLogout() {
    await signOutEverywhere();
    setUser(null);
    setIsAdmin(false);
  }

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="app-atmosphere pointer-events-none fixed inset-x-0 top-0 h-64" />

      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur relative">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4">
          <Link to="/" className="text-xl font-semibold serif tracking-tight">
            Pixora
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm font-semibold">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `transition ${
                    isActive
                      ? "text-[var(--accent)]"
                      : "text-slate-600 hover:text-slate-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden md:flex items-center gap-3">
            {/* User status indicator */}
            {user && (
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <span
                  className={`h-2 w-2 rounded-full ${isAdmin ? "bg-amber-500" : "bg-green-500"}`}
                />
                {isAdmin
                  ? "Admin"
                  : user?.email ?? "Signed in"}
              </div>
            )}

            <div className="hidden lg:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              Shipping in 2 to 5 days
            </div>

            <div
              className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1"
              role="group"
              aria-label="Theme switch"
            >
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  theme === "light"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  theme === "dark"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Night
              </button>
            </div>

            <Link
              to="/cart"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Cart
              <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                {itemCount}
              </span>
            </Link>

            {user ? (
              <button
                onClick={handleLogout}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                Sign in
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="ml-auto inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-3 text-slate-700 shadow-sm transition hover:border-slate-300 md:hidden"
          >
            <span className="sr-only">
              {isMenuOpen ? "Close menu" : "Open menu"}
            </span>
            <span className="flex flex-col gap-1.5">
              <span
                className={`block h-0.5 w-5 bg-slate-900 transition ${
                  isMenuOpen ? "translate-y-2 rotate-45" : ""
                }`}
              />
              <span
                className={`block h-0.5 w-5 bg-slate-900 transition ${
                  isMenuOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`block h-0.5 w-5 bg-slate-900 transition ${
                  isMenuOpen ? "-translate-y-2 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>

        {isMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeMenu}
              className="fixed inset-0 z-20 bg-slate-900/25 md:hidden"
            />
            <div
              id="mobile-nav"
              className="absolute inset-x-0 top-full z-30 border-b border-slate-200 bg-white/95 backdrop-blur md:hidden"
            >
              <div className="mx-auto max-w-6xl px-4 py-4 space-y-2">
                {/* User status in mobile */}
                {user && (
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${isAdmin ? "bg-amber-500" : "bg-green-500"}`}
                      />
                      <span className="font-semibold text-slate-900">
                        {isAdmin ? "Admin" : "Signed in as"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {user?.email ?? "Signed in"}
                    </p>
                  </div>
                )}

                <div
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1"
                  role="group"
                  aria-label="Theme switch"
                >
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      theme === "light"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      theme === "dark"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Night
                  </button>
                </div>

                {navItems.map((item) => (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      `rounded-2xl px-4 py-3 transition flex items-center justify-between font-semibold ${
                        isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`
                    }
                  >
                    <span>{item.label}</span>
                    {item.label === "Cart" && (
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                        {itemCount}
                      </span>
                    )}
                  </NavLink>
                ))}

                {user ? (
                  <button
                    onClick={() => {
                      handleLogout();
                      closeMenu();
                    }}
                    className="w-full rounded-2xl px-4 py-3 text-left font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Sign out
                  </button>
                ) : (
                  <NavLink
                    to="/login"
                    onClick={closeMenu}
                    className="rounded-2xl px-4 py-3 bg-[var(--accent)] text-white font-semibold text-center block"
                  >
                    Sign in
                  </NavLink>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-10">
        {children ?? <Outlet />}
      </main>

      <footer className="border-t border-slate-200/70 bg-white/80">
        <div className="mx-auto max-w-6xl px-4 py-10 grid gap-6 md:grid-cols-3 text-sm text-slate-600">
          <div>
            <p className="serif text-lg font-semibold text-slate-900">
              Pixora Store
            </p>
            <p className="mt-2">
              Curated cameras, lenses, and studio-ready accessories for modern
              creators.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-slate-900 font-semibold">Support</p>
            <p>Delivery and returns</p>
            <p>Warranty coverage</p>
            <p>Contact: jonathanpalomar85@gmail.com</p>
          </div>
          <div className="space-y-2">
            <p className="text-slate-900 font-semibold">Showroom</p>
            <p>Open Monday to Saturday, 10AM to 6PM</p>
            <p>Nueva Ecija, Cabanatuan City, Brgy Cabu, Philippines</p>
            <p>Phone: +63 9152486509</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
