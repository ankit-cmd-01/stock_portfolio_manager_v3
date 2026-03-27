import { BellRing, BriefcaseBusiness, Coins, LayoutDashboard, LogOut, Lock, PencilLine, Settings2, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

import { resolveBackendUrl } from "../config/runtime";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/portfolios", label: "My Portfolios", icon: BriefcaseBusiness },
  { to: "/quality-stocks", label: "Quality Stocks", icon: Sparkles },
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

function SectionLabel({ children }) {
  return (
    <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-dim">
      {children}
    </p>
  );
}

export default function Sidebar({ user, onLogout, onOpenProfile, mobile = false }) {
  return (
    <aside
      className={`w-56 shrink-0 border-r border-border bg-[#060b16] px-3 py-5 ${
        mobile ? "flex w-full flex-col" : "hidden lg:flex lg:flex-col"
      }`}
    >
      <div className="mb-6 flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-panel border border-primary/20 bg-primary/8 font-display text-sm tracking-[0.18em] text-primary">
          AS
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted">AI StockAnalysis</p>
          <h1 className="font-display text-[1.2rem] leading-none text-text">Terminal</h1>
        </div>
      </div>

      <div className="panel relative mb-6 overflow-hidden border-white/5 bg-white/[0.03] p-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted">Investor</p>
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
            <p className="truncate text-[0.98rem] font-semibold leading-5 text-text">
              {user?.first_name ? `${user.first_name} ${user.last_name || ""}` : "Guest Investor"}
            </p>
            <p className="truncate text-[11px] text-muted">{user?.email || "Sign in to sync"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenProfile}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-panel border border-white/10 bg-base/80 text-muted transition hover:border-primary/30 hover:text-text"
          aria-label="Edit profile"
        >
          <PencilLine size={15} />
        </button>
      </div>

      <nav className="space-y-5" aria-label="Sidebar navigation">
        <div className="space-y-2">
          <SectionLabel>Workspace</SectionLabel>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-panel px-4 py-3 text-[0.95rem] font-semibold transition ${
                isActive
                  ? "border border-primary/20 bg-primary/10 text-text shadow-cyan"
                  : "border border-transparent text-muted hover:border-white/5 hover:bg-white/[0.03] hover:text-text"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
                ) : null}
                <Icon size={16} className={isActive ? "text-primary" : ""} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        </div>

        <div className="space-y-2">
          <SectionLabel>Tools</SectionLabel>
          {featureItems.map(({ label, hint, icon: Icon, locked }) => (
            <div
              key={label}
              className="group relative flex items-center justify-between rounded-panel border border-white/5 bg-white/[0.03] px-4 py-3 text-[0.93rem] text-muted transition hover:border-primary/15 hover:bg-white/[0.04]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon size={16} />
                <span className="truncate font-semibold">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-chip bg-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-primary">
                  {hint}
                </span>
                {locked ? <Lock size={11} className="text-muted" /> : null}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onOpenProfile}
            className="flex w-full items-center gap-3 rounded-panel border border-transparent px-4 py-3 text-[0.95rem] font-semibold text-muted transition hover:border-white/5 hover:bg-white/[0.03] hover:text-text"
          >
            <Settings2 size={16} />
            <span>Profile Settings</span>
          </button>
        </div>
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="mt-auto flex items-center gap-3 rounded-panel border border-white/8 bg-white/[0.02] px-4 py-3 text-[0.95rem] font-semibold text-muted transition hover:border-primary/20 hover:bg-white/[0.04] hover:text-text"
      >
        <LogOut size={16} />
        <span>Logout</span>
      </button>
    </aside>
  );
}
