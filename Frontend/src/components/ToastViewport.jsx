export default function ToastViewport({ toast, onClose }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50">
      <div
        className={`pointer-events-auto w-80 rounded-panel border px-4 py-3 shadow-panel transition ${
          toast
            ? "translate-y-0 opacity-100"
            : "translate-y-3 opacity-0"
        } ${
          toast?.type === "error"
            ? "border-loss/30 bg-loss/10 text-rose-100"
            : "border-primary/30 bg-primary/10 text-cyan-50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">
              {toast?.type === "error" ? "Error" : "Notice"}
            </p>
            <p className="mt-1 text-sm leading-6">{toast?.message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-chip border border-white/10 px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
