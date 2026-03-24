import { createContext, useEffect, useMemo, useState } from "react";

import {
  getUserProfile,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordResetOtp,
  resendRegisterOtp,
  resetUserPassword,
  verifyResetEmail,
  verifyResetOtp,
  updateUserProfile,
  verifyOtp,
} from "../api/auth";

export const AuthContext = createContext(null);

const getStoredTokens = () => ({
  access: localStorage.getItem("access_token"),
  refresh: localStorage.getItem("refresh_token"),
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getStoredTokens().access));
  const [loading, setLoading] = useState(true);

  const persistTokens = (tokens) => {
    if (tokens?.access) {
      localStorage.setItem("access_token", tokens.access);
    }
    if (tokens?.refresh) {
      localStorage.setItem("refresh_token", tokens.refresh);
    }
  };

  const clearSession = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setIsAuthenticated(false);
  };

  const hydrateProfile = async () => {
    try {
      const profile = await getUserProfile();
      setUser(profile);
      setIsAuthenticated(true);
    } catch (error) {
      clearSession();
      throw error;
    }
  };

  useEffect(() => {
    const boot = async () => {
      const { access } = getStoredTokens();
      if (!access) {
        setLoading(false);
        return;
      }

      try {
        await hydrateProfile();
      } catch (error) {
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    boot();
  }, []);

  const login = async (payload) => {
    const response = await loginUser(payload);
    if (!response?.tokens?.access || !response?.tokens?.refresh) {
      throw new Error("Login succeeded, but the session token payload was incomplete.");
    }

    persistTokens(response.tokens);
    setIsAuthenticated(true);
    if (response.user) {
      setUser(response.user);
    }

    await hydrateProfile();
    return response;
  };

  const register = async (payload) => registerUser(payload);

  const confirmOtp = async (payload) => {
    const response = await verifyOtp(payload);
    persistTokens(response.tokens);
    await hydrateProfile();
    return response;
  };

  const resendOtp = async (payload) => resendRegisterOtp(payload);

  const updateProfile = async (payload) => {
    const response = await updateUserProfile(payload);
    if (response?.data) {
      setUser(response.data);
    }
    return response;
  };

  const sendPasswordResetOtp = async (payload) => requestPasswordResetOtp(payload);

  const checkPasswordResetEmail = async (payload) => verifyResetEmail(payload);

  const checkPasswordResetOtp = async (payload) => verifyResetOtp(payload);

  const changePassword = async (payload) => resetUserPassword(payload);

  const logout = async () => {
    const refresh = localStorage.getItem("refresh_token");
    try {
      if (refresh) {
        await logoutUser(refresh);
      }
    } catch (error) {
      // Ignore logout API failures and clear local state.
    } finally {
      clearSession();
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated,
      login,
      register,
      confirmOtp,
      resendOtp,
      updateProfile,
      sendPasswordResetOtp,
      checkPasswordResetEmail,
      checkPasswordResetOtp,
      changePassword,
      logout,
      setUser,
    }),
    [user, loading, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
