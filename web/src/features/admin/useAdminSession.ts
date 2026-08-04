import { useCallback, useEffect, useState } from "react";

import { api } from "@/shared/api/client";
import type { AdminProfile } from "@/shared/types/api";

const TOKEN_KEY = "kcc.admin.token";

/**
 * Admin session.
 *
 * The token is a Supabase access token obtained through OUR backend — the
 * browser never talks to Supabase directly and never holds a Supabase API key.
 * sessionStorage rather than localStorage: a staff token should not outlive the
 * browser session on a shared machine.
 */
export function useAdminSession() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [checking, setChecking] = useState(token !== null);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    void api.admin
      .me(token)
      .then((me) => {
        if (!cancelled) setProfile(me);
      })
      .catch(() => {
        // Expired or revoked — drop it rather than leave a dead session around.
        if (cancelled) return;
        setProfile(null);
        setToken(null);
        try {
          sessionStorage.removeItem(TOKEN_KEY);
        } catch {
          // Ignore.
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api.admin.login(email, password);
    try {
      sessionStorage.setItem(TOKEN_KEY, session.access_token);
    } catch {
      // Ignore — the session still works until reload.
    }
    setToken(session.access_token);
  }, []);

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore.
    }
    setToken(null);
    setProfile(null);
  }, []);

  return { token, profile, checking, signIn, signOut };
}
