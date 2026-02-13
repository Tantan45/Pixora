import { supabase, isSupabaseConfigured } from "./supabase";

export const ADMIN_EMAILS = [
  "admin@pixora.com",
  "admin@pixora.store",
  "jonathanpalomar85@gmail.com",
  "jonthanpalomar85@gmail.com",
];

const normalizeEmail = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const isAdminEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  return (
    ADMIN_EMAILS.includes(normalizedEmail) || normalizedEmail.includes("admin")
  );
};

export const clearStoredAuth = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("pixoraCustomer");
  localStorage.removeItem("pixoraAdmin");
  localStorage.removeItem("pixoraAdminUser");
};

export const persistAuthSession = ({ email, isAdmin }) => {
  if (typeof window === "undefined") return;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    clearStoredAuth();
    return;
  }

  localStorage.setItem("pixoraCustomer", normalizedEmail);

  if (isAdmin) {
    localStorage.setItem("pixoraAdmin", "true");
    localStorage.setItem("pixoraAdminUser", normalizedEmail);
    return;
  }

  localStorage.removeItem("pixoraAdmin");
  localStorage.removeItem("pixoraAdminUser");
};

export const getStoredAuth = () => {
  if (typeof window === "undefined") {
    return {
      isAuthenticated: false,
      isAdmin: false,
      email: "",
      source: "none",
    };
  }

  const customer = normalizeEmail(localStorage.getItem("pixoraCustomer"));
  const adminUser = normalizeEmail(localStorage.getItem("pixoraAdminUser"));
  const storedAdminFlag = localStorage.getItem("pixoraAdmin") === "true";
  const email = adminUser || customer;

  return {
    isAuthenticated: Boolean(email || storedAdminFlag),
    isAdmin: storedAdminFlag || isAdminEmail(email),
    email,
    source: email ? "local" : "none",
  };
};

export const resolveAuthState = async () => {
  if (isSupabaseConfigured) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const email = normalizeEmail(user.email);
        const isAdmin = isAdminEmail(email);
        persistAuthSession({ email, isAdmin });
        return {
          isAuthenticated: true,
          isAdmin,
          email,
          user,
          source: "supabase",
        };
      }
    } catch {
      // Fall through to local auth for demo / offline support.
    }
  }

  const stored = getStoredAuth();
  return {
    ...stored,
    user: stored.email ? { email: stored.email, demo: true } : null,
  };
};

export const signOutEverywhere = async () => {
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore errors
    }
  }
  clearStoredAuth();
};
