import {
  ArrowRight,
  Bot,
  CandlestickChart,
  ChevronRight,
  Database,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: ShieldCheck,
    title: "Portfolio Control",
    body: "Separate long-term, tactical, metals, or theme baskets with a dashboard that surfaces what matters first.",
  },
  {
    icon: CandlestickChart,
    title: "Market Structure",
    body: "Explore one year of 1-hour OHLCV behavior so each stock has context, not just a last price.",
  },
  {
    icon: Bot,
    title: "AI Intelligence",
    body: "Blend earnings commentary, news sentiment, and valuation clues into a single investor workflow.",
  },
  {
    icon: Database,
    title: "Persistent Cache",
    body: "Fetched news, earnings snapshots, and computed insights stay reusable instead of being recalculated every time.",
  },
];

const workflow = [
  {
    step: "01",
    title: "Build portfolios",
    body: "Create custom baskets or seed them from suggested portfolio ideas aligned to themes and sectors.",
  },
  {
    step: "02",
    title: "Sync market data",
    body: "Pull price history, PE context, and ticker intelligence into the backend so every stock has a usable timeline.",
  },
  {
    step: "03",
    title: "Analyze faster",
    body: "Open Advanced Features to review sentiment, earnings summaries, and recent article tone for a clicked stock.",
  },
];

const proofPoints = [
  { label: "Portfolio views", value: "Multi-basket" },
  { label: "Market data lens", value: "1h OHLCV + PE" },
  { label: "AI stack", value: "FinBERT + Groq" },
  { label: "Backend", value: "Django REST" },
];

const footerGroups = [
  {
    title: "Platform",
    links: ["Portfolio management", "Advanced stock analysis", "Metals overview", "Profile settings"],
  },
  {
    title: "Intelligence Layer",
    links: ["News sentiment", "Quarterly earnings summary", "PE signal context", "Incremental cache refresh"],
  },
  {
    title: "Technology",
    links: ["React + Vite frontend", "Django REST backend", "PostgreSQL-ready storage", "yfinance-driven ingestion"],
  },
];

