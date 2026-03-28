"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import {
  saveSession,
  getToken,
  getStoredUser,
  clearSession,
  type AuthUser,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  setAuthFromCallback: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore user from localStorage, then validate with /api/auth/me
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Optimistically restore stored user so UI is instant
    const stored = getStoredUser();
    if (stored) setUser(stored);

    // Validate token is still good
    api
      .get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const fresh: AuthUser = res.data.user;
        setUser(fresh);
        saveSession(token, fresh);
      })
      .catch(() => {
        // Token expired or revoked
        clearSession();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Called by /auth/callback page after GitHub redirects back
  const setAuthFromCallback = useCallback(async (token: string) => {
    const res = await api.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const fresh: AuthUser = res.data.user;
    saveSession(token, fresh);
    setUser(fresh);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
        setAuthFromCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
