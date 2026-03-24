import { RefreshCw } from "lucide-react";

import { useSyncStatus } from "../../hooks/useSyncStatus";
import { formatTimestamp } from "../../utils/metalsHelpers";

const statusStyles = {
  fresh: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  stale: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function SyncStatusBar({ metal = null }) {
  const { lastSync, isStale, nextSyncIn, triggerSync, syncLoading, status } = useSyncStatus(metal);

  const resolvedStatus = status === "error" ? "error" : isStale ? "stale" : "fresh";
  const statusLabel = resolvedStatus === "fresh" ? "Fresh" : resolvedStatus === "stale" ? "Stale" : "Error";
  const relativeLabel = lastSync
    ? `${Math.max(1, Math.round((Date.now() - new Date(lastSync).getTime()) / 60000))} mins ago`
    : "No sync yet";

  return (
    <div className="panel flex flex-col gap-4 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className={`inline-flex items-center gap-2 rounded-chip px-3 py-1 text-xs font-semibold uppercase tracking-widest ${statusStyles[resolvedStatus]}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
          {statusLabel}
        </div>
        <p className="text-sm text-muted">
          Last sync: {lastSync ? `${formatTimestamp(lastSync)} | ${relativeLabel}` : "Waiting for the first sync"}
        </p>
      </div>

      <div className="text-sm text-muted">
        Auto-sync in: <span className="font-mono text-text">{nextSyncIn}</span>
      </div>

      <button
        type="button"
        onClick={triggerSync}
        disabled={syncLoading}
        className="inline-flex items-center justify-center gap-2 rounded-panel bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:shadow-cyan disabled:cursor-not-allowed disabled:opacity-60 lg:min-w-36"
      >
        {syncLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
        ) : (
          <RefreshCw size={16} />
        )}
        Sync Now
      </button>
    </div>
  );
}
