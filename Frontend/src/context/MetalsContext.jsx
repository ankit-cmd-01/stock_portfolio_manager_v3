import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { metalsApi } from "../api/metalsApi";

export const MetalsContext = createContext(null);

export function MetalsProvider({ children }) {
  const [selectedMetal, setSelectedMetal] = useState("overview");
  const [health, setHealth] = useState(null);
  const [goldSummary, setGoldSummary] = useState(null);
  const [silverSummary, setSilverSummary] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHealth = useCallback(async () => {
    try {
      const response = await metalsApi.health();
      setHealth(response.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to load metals health.");
    }
  }, []);

  const loadSummaries = useCallback(async () => {
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
  }, []);

  const triggerSync = useCallback(async () => {
    setSyncLoading(true);
    try {
      const response = await metalsApi.sync();
      await Promise.all([loadHealth(), loadSummaries()]);
      return response.data;
    } finally {
      setSyncLoading(false);
    }
  }, [loadHealth, loadSummaries]);

  const refreshMetals = useCallback(async () => {
    await Promise.all([loadHealth(), loadSummaries()]);
  }, [loadHealth, loadSummaries]);

  useEffect(() => {
    loadHealth();
    loadSummaries();

    const intervalId = window.setInterval(() => {
      loadHealth();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

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
