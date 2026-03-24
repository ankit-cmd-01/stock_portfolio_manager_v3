import { ArrowRight, Bot, CandlestickChart, ChevronRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: ShieldCheck,
    title: "Portfolio Tracking",
    body: "Organize stocks across multiple portfolios with a workspace that stays crisp under real market density.",
  },
  {
    icon: Bot,
    title: "AI PE Analysis",
    body: "Historical PE ratios are layered directly into your stock views for faster, sharper valuation reads.",
  },
  {
    icon: CandlestickChart,
    title: "1-Hour OHLCV",
    body: "One full year of intraday market structure gives every holding a measurable narrative.",
  },
];

const steps = [
  "Create a portfolio",
  "Add stocks and fetch data",
  "Analyze PE trends and OHLCV charts",
];

export default function Landing() {
  return (
    <div className="hero-mesh min-h-screen">
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">AI StockAnalysis</p>
            <h1 className="font-display text-2xl text-text">Market Intelligence</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-panel border border-border px-4 py-2 text-sm font-semibold text-text transition hover:border-primary/40"
            >
              View Demo
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
        <section className="cyber-grid mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary">Bloomberg Terminal meets modern Indian fintech</p>
            <h2 className="mt-6 font-display text-5xl leading-none text-text sm:text-6xl lg:text-7xl">
              Your Stocks. Analyzed by AI.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Track portfolios, visualize OHLCV data, and uncover PE insights
              in one dark, premium control room built for Indian retail investors.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-panel bg-primary px-5 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-cyan"
              >
                Get Started <ArrowRight size={16} />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-panel border border-border px-5 py-3 text-sm font-semibold text-text transition hover:border-primary/40"
              >
                View Demo
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="panel relative overflow-hidden p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-profit/5" />
              <div className="relative z-10">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted">Live widget</p>
                    <h3 className="font-display text-2xl text-text">NIFTY Pulse</h3>
                  </div>
                  <span className="rounded-chip bg-profit/10 px-3 py-1 text-xs text-profit">
                    +2.41%
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {["Open", "High", "Low", "Close"].map((label, index) => (
                    <div key={label} className="rounded-panel bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
                      <p className="mt-2 font-mono text-sm text-text">
                        Rs {(24810 + index * 52).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex h-48 items-end gap-2 rounded-panel bg-gradient-to-t from-primary/10 to-transparent p-4">
                  {[26, 42, 34, 54, 68, 61, 83, 77, 95, 88, 102, 110].map((height, index) => (
                    <div
                      key={height}
                      className="flex-1 animate-drift rounded-t-md bg-gradient-to-t from-primary to-cyan-200"
                      style={{ height: `${height}px`, animationDelay: `${index * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
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

        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="panel grid gap-8 p-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <p className="text-xs uppercase tracking-widest text-primary">How it works</p>
              <h3 className="mt-4 font-display text-4xl text-text">From portfolio to signal in three moves.</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
              {steps.map((step, index) => (
                <div key={step} className="rounded-panel border border-white/5 bg-white/5 p-5">
                  <p className="font-display text-3xl text-primary">0{index + 1}</p>
                  <p className="mt-3 text-sm leading-7 text-muted">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p className="font-display text-lg text-text">AI StockAnalysis</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/login" className="transition hover:text-text">
              Login
            </Link>
            <Link to="/dashboard" className="transition hover:text-text">
              Dashboard
            </Link>
            <p>Powered by yfinance + Django REST</p>
            <span className="inline-flex items-center gap-2 text-primary">
              Explore now <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
