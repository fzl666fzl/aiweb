"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/client-api";
import type { MembershipSummary } from "@/lib/membership";

type CurrentUser = {
  email: string;
  membership: MembershipSummary;
};

type SessionStatus = "checking" | "authenticated" | "guest";

type SessionContextValue = {
  status: SessionStatus;
  user: CurrentUser | null;
  refresh: () => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchCurrentUser() {
  const data = await apiJson<{ user: CurrentUser }>("/api/me");
  return data.user;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [user, setUser] = useState<CurrentUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const nextUser = await fetchCurrentUser();
      setUser(nextUser);
      setStatus("authenticated");
      return nextUser;
    } catch {
      setUser(null);
      setStatus("guest");
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    await apiJson<{ ok: true }>("/api/logout", { method: "POST" });
    setUser(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(async () => {
      try {
        const nextUser = await fetchCurrentUser();
        if (!cancelled) {
          setUser(nextUser);
          setStatus("authenticated");
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setStatus("guest");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ status, user, refresh, logout }), [status, user, refresh, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error("useSession must be used inside SessionProvider");
  }

  return value;
}

export function useOptionalSession() {
  return useContext(SessionContext);
}
