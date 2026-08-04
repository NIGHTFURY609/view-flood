import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Cookies from "js-cookie";

import { adminClient } from "@/features/admin/api/adminClient";

const LOGGED_IN_COOKIE = "logged_in";

export interface AdminProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
}

interface AuthContextValue {
  user: AdminProfile | null;
  isAuthenticated: boolean;
  /** True only while the initial /me probe is in flight. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // On every mount/reload: probe /me ONLY if the logged_in cookie says a session
  // exists. No cookie → no wasted round-trip, straight to the login screen.
  useEffect(() => {
    let cancelled = false;

    if (!Cookies.get(LOGGED_IN_COOKIE)) {
      setLoading(false);
      return;
    }

    adminClient
      .get<AdminProfile>("/auth/me")
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    await adminClient.post("/auth/login", { email, password });
    const res = await adminClient.get<AdminProfile>("/auth/me");
    setUser(res.data);
  }

  async function logout() {
    await adminClient.post("/auth/logout").catch(() => null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
