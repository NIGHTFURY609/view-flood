import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { adminClient } from "@/features/admin/api/adminClient";
import { AUTH_MODE, hasSession, tokenStore } from "@/features/admin/auth/tokenStore";
import type { AdminProfile } from "@/features/admin/types";

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

  // On every mount/reload: probe /me ONLY if a session plausibly exists (a stored
  // token in bearer mode, or the logged_in cookie in cookie mode). Otherwise skip
  // the round-trip and go straight to the login screen.
  useEffect(() => {
    let cancelled = false;

    if (!hasSession()) {
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
    const res = await adminClient.post<{ access_token?: string; refresh_token?: string }>(
      "/auth/login",
      { email, password },
    );
    if (AUTH_MODE === "bearer" && res.data.access_token) {
      tokenStore.set(res.data.access_token, res.data.refresh_token);
    }
    const me = await adminClient.get<AdminProfile>("/auth/me");
    setUser(me.data);
  }

  async function logout() {
    await adminClient.post("/auth/logout").catch(() => null);
    tokenStore.clear();
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
