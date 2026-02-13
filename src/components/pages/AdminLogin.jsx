import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStoredAuth, isAdminEmail, persistAuthSession } from "../../lib/auth";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

const ADMIN_ACCESS_CODE = "pixora-admin";
const ADMIN_DEMO_EMAIL = "jonthanpalomar85@gmail.com";

const CALLBACK_HASH_MARKERS = [
  "access_token=",
  "refresh_token=",
  "provider_token=",
  "error_description=",
];
const CALLBACK_QUERY_KEYS = [
  "code",
  "state",
  "error",
  "error_description",
  "type",
  "token_hash",
];
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const isLocalHostname = (hostname) =>
  LOCAL_HOSTNAMES.has(String(hostname ?? "").toLowerCase());

const hasPasswordRecoveryParams = () => {
  if (typeof window === "undefined") return false;
  const hash = String(window.location.hash ?? "").toLowerCase();
  const search = new URLSearchParams(window.location.search ?? "");
  return (
    search.get("type") === "recovery" ||
    search.has("token_hash") ||
    hash.includes("type=recovery") ||
    hash.includes("recovery")
  );
};

const hasAuthCallbackParams = () => {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash ?? "";
  const search = new URLSearchParams(window.location.search ?? "");
  return (
    CALLBACK_HASH_MARKERS.some((marker) => hash.includes(marker)) ||
    CALLBACK_QUERY_KEYS.some((key) => search.has(key))
  );
};

const clearAuthCallbackParams = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);

  CALLBACK_QUERY_KEYS.forEach((key) => {
    url.searchParams.delete(key);
  });

  const hasHashAuthData = CALLBACK_HASH_MARKERS.some((marker) =>
    url.hash.includes(marker),
  );
  if (hasHashAuthData) {
    url.hash = "";
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, document.title, nextUrl);
};

