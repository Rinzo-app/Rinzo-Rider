import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { api, RiderProfile } from "@/lib/api";

interface AuthContextValue {
  rider: RiderProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateRider: (rider: RiderProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await api.getToken();
      if (token) {
        const profile = await api.getProfile();
        setRider(profile);
      }
    } catch {
      setRider(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    setRider(result.rider);
  }

  async function logout() {
    await api.logout();
    setRider(null);
  }

  async function refreshProfile() {
    const profile = await api.getProfile();
    setRider(profile);
  }

  function updateRider(updated: RiderProfile) {
    setRider(updated);
  }

  const value = useMemo(
    () => ({
      rider,
      isLoading,
      isAuthenticated: !!rider,
      login,
      logout,
      refreshProfile,
      updateRider,
    }),
    [rider, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