export default function Landing() {
  return (
    <div className="hero-mesh min-h-screen overflow-x-hidden">
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">AI StockAnalysis</p>
            <h1 className="font-display text-2xl text-text">Market Intelligence Terminal</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-panel border border-border px-4 py-2 text-sm font-semibold text-text transition hover:border-primary/40"
            >
              Login
            </Link>
            <Link
              to="/login"
              className="rounded-panel bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:shadow-cyan"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="cyber-grid mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary">Modern stock workspace for active investors</p>
            <h2 className="mt-6 font-display text-5xl leading-none text-text sm:text-6xl lg:text-7xl">
              Track. Compare. Read sentiment. Move with context.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              AI StockAnalysis gives you a premium dashboard for portfolio tracking, price-structure review, earnings
              snapshots, and company-level news sentiment without the clutter of spreadsheet-style tooling.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {proofPoints.map((item) => (
                <div key={item.label} className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-widest text-muted">{item.label}</p>
                  <p className="mt-2 font-display text-2xl text-text">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-panel bg-primary px-5 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-cyan"
              >
                Launch workspace <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-panel border border-border px-5 py-3 text-sm font-semibold text-text transition hover:border-primary/40"
              >
                Explore the platform
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="panel relative overflow-hidden p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-profit/10" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted">Live product snapshot</p>
                    <h3 className="mt-2 font-display text-3xl text-text">Signal Deck</h3>
                  </div>
                  <span className="rounded-chip bg-primary/10 px-3 py-1 text-xs text-primary">Realtime-ready</span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-panel bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-widest text-muted">Best mover</p>
                    <p className="mt-2 font-display text-3xl text-profit">+4.82%</p>
                    <p className="mt-1 text-sm text-muted">Momentum names highlighted first</p>
                  </div>
                  <div className="rounded-panel bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-widest text-muted">Sentiment engine</p>
                    <p className="mt-2 font-display text-3xl text-text">FinBERT</p>
                    <p className="mt-1 text-sm text-muted">Company-level article tone tracking</p>
                  </div>
                </div>

                <div className="mt-6 rounded-panel border border-white/5 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted">Decision view</p>
                      <p className="mt-2 text-lg font-semibold text-text">Price structure + valuation + news</p>
                    </div>
                    <Sparkles size={18} className="text-primary" />
                  </div>
                  <div className="mt-4 grid gap-3">
                    {[
                      ["Portfolio cards", "Quick basket overview with stock counts and update recency"],
                      ["Recent stocks", "Compact board for close, PE, and latest percentage move"],
                      ["Advanced analysis", "Per-stock earnings summary and sentiment breakdown"],
                    ].map(([title, body]) => (
                      <div key={title} className="flex items-start gap-3 rounded-panel bg-base/70 px-4 py-3">
                        <LineChart size={16} className="mt-0.5 text-primary" />
                        <div>
                          <p className="text-sm font-semibold text-text">{title}</p>
                          <p className="mt-1 text-sm text-muted">{body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, body }, index) => (
              <article
                key={title}
                className="panel animate-floatUp p-5"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-panel bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 font-display text-2xl text-text">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <div className="panel grid gap-8 p-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-primary">How it works</p>
              <h3 className="mt-4 font-display text-4xl text-text">
                A cleaner path from raw ticker data to investor-ready insight.
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
                The platform is designed to reduce context switching. Instead of opening separate apps for prices,
                valuation, and company news, each stock view carries the core signals together.
              </p>
            </div>

            <div className="grid gap-4">
              {workflow.map((item) => (
                <div key={item.step} className="rounded-panel border border-white/5 bg-white/[0.04] p-5">
                  <p className="font-display text-3xl text-primary">{item.step}</p>
                  <p className="mt-3 text-xl font-semibold text-text">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="panel p-6">
              <p className="text-xs uppercase tracking-widest text-primary">Built for clarity</p>
              <h3 className="mt-3 font-display text-3xl text-text">No more dashboard sprawl.</h3>
              <p className="mt-4 text-sm leading-7 text-muted">
                The interface focuses on the signals you actually act on: current movers, portfolio health, and stock-specific intelligence.
              </p>
            </div>
            <div className="panel p-6">
              <p className="text-xs uppercase tracking-widest text-primary">Secure account flow</p>
              <h3 className="mt-3 font-display text-3xl text-text">Telegram-backed OTP support.</h3>
              <p className="mt-4 text-sm leading-7 text-muted">
                Registration and password-reset flows are designed around authenticated account recovery, not just a basic form.
              </p>
            </div>
            <div className="panel p-6">
              <p className="text-xs uppercase tracking-widest text-primary">Research speed</p>
              <h3 className="mt-3 font-display text-3xl text-text">From click to context faster.</h3>
              <p className="mt-4 text-sm leading-7 text-muted">
                Open a stock and move directly into charts, earnings readouts, and current news tone without rebuilding the context every time.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-12 border-t border-white/5 bg-black/20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1.1fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary">AI StockAnalysis</p>
            <h3 className="mt-4 font-display text-3xl text-text">A compact terminal for modern stock research.</h3>
            <p className="mt-4 text-sm leading-7 text-muted">
              Built to help investors organize portfolios, compare price behavior, review earnings context, and read company-level sentiment from a single workspace.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-panel border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-text">
              <LockKeyhole size={16} className="text-primary" />
              Portfolio data, profile settings, and API-backed flows in one authenticated app
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold uppercase tracking-widest text-text">{group.title}</p>
              <div className="mt-4 space-y-3">
                {group.links.map((item) => (
                  <p key={item} className="text-sm text-muted">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 text-sm text-muted lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <p>Frontend: React + Vite. Backend: Django REST. Data layer: PostgreSQL-ready, yfinance-backed.</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/login" className="transition hover:text-text">
                Login
              </Link>
              <Link to="/login" className="transition hover:text-text">
                Open workspace
              </Link>
              <span className="inline-flex items-center gap-2 text-primary">
                Explore the terminal <ChevronRight size={14} />
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