const resolveAuthRedirectBaseUrl = () => {
  const configured = String(import.meta.env.VITE_AUTH_REDIRECT_URL ?? "").trim();

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

const resolveAuthRedirectUrl = (pathname = "/admin/login") => {
  const base = resolveAuthRedirectBaseUrl();
  const fallbackOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

  try {
    const url = new URL(base || fallbackOrigin, fallbackOrigin);
    url.pathname = pathname;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${fallbackOrigin}${pathname}`;
  }
};

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState(ADMIN_DEMO_EMAIL);
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isResetPasswordVisible, setIsResetPasswordVisible] = useState(false);
  const [isAccessCodeVisible, setIsAccessCodeVisible] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(() =>
    hasPasswordRecoveryParams(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      const stored = getStoredAuth();
      if (stored.isAuthenticated && stored.isAdmin) {
        navigate("/admin", { replace: true });
      }
      return () => {
        isMounted = false;
      };
    }

    if (hasPasswordRecoveryParams()) {
      setIsRecoveryMode(true);
      setStatus("Set your new admin password to finish recovery.");
      setStatusType("loading");
    }

    const syncExistingUser = async () => {
      if (isRecoveryMode || hasPasswordRecoveryParams()) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user?.email) return;
      const authEmail = user.email.toLowerCase().trim();

      if (isAdminEmail(authEmail) && !hasPasswordRecoveryParams()) {
        persistAuthSession({ email: authEmail, isAdmin: true });
        navigate("/admin", { replace: true });
      }
    };

    syncExistingUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY" || hasPasswordRecoveryParams()) {
        setIsRecoveryMode(true);
        setPassword("");
        setResetPassword("");
        setResetPasswordConfirm("");
        setIsPasswordVisible(false);
        setIsResetPasswordVisible(false);
        setIsAccessCodeVisible(false);
        setStatus("Set your new admin password to finish recovery.");
        setStatusType("loading");
        if (hasAuthCallbackParams()) {
          clearAuthCallbackParams();
        }
        setIsLoading(false);
        return;
      }

      if (!session?.user?.email) return;
      const authEmail = session.user.email.toLowerCase().trim();

      if (!isAdminEmail(authEmail)) {
        setStatus("This account is not authorized for admin access.");
        setStatusType("error");
        await supabase.auth.signOut();
        return;
      }

      if (isRecoveryMode) return;

      persistAuthSession({ email: authEmail, isAdmin: true });
      setStatus("Signed in.");
      setStatusType("success");
      setIsLoading(false);
      navigate("/admin", { replace: true });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, isRecoveryMode]);

  const handleAccessCodeSubmit = (event) => {
    event.preventDefault();
    if (accessCode.trim() !== ADMIN_ACCESS_CODE) {
      setStatus("Invalid access code.");
      setStatusType("error");
      return;
    }

    persistAuthSession({ email: ADMIN_DEMO_EMAIL, isAdmin: true });
    setStatus("Signed in.");
    setStatusType("success");
    navigate("/admin", { replace: true });
  };

  const handleAdminSignIn = async (event) => {
    event.preventDefault();

    if (isRecoveryMode) {
      await handlePasswordReset();
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !password.trim()) {
      setStatus("Please enter admin email and password.");
      setStatusType("error");
      return;
    }

    if (!isAdminEmail(normalizedEmail)) {
      setStatus("This account is not authorized for admin access.");
      setStatusType("error");
      return;
    }

    setIsLoading(true);
    setStatus("Signing in...");
    setStatusType("loading");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setStatus(`? ${error.message}`);
        setStatusType("error");
        return;
      }

      const authEmail = (data?.user?.email ?? normalizedEmail).toLowerCase().trim();
      if (!isAdminEmail(authEmail)) {
        await supabase.auth.signOut();
        setStatus("This account is not authorized for admin access.");
        setStatusType("error");
        return;
      }

      persistAuthSession({ email: authEmail, isAdmin: true });
      setStatus("Signed in.");
      setStatusType("success");
      navigate("/admin", { replace: true });
    } catch (err) {
      setStatus(`? An unexpected error occurred: ${err.message}`);
      setStatusType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      setStatus("Enter your admin email first.");
      setStatusType("error");
      return;
    }

    if (!isAdminEmail(normalizedEmail)) {
      setStatus("Use an authorized admin email address.");
      setStatusType("error");
      return;
    }

    setIsLoading(true);
    setStatus("Sending password reset email...");
    setStatusType("loading");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: resolveAuthRedirectUrl("/admin/login"),
      });

      if (error) {
        setStatus(`? ${error.message}`);
        setStatusType("error");
        return;
      }

      setStatus("Reset link sent. Open the email and set a new admin password.");
      setStatusType("success");
    } catch (err) {
      setStatus(`? An unexpected error occurred: ${err.message}`);
      setStatusType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetPassword.trim() || !resetPasswordConfirm.trim()) {
      setStatus("Please fill in both new password fields.");
      setStatusType("error");
      return;
    }

    if (resetPassword.length < 6) {
      setStatus("New password must be at least 6 characters.");
      setStatusType("error");
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setStatus("New password and confirmation do not match.");
      setStatusType("error");
      return;
    }

    setIsLoading(true);
    setStatus("Updating admin password...");
    setStatusType("loading");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const authEmail = (user?.email ?? "").toLowerCase().trim();
      if (!user?.id || !isAdminEmail(authEmail)) {
        setStatus("Recovery session expired. Request a new reset link.");
        setStatusType("error");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: resetPassword,
      });

      if (error) {
        setStatus(`? ${error.message}`);
        setStatusType("error");
        return;
      }

      clearAuthCallbackParams();
      await supabase.auth.signOut();
      setIsRecoveryMode(false);
      setPassword("");
      setResetPassword("");
      setResetPasswordConfirm("");
      setStatus("Password updated. Sign in with your new admin password.");
      setStatusType("success");
    } catch (err) {
      setStatus(`? An unexpected error occurred: ${err.message}`);
      setStatusType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const statusClass =
    statusType === "success"
      ? "bg-green-50 text-green-800 border border-green-200"
      : statusType === "error"
        ? "bg-red-50 text-red-800 border border-red-200"
        : "bg-blue-50 text-blue-800 border border-blue-200";

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-br from-white via-transparent to-amber-100/60" />
      <div className="relative z-10 mx-auto max-w-xl px-4 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">
              Admin Access
            </p>
            <h1 className="serif mt-2 text-3xl font-semibold text-slate-900">
              Sign in to Pixora Admin
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              {isSupabaseConfigured
                ? "Use your admin account credentials."
                : "This demo uses a local access code stored in the browser."}
            </p>
          </div>

          {isSupabaseConfigured ? (
            <form onSubmit={handleAdminSignIn} className="space-y-4">
              <label className="text-sm font-semibold text-slate-700 block">
                Admin email
                <input
                  type="email"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  placeholder="admin@pixora.store"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={isLoading || isRecoveryMode}
                />
              </label>

              {isRecoveryMode ? (
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-slate-700 block">
                    New password
                    <div className="mt-2 relative">
                      <input
                        type={isResetPasswordVisible ? "text" : "password"}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-16 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        placeholder="At least 6 characters"
                        value={resetPassword}
                        onChange={(event) => setResetPassword(event.target.value)}
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                      <button
                        type="button"
                        disabled={isLoading}
                        aria-pressed={isResetPasswordVisible}
                        aria-label={
                          isResetPasswordVisible
                            ? "Hide password"
                            : "Show password"
                        }
                        onClick={() => setIsResetPasswordVisible((prev) => !prev)}
                        className="absolute inset-y-0 right-3 my-auto text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
                      >
                        {isResetPasswordVisible ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>
                  <label className="text-sm font-semibold text-slate-700 block">
                    Confirm new password
                    <div className="mt-2 relative">
                      <input
                        type={isResetPasswordVisible ? "text" : "password"}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-16 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        placeholder="Re-enter new password"
                        value={resetPasswordConfirm}
                        onChange={(event) =>
                          setResetPasswordConfirm(event.target.value)
                        }
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                      <button
                        type="button"
                        disabled={isLoading}
                        aria-pressed={isResetPasswordVisible}
                        aria-label={
                          isResetPasswordVisible
                            ? "Hide password"
                            : "Show password"
                        }
                        onClick={() => setIsResetPasswordVisible((prev) => !prev)}
                        className="absolute inset-y-0 right-3 my-auto text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
                      >
                        {isResetPasswordVisible ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>
                </div>
              ) : (
                <label className="text-sm font-semibold text-slate-700 block">
                  Password
                  <div className="mt-2 relative">
                    <input
                      type={isPasswordVisible ? "text" : "password"}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-16 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      placeholder="Enter admin password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      disabled={isLoading}
                      minLength={6}
                    />
                    <button
                      type="button"
                      disabled={isLoading}
                      aria-pressed={isPasswordVisible}
                      aria-label={
                        isPasswordVisible ? "Hide password" : "Show password"
                      }
                      onClick={() => setIsPasswordVisible((prev) => !prev)}
                      className="absolute inset-y-0 right-3 my-auto text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
                    >
                      {isPasswordVisible ? "Hide" : "Show"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                    className="mt-2 text-xs font-semibold text-[var(--accent)] hover:text-slate-900 disabled:opacity-60"
                  >
                    Forgot password?
                  </button>
                </label>
              )}

              {status && <p className={`rounded-xl px-4 py-3 text-xs ${statusClass}`}>{status}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {isLoading
                  ? "Processing..."
                  : isRecoveryMode
                    ? "Update password"
                    : "Sign in"}
              </button>

              {isRecoveryMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRecoveryMode(false);
                    setResetPassword("");
                    setResetPasswordConfirm("");
                    setIsResetPasswordVisible(false);
                    setStatus("");
                    setStatusType("");
                  }}
                  className="w-full rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  Back to admin sign in
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={handleAccessCodeSubmit} className="space-y-4">
              <label className="text-sm font-semibold text-slate-700">
                Access code
                <div className="mt-2 relative">
                  <input
                    type={isAccessCodeVisible ? "text" : "password"}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-16 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    placeholder="Enter admin access code"
                    value={accessCode}
                    onChange={(event) => setAccessCode(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    aria-pressed={isAccessCodeVisible}
                    aria-label={
                      isAccessCodeVisible ? "Hide access code" : "Show access code"
                    }
                    onClick={() => setIsAccessCodeVisible((prev) => !prev)}
                    className="absolute inset-y-0 right-3 my-auto text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    {isAccessCodeVisible ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              {status && <p className={`rounded-xl px-4 py-3 text-xs ${statusClass}`}>{status}</p>}
              <button
                type="submit"
                className="mt-2 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                Sign in
              </button>
            </form>
          )}

          <div className="flex items-center justify-end text-xs text-slate-500">
            <Link to="/" className="font-semibold text-slate-700">
              Back to store
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
