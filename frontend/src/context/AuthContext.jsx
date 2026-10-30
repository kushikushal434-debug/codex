import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, setCsrfToken } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await authApi.getMe();
      if (res.authenticated && res.user) {
        setUser(res.user);
        if (res.csrf_token) setCsrfToken(res.csrf_token);
      } else {
        setUser(null);
        // Still fetch a CSRF token for guest verification calls
        await authApi.fetchCsrf().catch(() => {});
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (usernameOrEmail, password) => {
    const res = await authApi.login(usernameOrEmail, password);
    setUser(res.user);
    if (res.csrf_token) setCsrfToken(res.csrf_token);
    return res;
  };

  const register = async (username, email, password) => {
    const res = await authApi.register(username, email, password);
    setUser(res.user);
    if (res.csrf_token) setCsrfToken(res.csrf_token);
    return res;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
    refreshUser: checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
