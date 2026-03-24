export default function Drawer({ open, title, children, onClose, widthClass = "max-w-xl" }) {
  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full ${widthClass} transform border-l border-border bg-elevated shadow-panel transition duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="font-display text-2xl text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-chip border border-white/10 px-3 py-1 text-sm text-muted transition hover:text-text"
          >
            Close
          </button>
        </div>
        <div className="scrollbar-thin overflow-y-auto px-6 py-5" style={{ height: "calc(100% - 73px)" }}>
          {children}
        </div>
      </aside>
    </div>
  );
}
