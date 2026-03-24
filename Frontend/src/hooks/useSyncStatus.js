import { useContext, useEffect, useMemo, useState } from "react";

import { MetalsContext } from "../context/MetalsContext";

const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export function useSyncStatus(metal = null) {
  const { syncStatus, triggerSync, syncLoading, error } = useContext(MetalsContext);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const lastSync = useMemo(() => {
    if (!syncStatus) {
      return null;
    }

    if (metal && metal !== "overview") {
      return syncStatus[`${metal}_last_sync`] || null;
    }

    const goldTime = syncStatus.gold_last_sync ? new Date(syncStatus.gold_last_sync).getTime() : 0;
    const silverTime = syncStatus.silver_last_sync ? new Date(syncStatus.silver_last_sync).getTime() : 0;
    const latestTime = Math.max(goldTime, silverTime);
    return latestTime > 0 ? new Date(latestTime).toISOString() : null;
  }, [metal, syncStatus]);

  const lastSyncDate = lastSync ? new Date(lastSync) : null;
  const staleThreshold = 60 * 60 * 1000;
  const isStale = !lastSyncDate || now - lastSyncDate.getTime() > staleThreshold;
  const nextSyncIn = lastSyncDate ? formatCountdown(lastSyncDate.getTime() + staleThreshold - now) : "--:--";
  const status = error ? "error" : isStale ? "stale" : "fresh";

  return {
    lastSync,
    isStale,
    nextSyncIn,
    triggerSync,
    syncLoading,
    status,
  };
}
