import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { persistAuthSession } from "../../lib/auth";

const ADMIN_ACCESS_CODE = "pixora-admin";
const ADMIN_DEMO_EMAIL = "admin@pixora.store";

export default function AdminLogin() {
  const [accessCode, setAccessCode] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (accessCode.trim() !== ADMIN_ACCESS_CODE) {
      setStatus("Invalid access code.");
      return;
    }

    persistAuthSession({ email: ADMIN_DEMO_EMAIL, isAdmin: true });
    setStatus("Signed in.");
    navigate("/admin");
  };

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
              This demo uses a local access code stored in the browser.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="text-sm font-semibold text-slate-700">
              Access code
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="Enter admin access code"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                required
              />
            </label>
            {status && <p className="text-xs text-slate-500">{status}</p>}
            <button
              type="submit"
              className="mt-2 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Sign in
            </button>
          </form>
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
