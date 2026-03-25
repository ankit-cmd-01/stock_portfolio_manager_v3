import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAppToast } from "../App";
import { createPortfolio } from "../api/stocks";
import Drawer from "../components/Drawer";
import EmptyState from "../components/EmptyState";
import PortfolioStocksMarquee from "../components/PortfolioStocksMarquee";
import SuggestedPortfoliosSection from "../components/SuggestedPortfoliosSection";
import SkeletonBlock from "../components/SkeletonBlock";
import Sparkline from "../components/Sparkline";
import StatsCard from "../components/StatsCard";
import { usePortfolio } from "../hooks/usePortfolio";
import { useSuggestedPortfolios } from "../hooks/useSuggestedPortfolios";
import { useStocks } from "../hooks/useStocks";
import { formatRelativeMinutes } from "../utils/formatDate";
import { formatPrice } from "../utils/formatPrice";
import { peColor } from "../utils/peColor";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { onToast } = useAppToast();
  const { portfolios, loading: portfolioLoading, reload: reloadPortfolios } = usePortfolio();
  const { categories: suggestedCategories, loading: suggestedLoading, error: suggestedError } =
    useSuggestedPortfolios();
  const { stocks, detailsMap, loading: stockLoading, error } = useStocks();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [portfolioForm, setPortfolioForm] = useState({ title: "", description: "" });
  const [submittingPortfolio, setSubmittingPortfolio] = useState(false);
  const [portfolioPage, setPortfolioPage] = useState(0);
  const [portfolioPageDirection, setPortfolioPageDirection] = useState("next");
  const portfolioPageSize = 8;

  const tableRows = useMemo(
    () =>
      stocks.map((stock) => {
        const detail = detailsMap[stock.id];
        const history = detail?.stock_data ?? [];
        const latest = history[history.length - 1];
        const previous = history[history.length - 2];
        const changePct =
          latest && previous && Number(previous.close) !== 0
            ? ((Number(latest.close) - Number(previous.close)) / Number(previous.close)) * 100
            : 0;

        return {
          ...stock,
          close: Number(latest?.close ?? 0),
          volume: Number(latest?.volume ?? 0),
          peRatio: Number(latest?.pe_ratio ?? 0),
          changePct,
          history,
        };
      }),
    [detailsMap, stocks]
  );

  const sortedRows = useMemo(() => {
    const rows = [...tableRows];
    rows.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (typeof a[sortKey] === "string") {
        return a[sortKey].localeCompare(b[sortKey]) * direction;
      }
      return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * direction;
    });
    return rows;
  }, [sortDirection, sortKey, tableRows]);

  const bestPerforming = [...tableRows].sort((a, b) => b.changePct - a.changePct)[0];
  const lowestPe = tableRows.filter((item) => item.peRatio > 0).sort((a, b) => a.peRatio - b.peRatio)[0];
  const recentRows = useMemo(() => sortedRows.slice(0, 4), [sortedRows]);
  const sparklineRows = useMemo(() => sortedRows.slice(0, 6), [sortedRows]);
  const isPortfolioPage = location.pathname === "/portfolios";
  const portfolioPageCount = Math.max(1, Math.ceil(portfolios.length / portfolioPageSize));
  const currentPortfolioPage = Math.min(portfolioPage, portfolioPageCount - 1);
  const pagedPortfolios = useMemo(
    () =>
      portfolios.slice(
        currentPortfolioPage * portfolioPageSize,
        currentPortfolioPage * portfolioPageSize + portfolioPageSize
      ),
    [currentPortfolioPage, portfolios]
  );
  const portfolioStockMap = useMemo(() => {
    const map = new Map();

    tableRows.forEach((stock) => {
      const key = String(stock.portfolio);
      const current = map.get(key) || [];
      current.push(stock);
      map.set(key, current);
    });

    map.forEach((items, key) => {
      map.set(
        key,
        [...items].sort((a, b) => b.close - a.close)
      );
    });

    return map;
  }, [tableRows]);

  useEffect(() => {
    setPortfolioPage(0);
  }, [location.pathname]);

  useEffect(() => {
    setPortfolioPage((current) => Math.min(current, Math.max(0, portfolioPageCount - 1)));
  }, [portfolioPageCount]);

  useEffect(() => {
    if (location.pathname !== "/portfolios") {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById("portfolio-cards")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.pathname]);

  const handlePortfolioPageChange = (nextPage) => {
    if (nextPage === currentPortfolioPage) {
      return;
    }

    setPortfolioPageDirection(nextPage > currentPortfolioPage ? "next" : "prev");
    setPortfolioPage(nextPage);
  };

  const portfolioPageLabel =
    portfolios.length === 0
      ? "Showing 0 of 0 portfolios"
      : `Showing ${currentPortfolioPage * portfolioPageSize + 1}-${Math.min(
          (currentPortfolioPage + 1) * portfolioPageSize,
          portfolios.length
        )} of ${portfolios.length} portfolios`;

  const portfolioPageMotionClass =
    portfolioPageDirection === "next" ? "animate-page-slide-next" : "animate-page-slide-prev";

  const getPortfolioStocks = (portfolioId) => portfolioStockMap.get(String(portfolioId)) || [];
  const featuredPortfolios = pagedPortfolios.slice(0, 3);

  const portfolioPager = (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted">{portfolioPageLabel}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handlePortfolioPageChange(Math.max(currentPortfolioPage - 1, 0))}
          disabled={currentPortfolioPage === 0}
          aria-label="Previous portfolios"
          className="inline-flex h-10 w-10 items-center justify-center rounded-panel border border-border bg-white/5 text-text transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => handlePortfolioPageChange(Math.min(currentPortfolioPage + 1, portfolioPageCount - 1))}
          disabled={currentPortfolioPage >= portfolioPageCount - 1}
          aria-label="Next portfolios"
          className="inline-flex h-10 w-10 items-center justify-center rounded-panel border border-border bg-white/5 text-text transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const handlePortfolioSubmit = async (event) => {
    event.preventDefault();
    setSubmittingPortfolio(true);

    try {
      await createPortfolio(portfolioForm);
      await reloadPortfolios();
      setPortfolioForm({ title: "", description: "" });
      setDrawerOpen(false);
      onToast({ type: "success", message: "Portfolio created successfully." });
    } catch (submitError) {
      onToast({
        type: "error",
        message:
          submitError.response?.data?.title?.[0] ||
          submitError.response?.data?.error ||
          "Unable to create portfolio.",
      });
    } finally {
      setSubmittingPortfolio(false);
    }
  };

  const handleSuggestedPortfolioCreate = async ({ title, description, stock_ids }) => {
    try {
      const response = await createPortfolio({ title, description, stock_ids });
      await reloadPortfolios();
      onToast({
        type: "success",
        message:
          response.seeded_stocks?.length > 0
            ? `${response.portfolio?.title || title} created with ${response.seeded_stocks.length} stocks.`
            : `${response.portfolio?.title || title} created successfully.`,
      });
    } catch (submitError) {
      onToast({
        type: "error",
        message:
          submitError.response?.data?.title?.[0] ||
          submitError.response?.data?.error ||
          "Unable to create suggested portfolio.",
      });
      throw submitError;
    }
  };

  const portfolioCardsSection = (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Section A</p>
          <h2 className="font-display text-3xl text-text">Portfolio Cards</h2>
        </div>
        <div className="flex items-center gap-3">
          {portfolioPager}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-cyan"
          >
            <Plus size={16} />
            New Portfolio
          </button>
        </div>
      </div>

      <div id="portfolio-cards" className={`grid gap-4 md:grid-cols-2 xl:grid-cols-4 ${portfolioPageMotionClass}`} key={currentPortfolioPage}>
        {portfolioLoading
          ? Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-40" />)
          : portfolios.length === 0
            ? (
              <EmptyState
                title="No portfolios yet"
                description="Create your first portfolio to organize and track stocks cleanly."
                action={
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950"
                  >
                    Add New Portfolio
                  </button>
                }
              />
            )
            : pagedPortfolios.map((portfolio, index) => (
                <button
                  key={portfolio.id}
                  type="button"
                  onClick={() => navigate(`/portfolio/${portfolio.id}`)}
                  className="panel hover-panel animate-floatUp p-5 text-left transition hover:shadow-cyan"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted">Portfolio</p>
                      <h3 className="mt-2 font-display text-2xl text-text">{portfolio.title}</h3>
                    </div>
                    <span className="rounded-chip bg-primary/10 px-3 py-1 text-xs text-primary">
                      {getPortfolioStocks(portfolio.id).length} stocks
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted">
                    {portfolio.description || "A clean basket for conviction-based tracking."}
                  </p>
                  <p className="mt-5 text-xs uppercase tracking-widest text-muted">
                    Last updated {formatRelativeMinutes(portfolio.modified_at)}
                  </p>

                  {isPortfolioPage ? <PortfolioStocksMarquee stocks={getPortfolioStocks(portfolio.id)} /> : null}
                </button>
              ))}
      </div>

      <SuggestedPortfoliosSection
        categories={suggestedCategories}
        loading={suggestedLoading}
        error={suggestedError}
        onCreatePortfolio={handleSuggestedPortfolioCreate}
      />
    </section>
  );

  return (
    <div
      className={
        isPortfolioPage
          ? "space-y-8 overflow-x-hidden"
          : "grid gap-5 overflow-x-hidden lg:h-[calc(100vh-7.5rem)] lg:grid-rows-[auto_auto_1fr]"
      }
    >
      {isPortfolioPage ? (
        portfolioCardsSection
      ) : (
        <>
          <section className="panel relative overflow-hidden p-5 lg:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(0,230,118,0.08),transparent_22%)]" />
            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.3em] text-primary">Control Room</p>
                <h1 className="mt-3 font-display text-4xl leading-none text-text xl:text-5xl">
                  Portfolio intelligence that fits in one glance.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted lg:text-base">
                  Track your strongest movers, latest portfolio baskets, and valuation signals without hunting through
                  tables or side-scroll panels.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-cyan"
                  >
                    <Plus size={16} />
                    New Portfolio
                  </button>
                  <Link
                    to="/portfolios"
                    className="inline-flex items-center gap-2 rounded-panel border border-border bg-white/5 px-4 py-3 text-sm font-semibold text-text transition hover:border-primary/30 hover:text-primary"
                  >
                    Open portfolio workspace
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-widest text-muted">Tracked universe</p>
                  <p className="mt-2 font-display text-3xl text-text">{stocks.length}</p>
                  <p className="mt-1 text-xs text-muted">Live stocks across all active baskets</p>
                </div>
                <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-widest text-muted">Recent leaders</p>
                  <p className="mt-2 font-display text-3xl text-profit">{bestPerforming ? bestPerforming.changePct.toFixed(2) : "0.00"}%</p>
                  <p className="mt-1 truncate text-xs text-muted">{bestPerforming?.ticker || "Waiting for synced moves"}</p>
                </div>
                <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-widest text-muted">Value signal</p>
                  <p className="mt-2 font-display text-3xl text-gold">{lowestPe ? lowestPe.peRatio.toFixed(2) : "--"}</p>
                  <p className="mt-1 truncate text-xs text-muted">{lowestPe?.ticker || "PE sync pending"}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard label="Total Stocks Tracked" value={stocks.length} hint="All active user_stocks currently in your terminal." />
            <StatsCard label="Total Portfolios" value={portfolios.length} hint="Separate long-term, tactical, or value baskets cleanly." />
            <StatsCard
              label="Best Performing Stock"
              value={bestPerforming ? bestPerforming.changePct.toFixed(2) : "0.00"}
              hint={bestPerforming ? `${bestPerforming.ticker} is leading by close delta.` : "Waiting for richer price history."}
              accent="text-profit"
            />
            <StatsCard
              label="Lowest PE Stock"
              value={lowestPe ? lowestPe.peRatio.toFixed(2) : "0.00"}
              hint={lowestPe ? `${lowestPe.ticker} currently reads as your value-pick indicator.` : "PE data appears after market data is synced."}
              accent="text-gold"
            />
          </section>

          <section className="grid gap-5 lg:min-h-0 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="panel flex min-h-0 flex-col p-5 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted">Section A</p>
                  <h2 className="font-display text-3xl text-text">Portfolio Snapshot</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-chip bg-white/5 px-3 py-2 text-xs uppercase tracking-widest text-muted">
                    {portfolioPageLabel}
                  </span>
                  <Link
                    to="/portfolios"
                    className="inline-flex items-center gap-2 rounded-panel border border-border bg-white/5 px-4 py-3 text-sm font-semibold text-text transition hover:border-primary/30 hover:text-primary"
                  >
                    View all
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid flex-1 gap-4 lg:min-h-0">
                {portfolioLoading ? (
                  Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="h-28 w-full" />)
                ) : featuredPortfolios.length === 0 ? (
                  <EmptyState
                    title="No portfolios yet"
                    description="Create your first portfolio to organize and track stocks cleanly."
                    action={
                      <button
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950"
                      >
                        Add New Portfolio
                      </button>
                    }
                  />
                ) : (
                  featuredPortfolios.map((portfolio) => {
                    const portfolioStocks = getPortfolioStocks(portfolio.id);
                    const portfolioLeader = portfolioStocks[0];
                    return (
                      <button
                        key={portfolio.id}
                        type="button"
                        onClick={() => navigate(`/portfolio/${portfolio.id}`)}
                        className="rounded-panel border border-border bg-white/[0.03] p-4 text-left transition hover:border-primary/30 hover:shadow-cyan"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-widest text-muted">Portfolio</p>
                            <h3 className="mt-2 truncate font-display text-2xl text-text">{portfolio.title}</h3>
                          </div>
                          <span className="rounded-chip bg-primary/10 px-3 py-1 text-xs text-primary">
                            {portfolioStocks.length} stocks
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted">
                          {portfolio.description || "A clean basket for conviction-based tracking."}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-widest text-muted">
                          <span>Updated {formatRelativeMinutes(portfolio.modified_at)}</span>
                          <span className="h-1 w-1 rounded-full bg-border" />
                          <span>
                            Lead mover {portfolioLeader ? `${portfolioLeader.ticker} ${portfolioLeader.changePct >= 0 ? "+" : "-"}${Math.abs(portfolioLeader.changePct).toFixed(2)}%` : "pending"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid gap-5 lg:min-h-0 lg:grid-rows-[1fr_auto]">
              <div className="panel flex min-h-0 flex-col p-5 lg:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted">Section B</p>
                    <h2 className="font-display text-3xl text-text">Recent Stocks</h2>
                  </div>
                  {error ? <span className="text-sm text-loss">{error}</span> : null}
                </div>

                <div className="mt-5 grid flex-1 gap-3 lg:min-h-0">
                  {stockLoading ? (
                    Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-20 w-full" />)
                  ) : recentRows.length === 0 ? (
                    <EmptyState
                      title="No tracked stocks yet"
                      description="Create a portfolio and add your first ticker to start building your market board."
                    />
                  ) : (
                    recentRows.map((row) => (
                      <Link
                        key={row.id}
                        to={`/stock/${row.id}`}
                        className="grid grid-cols-[minmax(0,1.2fr)_auto_auto] items-center gap-3 rounded-panel border border-white/5 bg-white/[0.03] px-4 py-4 transition hover:border-primary/30 hover:bg-white/[0.05]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-display text-xl text-text">{row.ticker}</p>
                          <p className="truncate text-sm text-muted">{row.company_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm text-text">{formatPrice(row.close || 0, 2)}</p>
                          <p className="mt-1 text-xs uppercase tracking-widest text-muted">{row.peRatio ? `PE ${row.peRatio.toFixed(2)}` : "PE --"}</p>
                        </div>
                        <div
                          className={`inline-flex min-w-[88px] items-center justify-end gap-1 font-mono text-sm ${
                            row.changePct >= 0 ? "text-profit" : "text-loss"
                          }`}
                        >
                          {row.changePct >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                          {Math.abs(row.changePct).toFixed(2)}%
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted">Pulse</p>
                    <h3 className="mt-2 font-display text-2xl text-text">Trend Strip</h3>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-chip bg-primary/10 px-3 py-1 text-xs text-primary">
                    <TrendingUp size={14} />
                    Compact watch
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {sparklineRows.slice(0, 6).map((row) => (
                    <div key={row.id} className="rounded-panel border border-white/5 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-display text-lg text-text">{row.ticker}</p>
                          <p className="truncate text-xs uppercase tracking-widest text-muted">{row.portfolio_title}</p>
                        </div>
                        <span className={`text-xs font-semibold ${peColor(row.peRatio)}`}>{row.peRatio ? `PE ${row.peRatio.toFixed(1)}` : "PE --"}</span>
                      </div>
                      <div className="mt-3 h-12">
                        <Sparkline
                          data={row.history.slice(-16).map((item, index) => ({ id: index, value: Number(item.close) }))}
                          color={row.changePct >= 0 ? "#00E676" : "#FF3D57"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Create Portfolio">
        <form className="space-y-5" onSubmit={handlePortfolioSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text" htmlFor="portfolio-title">
              Portfolio name
            </label>
            <input
              id="portfolio-title"
              value={portfolioForm.title}
              onChange={(event) => setPortfolioForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
              placeholder="Long-term compounders"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text" htmlFor="portfolio-description">
              Description
            </label>
            <textarea
              id="portfolio-description"
              value={portfolioForm.description}
              onChange={(event) => setPortfolioForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-32 w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
              placeholder="A high-conviction portfolio focused on secular growth and valuation discipline."
            />
          </div>
          <button type="submit" disabled={submittingPortfolio} className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {submittingPortfolio ? "Creating..." : "Create Portfolio"}
          </button>
        </form>
      </Drawer>
    </div>
  );
}
