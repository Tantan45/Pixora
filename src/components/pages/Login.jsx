import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import {
  getStoredAuth,
  isAdminEmail,
  persistAuthSession,
} from "../../lib/auth";

const OAUTH_HASH_MARKERS = [
  "access_token=",
  "refresh_token=",
  "provider_token=",
  "error_description=",
];
const OAUTH_QUERY_KEYS = ["code", "state", "error", "error_description"];
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const isLocalHostname = (hostname) =>
  LOCAL_HOSTNAMES.has(String(hostname ?? "").toLowerCase());

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

const resolveOAuthRedirectUrl = () => {
  const configured = String(
    import.meta.env.VITE_AUTH_REDIRECT_URL ?? "",
  ).trim();

  if (typeof window === "undefined") {
    return configured;
  }

  const currentUrl = new URL(window.location.href);
  const currentOrigin = currentUrl.origin;

  if (!configured) {
    return currentOrigin;
  }

  try {
    const configuredUrl = new URL(configured, currentOrigin);
    const currentIsLocal = isLocalHostname(currentUrl.hostname);
    const configuredIsLocal = isLocalHostname(configuredUrl.hostname);

    // Prevent cross-environment redirects (e.g. Vercel app -> localhost).
    if (currentIsLocal !== configuredIsLocal) {
      return currentOrigin;
    }

    return configuredUrl.toString();
  } catch {
    return currentOrigin;
  }
};

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkExistingSession();

    if (isSupabaseConfigured) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) return;

        const authEmail = (session.user.email ?? "").toLowerCase().trim();
        const admin = isAdminEmail(authEmail);
        persistAuthSession({ email: authEmail, isAdmin: admin });
        if (hasOAuthCallbackParams()) {
          clearOAuthCallbackParams();
        }

        setStatus("? Signed in successfully!");
        setStatusType("success");
        setIsLoading(false);

        setTimeout(() => {
          navigate(admin ? "/admin" : "/");
        }, 1000);
      });

      return () => subscription.unsubscribe();
    }

    return undefined;
  }, [navigate]);

  async function checkExistingSession() {
    if (isSupabaseConfigured) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        const authEmail = user.email.toLowerCase().trim();
        const admin = isAdminEmail(authEmail);
        persistAuthSession({ email: authEmail, isAdmin: admin });
        setStatus("You're already signed in!");
        setStatusType("success");
      }
      return;
    }

    const stored = getStoredAuth();
    if (!stored.isAuthenticated || !stored.email) return;

    setStatus(
      stored.isAdmin
        ? `Already signed in as admin (${stored.email})`
        : `Already signed in as ${stored.email}`,
    );
    setStatusType("success");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setStatus("");
    setStatusType("");

    if (!email.trim() || !password.trim()) {
      setStatus("Please fill in all fields");
      setStatusType("error");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setStatus("Password must be at least 6 characters");
      setStatusType("error");
      setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      const normalizedEmail = email.toLowerCase().trim();
      const admin = isAdminEmail(normalizedEmail);

      setTimeout(() => {
        persistAuthSession({ email: normalizedEmail, isAdmin: admin });
        setStatus(
          admin
            ? `? Signed in successfully as admin, ${normalizedEmail}!`
            : `? Signed in successfully as ${normalizedEmail}!`,
        );
        setStatusType("success");
        setIsLoading(false);
        setTimeout(() => navigate(admin ? "/admin" : "/"), 900);
      }, 600);
      return;
    }

    try {
      setStatus(mode === "signin" ? "Signing in..." : "Creating account...");
      setStatusType("loading");

      const action =
        mode === "signin"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password });

      const { error } = await action;

      if (error) {
        setStatus(`? ${error.message}`);
        setStatusType("error");
        setIsLoading(false);
        return;
      }

      if (mode === "signin") {
        const normalizedEmail = email.toLowerCase().trim();
        const admin = isAdminEmail(normalizedEmail);
        persistAuthSession({ email: normalizedEmail, isAdmin: admin });
        setStatus(
          admin
            ? `? Signed in successfully as admin, ${normalizedEmail}!`
            : `? Welcome back! Signed in as ${normalizedEmail}`,
        );
        setStatusType("success");
        setTimeout(() => navigate(admin ? "/admin" : "/"), 900);
      } else {
        setStatus(
          "? Account created! Please check your email to verify your account.",
        );
        setStatusType("success");
        setTimeout(() => {
          setMode("signin");
          setStatus("");
          setStatusType("");
        }, 3000);
      }
    } catch (err) {
      setStatus(`? An unexpected error occurred: ${err.message}`);
      setStatusType("error");
    } finally {
      setIsLoading(false);
    }
  }

  function handleModeSwitch() {
    setMode(mode === "signin" ? "signup" : "signin");
    setStatus("");
    setStatusType("");
    setPassword("");
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setStatus("");
    setStatusType("");

    if (!isSupabaseConfigured) {
      setStatus("Google Sign-In requires Supabase configuration");
      setStatusType("error");
      setIsLoading(false);
      return;
    }

    try {
      setStatus("Connecting to Google...");
      setStatusType("loading");

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: resolveOAuthRedirectUrl(),
        },
      });

      if (error) {
        setStatus(`? ${error.message}`);
        setStatusType("error");
        setIsLoading(false);
      }
    } catch (err) {
      setStatus(`? An unexpected error occurred: ${err.message}`);
      setStatusType("error");
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
      <div className="space-y-4">
        <p className="text-sm font-semibold text-[var(--accent)]">Account</p>
        <h1 className="serif text-4xl font-semibold text-slate-900">
          Access your Pixora workspace
        </h1>
        <p className="text-sm text-slate-600">
          Track orders, save wishlists, and unlock pro-only bundles curated for
          photographers and filmmakers.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">? Order history</p>
            <p className="mt-2">View purchase history and download receipts.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">? Exclusive drops</p>
            <p className="mt-2">
              Get first access to new camera bodies and bundles.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>
          <button
            type="button"
            onClick={handleModeSwitch}
            className="text-xs font-semibold text-[var(--accent)] hover:text-slate-900"
          >
            {mode === "signin" ? "Create account ?" : "? Sign in"}
          </button>
        </div>

        <label className="text-sm font-semibold text-slate-700 block">
          Email address
          <input
            type="email"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isLoading}
          />
        </label>

        <label className="text-sm font-semibold text-slate-700 block">
          Password
          <input
            type="password"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
            placeholder={
              mode === "signin"
                ? "Enter your password"
                : "At least 6 characters"
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={isLoading}
            minLength={6}
          />
          {mode === "signup" && (
            <p className="mt-1 text-xs text-slate-500">
              Minimum 6 characters required
            </p>
          )}
        </label>

        {status && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              statusType === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : statusType === "error"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}
          >
            {status}
          </div>
        )}

        {!isSupabaseConfigured && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
            <p className="font-semibold">Demo Mode Active</p>
            <p className="mt-1">
              Supabase is not configured. Authentication is simulated locally.
            </p>
            <p className="mt-1">
              <strong>Admin emails:</strong> admin@pixora.com,
              admin@pixora.store, or emails containing "admin"
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </span>
          ) : mode === "signin" ? (
            "Sign in to your account"
          ) : (
            "Create new account"
          )}
        </button>
        {isSupabaseConfigured && (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
        )}

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <p className="text-xs text-slate-500 text-center">
            {mode === "signin"
              ? "New to Pixora? Create an account to save your preferences and track orders."
              : "Already have an account? Sign in to access your workspace."}
          </p>
          <div className="flex items-center justify-center">
            <Link
              to="/admin/login"
              className="text-xs font-semibold text-amber-600 hover:text-amber-800"
            >
              ? Admin Access
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
