import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
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
import { formatDate, formatRelativeMinutes } from "../utils/formatDate";
import { formatPrice } from "../utils/formatPrice";
import { peColor } from "../utils/peColor";

const columns = [
  { key: "ticker", label: "Symbol" },
  { key: "company_name", label: "Name" },
  { key: "close", label: "Close" },
  { key: "changePct", label: "Change%" },
  { key: "volume", label: "Volume" },
  { key: "peRatio", label: "PE Ratio" },
  { key: "created_at", label: "Added On" },
];

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

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

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
    <div className="space-y-8">
      {isPortfolioPage ? (
        portfolioCardsSection
      ) : (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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

          <section className="grid gap-8 xl:grid-cols-2">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted">Section A</p>
                  <h2 className="font-display text-3xl text-text">Portfolio Cards</h2>
                </div>
                <div className="flex items-center gap-3">
                  {portfolioPager}
                  <Link
                    to="/portfolios"
                    className="inline-flex items-center gap-2 rounded-panel border border-border bg-white/5 px-4 py-3 text-sm font-semibold text-text transition hover:border-primary/30 hover:text-primary"
                  >
                    View more
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>

              <div id="portfolio-cards" className={`grid gap-4 md:grid-cols-2 xl:grid-cols-2 ${portfolioPageMotionClass}`} key={currentPortfolioPage}>
                {portfolioLoading
                  ? Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-40" />)
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
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted">Section B</p>
                  <h2 className="font-display text-3xl text-text">Recent Stocks</h2>
                </div>
                {error ? <span className="text-sm text-loss">{error}</span> : null}
              </div>

              <div className="panel overflow-hidden">
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-white/5">
                      <tr>
                        {columns.map((column) => (
                          <th
                            key={column.key}
                            className="cursor-pointer px-4 py-4 text-left text-xs uppercase tracking-widest text-muted"
                            onClick={() => handleSort(column.key)}
                          >
                            {column.label}
                          </th>
                        ))}
                        <th className="px-4 py-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {stockLoading
                        ? Array.from({ length: 4 }).map((_, index) => (
                            <tr key={index}>
                              <td colSpan={8} className="p-4">
                                <SkeletonBlock className="h-12 w-full" />
                              </td>
                            </tr>
                          ))
                        : recentRows.map((row) => (
                            <tr key={row.id} className="group border-t border-white/5 transition hover:bg-white/5">
                              <td className="px-4 py-4 font-display text-lg text-text">{row.ticker}</td>
                              <td className="px-4 py-4 text-sm text-muted">{row.company_name}</td>
                              <td className="px-4 py-4 font-mono text-sm text-text">{formatPrice(row.close || 0, 2)}</td>
                              <td className={`px-4 py-4 font-mono text-sm ${row.changePct >= 0 ? "text-profit" : "text-loss"}`}>
                                <span className="inline-flex items-center gap-1">
                                  {row.changePct >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                  {Math.abs(row.changePct).toFixed(2)}%
                                </span>
                              </td>
                              <td className="px-4 py-4 font-mono text-sm text-text">{row.volume || "--"}</td>
                              <td className={`px-4 py-4 font-mono text-sm ${peColor(row.peRatio)}`}>
                                {row.peRatio ? row.peRatio.toFixed(2) : "--"}
                              </td>
                              <td className="px-4 py-4 text-sm text-muted">{formatDate(row.created_at)}</td>
                              <td className="px-4 py-4 text-right">
                                <Link to={`/stock/${row.id}`} className="text-sm font-semibold text-primary opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100">
                                  View details
                                </Link>
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted">Section C</p>
                <h2 className="font-display text-3xl text-text">Mini Sparklines</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-chip bg-primary/10 px-3 py-1 text-xs text-primary">
                <Sparkles size={14} />
                Live trend strip
              </span>
            </div>

            {sortedRows.length === 0 ? (
              <EmptyState
                title="No tracked stocks yet"
                description="Create a portfolio and add your first ticker. You can sync OHLCV and PE data separately later."
                action={
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950"
                  >
                    Create Portfolio
                  </button>
                }
              />
            ) : (
              <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
                {sparklineRows.map((row) => (
                  <div key={row.id} className="panel min-w-56 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-xl text-text">{row.ticker}</p>
                        <p className="text-xs uppercase tracking-widest text-muted">{row.portfolio_title}</p>
                      </div>
                      <p className="font-mono text-sm text-text">{formatPrice(row.close || 0, 2)}</p>
                    </div>
                    <div className="mt-4">
                      <Sparkline
                        data={row.history.slice(-20).map((item, index) => ({ id: index, value: Number(item.close) }))}
                        color={row.changePct >= 0 ? "#00E676" : "#FF3D57"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
