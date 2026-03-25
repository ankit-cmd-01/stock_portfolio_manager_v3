import { BellRing, BriefcaseBusiness, Coins, LayoutDashboard, LogOut, Lock, PencilLine, Settings2, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

import { resolveBackendUrl } from "../config/runtime";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/portfolios", label: "My Portfolios", icon: BriefcaseBusiness },
  { to: "/metals", label: "Metals", icon: Coins },
];

const featureItems = [
  { label: "Watchlist", hint: "coming soon", icon: BellRing },
  { label: "AI Signals", hint: "beta", icon: Sparkles, locked: true },
];

const resolveProfilePic = (value) => {
  if (!value) {
    return "";
  }
  return resolveBackendUrl(value);
};

export default function Sidebar({ user, onLogout, onOpenProfile, mobile = false }) {
  return (
    <aside
      className={`w-56 shrink-0 border-r border-border bg-slate-950 px-3 py-5 ${
        mobile ? "flex w-full flex-col" : "hidden lg:flex lg:flex-col"
      }`}
    >
      <div className="mb-7 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-panel border border-primary/30 bg-primary/10 font-display text-base tracking-widest text-primary">
          AS
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">AI StockAnalysis</p>
          <h1 className="font-display text-[1.75rem] leading-none text-text">Terminal</h1>
        </div>
      </div>

      <div className="panel relative mb-7 bg-white/5 p-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Investor</p>
        <div className="mt-3 flex items-center gap-3">
          {user?.profile_pic ? (
            <img
              src={resolveProfilePic(user.profile_pic)}
              alt={user?.first_name ? `${user.first_name} profile` : "Profile"}
              className="h-10 w-10 rounded-full border border-primary/20 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {user?.first_name?.[0] || "U"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[1.05rem] font-semibold leading-6 text-text">
              {user?.first_name ? `${user.first_name} ${user.last_name || ""}` : "Guest Investor"}
            </p>
            <p className="truncate text-[12px] text-muted">{user?.email || "Sign in to sync"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenProfile}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-panel border border-border bg-base text-muted transition hover:border-primary/30 hover:text-text"
          aria-label="Edit profile"
        >
          <PencilLine size={15} />
        </button>
      </div>

      <nav className="space-y-2" aria-label="Sidebar navigation">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-panel px-4 py-3 text-[0.98rem] font-semibold transition ${
                isActive
                  ? "bg-primary/12 text-text shadow-cyan"
                  : "text-muted hover:bg-white/5 hover:text-text"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
                ) : null}
                <Icon size={17} className={isActive ? "text-primary" : ""} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {featureItems.map(({ label, hint, icon: Icon, locked }) => (
          <div
            key={label}
            className="group relative flex items-center justify-between rounded-panel border border-border bg-white/5 px-4 py-3 text-[0.96rem] text-muted"
          >
            <div className="flex items-center gap-3">
              <Icon size={17} />
              <span className="font-semibold">{label}</span>
            </div>
            <span className="rounded-chip bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
              {hint}
            </span>
            {locked ? <Lock size={12} className="absolute right-3 top-3 text-muted" /> : null}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-panel">
              <div className="skeleton absolute inset-y-0 -left-full w-1/2 opacity-20" />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onOpenProfile}
          className="flex w-full items-center gap-3 rounded-panel px-4 py-3 text-[0.98rem] font-semibold text-muted transition hover:bg-white/5 hover:text-text"
        >
          <Settings2 size={17} />
          <span>Profile Settings</span>
        </button>
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="mt-auto flex items-center gap-3 rounded-panel border border-border px-4 py-3 text-[0.98rem] font-semibold text-muted transition hover:border-primary/30 hover:text-text"
      >
        <LogOut size={17} />
        <span>Logout</span>
      </button>
    </aside>
  );
}
