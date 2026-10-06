import { useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { api } from "../api/axios";

// ✅ Read token once, outside the component
const hasToken = () => !!localStorage.getItem("accessToken");

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // ✅ Initial state is already correct — no sync setLoading needed
  const [loading, setLoading] = useState(hasToken());

  useEffect(() => {
    if (!hasToken()) return; // already loading=false from initial state

    let cancelled = false;

    const fetchMe = async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (!cancelled) setUser(data.user);
      } catch (err) {
        console.error("fetchMe failed:", err.response?.status, err.message);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false); // ✅ async callback, not sync effect body
      }
    };

    fetchMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("accessToken", data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("accessToken", data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      localStorage.removeItem("accessToken");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
