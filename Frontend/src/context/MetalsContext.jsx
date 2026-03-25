import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { metalsApi } from "../api/metalsApi";
import { useAuth } from "../hooks/useAuth";

export const MetalsContext = createContext(null);

export function MetalsProvider({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedMetal, setSelectedMetal] = useState("overview");
  const [health, setHealth] = useState(null);
  const [goldSummary, setGoldSummary] = useState(null);
  const [silverSummary, setSilverSummary] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHealth = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const response = await metalsApi.health();
      setHealth(response.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to load metals health.");
    }
  }, [isAuthenticated]);

  const loadSummaries = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const [goldResponse, silverResponse] = await Promise.all([
        metalsApi.summary("gold"),
        metalsApi.summary("silver"),
      ]);
      setGoldSummary(goldResponse.data);
      setSilverSummary(silverResponse.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to load metals summaries.");
    }
  }, [isAuthenticated]);

  const triggerSync = useCallback(async () => {
    if (!isAuthenticated) {
      return null;
    }
    setSyncLoading(true);
    try {
      const response = await metalsApi.sync();
      await Promise.all([loadHealth(), loadSummaries()]);
      return response.data;
    } finally {
      setSyncLoading(false);
    }
  }, [isAuthenticated, loadHealth, loadSummaries]);

  const refreshMetals = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    await Promise.all([loadHealth(), loadSummaries()]);
  }, [isAuthenticated, loadHealth, loadSummaries]);

  useEffect(() => {
    if (authLoading) {
      return undefined;
    }

    if (!isAuthenticated) {
      setHealth(null);
      setGoldSummary(null);
      setSilverSummary(null);
      setError("");
      setSyncLoading(false);
      return undefined;
    }

    loadHealth();
    loadSummaries();

    const intervalId = window.setInterval(() => {
      loadHealth();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [authLoading, isAuthenticated, loadHealth, loadSummaries]);

  const value = useMemo(
    () => ({
      selectedMetal,
      setSelectedMetal,
      syncStatus: health,
      triggerSync,
      syncLoading,
      goldSummary,
      silverSummary,
      refreshMetals,
      error,
    }),
    [error, goldSummary, health, refreshMetals, selectedMetal, silverSummary, syncLoading, triggerSync]
  );

  return <MetalsContext.Provider value={value}>{children}</MetalsContext.Provider>;
}
