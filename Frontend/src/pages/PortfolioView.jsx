import { ChevronLeft, ChevronRight, LineChart, Plus, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { useAppToast } from "../App";
import {
  createUserStock,
  getPortfolioForecast,
  getUserStock,
  removeUserStock,
  searchStockMaster,
} from "../api/stocks";
import Drawer from "../components/Drawer";
import EmptyState from "../components/EmptyState";
import SkeletonBlock from "../components/SkeletonBlock";
import StockCard from "../components/StockCard";
import { usePortfolio } from "../hooks/usePortfolio";
import { formatRelativeMinutes } from "../utils/formatDate";
import { formatPrice } from "../utils/formatPrice";

const EMPTY_ARRAY = [];

export default function PortfolioView() {
  const { id } = useParams();
  const { onToast } = useAppToast();
  const { portfolios, portfolioData, loading, error, reload } = usePortfolio(id);
  const [detailsMap, setDetailsMap] = useState({});
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [addingStock, setAddingStock] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [stockPage, setStockPage] = useState(0);
  const [stockSearch, setStockSearch] = useState("");
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState("");
  const pageSize = 3;

  const selectedPortfolio = portfolios.find((portfolio) => String(portfolio.id) === String(id));
  const stocks = portfolioData?.user_stocks ?? EMPTY_ARRAY;
  const filteredStocks = useMemo(() => {
    const term = stockSearch.trim().toLowerCase();
    if (!term) {
      return stocks;
    }

    return stocks.filter((stock) => {
      const haystack = [stock.ticker, stock.company_name, stock.exchange, stock.market]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [stockSearch, stocks]);
  const filteredStockPages = Math.max(1, Math.ceil(filteredStocks.length / pageSize));
  const currentStockPage = Math.min(stockPage, filteredStockPages - 1);
  const pagedStocks = useMemo(
    () => filteredStocks.slice(currentStockPage * pageSize, currentStockPage * pageSize + pageSize),
    [currentStockPage, filteredStocks]
  );
  const pagedStockSignature = useMemo(
    () => pagedStocks.map((stock) => stock.id).join("|"),
    [pagedStocks]
  );
  const lastLoadedSignatureRef = useRef("");

  useEffect(() => {
    setStockPage(0);
  }, [id]);

  useEffect(() => {
    setStockPage((current) => Math.min(current, Math.max(0, Math.ceil(filteredStocks.length / pageSize) - 1)));
  }, [filteredStocks.length]);

  useEffect(() => {
    setStockPage(0);
  }, [stockSearch]);

  useEffect(() => {
    const loadDetails = async () => {
      if (pagedStockSignature === lastLoadedSignatureRef.current) {
        return;
      }

      lastLoadedSignatureRef.current = pagedStockSignature;

      if (!pagedStocks.length) {
        setDetailsMap((current) => (Object.keys(current).length === 0 ? current : {}));
        setDetailsLoading((current) => (current ? false : current));
        return;
      }

      setDetailsLoading(true);
      try {
        const results = await Promise.all(
          pagedStocks.map(async (stock) => {
            const response = await getUserStock(stock.id);
            return [stock.id, response.user_stock];
          })
        );
        setDetailsMap((current) => ({ ...current, ...Object.fromEntries(results) }));
      } catch (detailError) {
        onToast({ type: "error", message: "Unable to load detailed stock history." });
      } finally {
        setDetailsLoading(false);
      }
    };

    loadDetails();
  }, [onToast, pagedStockSignature]);

  useEffect(() => {
    if (!drawerOpen) {
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");

      try {
        const response = await searchStockMaster({
          q: query.trim(),
          limit: 12,
        });
        if (!ignore) {
          setSearchResults(response.results ?? []);
        }
      } catch (searchRequestError) {
        if (!ignore) {
          setSearchResults([]);
          setSearchError(
            searchRequestError.response?.data?.error ||
              "Unable to search the stock master right now."
          );
        }
      } finally {
        if (!ignore) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [drawerOpen, query]);

  const latestSync = useMemo(() => {
    const timestamps = stocks.map((item) => item.modified_at).filter(Boolean);
    return timestamps.sort().reverse()[0];
  }, [stocks]);
  const forecastSignature = useMemo(
    () =>
      stocks
        .map((stock) => `${stock.id}:${stock.quantity}:${stock.modified_at}`)
        .join("|"),
    [stocks]
  );
  const forecastRows = useMemo(
    () =>
      [...(forecastData?.stock_predictions ?? [])]
        .sort((a, b) => Math.abs(Number(b.growth_pct ?? 0)) - Math.abs(Number(a.growth_pct ?? 0)))
        .slice(0, 4),
    [forecastData]
  );
  const readyModelCount = useMemo(
    () =>
      (forecastData?.stock_predictions ?? []).filter((item) => item.model_status === "ready").length,
    [forecastData]
  );

  useEffect(() => {
    let ignore = false;

    const loadForecast = async () => {
      if (!id) {
        return;
      }

      setForecastLoading(true);
      setForecastError("");

      try {
        const response = await getPortfolioForecast(id);
        if (!ignore) {
          setForecastData(response);
        }
      } catch (forecastRequestError) {
        if (!ignore) {
          setForecastData(null);
          setForecastError(
            forecastRequestError.response?.data?.error || "Unable to load portfolio forecast."
          );
        }
      } finally {
        if (!ignore) {
          setForecastLoading(false);
        }
      }
    };

    loadForecast();

    return () => {
      ignore = true;
    };
  }, [forecastSignature, id]);

  const handleRefreshForecast = async () => {
    setForecastLoading(true);
    setForecastError("");

    try {
      const response = await getPortfolioForecast(id);
      setForecastData(response);
      onToast({ type: "success", message: "Portfolio forecast refreshed." });
    } catch (forecastRequestError) {
      setForecastData(null);
      setForecastError(
        forecastRequestError.response?.data?.error || "Unable to refresh portfolio forecast."
      );
      onToast({
        type: "error",
        message:
          forecastRequestError.response?.data?.error || "Unable to refresh portfolio forecast.",
      });
    } finally {
      setForecastLoading(false);
    }
  };

  const handleAddStock = async () => {
    if (!selectedTicker) {
      onToast({ type: "error", message: "Select a stock before fetching data." });
      return;
    }

    setAddingStock(true);
    try {
      await createUserStock({
        portfolio: Number(id),
        ticker: selectedTicker.yahoo_ticker || selectedTicker.ticker,
      });
      setDrawerOpen(false);
      setQuery("");
      setSelectedTicker(null);
      setSearchResults([]);
      await reload();
      onToast({ type: "success", message: `${selectedTicker.ticker} added to portfolio.` });
    } catch (addError) {
      onToast({
        type: "error",
        message: addError.response?.data?.error || "Failed to sync chart data for the stock.",
      });
    } finally {
      setAddingStock(false);
    }
  };

  const handleDelete = async (stockId) => {
    if (!window.confirm("Remove this stock and all historical data from the portfolio?")) {
      return;
    }

    setDeletingId(stockId);
    try {
      await removeUserStock(stockId);
      await reload();
      onToast({ type: "success", message: "Stock removed from portfolio." });
    } catch (deleteError) {
      onToast({
        type: "error",
        message: deleteError.response?.data?.error || "Failed to delete stock.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Portfolio View</p>
          <h1 className="mt-3 font-display text-4xl text-text lg:text-5xl">
            {selectedPortfolio?.title || portfolioData?.portfolio || "Portfolio"}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="rounded-chip bg-primary/10 px-3 py-1 text-primary">{stocks.length} tracked stocks</span>
            <span>Last synced: {formatRelativeMinutes(latestSync)}</span>
            {error ? <span className="text-loss">{error}</span> : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-cyan"
        >
          <Plus size={16} />
          Add Stock
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {loading || detailsLoading ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from({ length: pageSize }).map((_, index) => <SkeletonBlock key={index} className="h-64" />)}
            </div>
          ) : stocks.length === 0 ? (
            <EmptyState
              title="No stocks in this portfolio"
              description="Search a stock symbol and add it to the portfolio to sync its 1-year chart data."
              action={
                <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950">
                  Add your first stock
                </button>
              }
            />
          ) : (
            <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={stockSearch}
                  onChange={(event) => setStockSearch(event.target.value)}
                  placeholder="Search stocks in portfolio..."
                  className="w-full rounded-panel border border-border bg-base px-11 py-2.5 text-sm text-text placeholder:text-muted focus:border-primary/40 focus:outline-none"
                />
              </div>
              <p className="text-sm text-muted">
                Showing {pagedStocks.length === 0 ? 0 : currentStockPage * pageSize + 1}-
                {Math.min((currentStockPage + 1) * pageSize, filteredStocks.length)} of {filteredStocks.length} stocks
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStockPage((current) => Math.max(current - 1, 0))}
                  disabled={currentStockPage === 0}
                  aria-label="Previous stocks"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-panel border border-border bg-base text-text transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setStockPage((current) => Math.min(current + 1, filteredStockPages - 1))}
                  disabled={currentStockPage >= filteredStockPages - 1}
                  aria-label="Next stocks"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-panel border border-border bg-base text-text transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {pagedStocks.map((stock) => (
                  <StockCard
                    key={stock.id}
                    stock={stock}
                    detail={detailsMap[stock.id]}
                    deleting={deletingId === stock.id}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <section className="panel p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <LineChart size={18} className="text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted">ML Forecast</p>
                  <h3 className="font-display text-2xl text-text">Portfolio Outlook</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefreshForecast}
                disabled={forecastLoading}
                className="inline-flex items-center gap-2 rounded-panel border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-text transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={14} className={forecastLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {forecastLoading ? (
              <div className="space-y-3">
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-28 w-full" />
              </div>
            ) : forecastError ? (
              <div className="rounded-panel border border-loss/20 bg-loss/10 p-4 text-sm text-loss">
                {forecastError}
              </div>
            ) : forecastData ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-panel bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted">Current value</p>
                    <p className="mt-2 font-mono text-2xl text-text">
                      {formatPrice(forecastData.current_value || 0, 2)}
                    </p>
                  </div>
                  <div className="rounded-panel bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted">Predicted value</p>
                    <p className="mt-2 font-mono text-2xl text-text">
                      {formatPrice(forecastData.predicted_value || 0, 2)}
                    </p>
                  </div>
                </div>

                <div
                  className={`rounded-panel border p-4 ${
                    Number(forecastData.growth_pct) >= 0
                      ? "border-profit/20 bg-profit/10"
                      : "border-loss/20 bg-loss/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted">Expected move</p>
                      <p
                        className={`mt-2 flex items-center gap-2 font-mono text-2xl ${
                          Number(forecastData.growth_pct) >= 0 ? "text-profit" : "text-loss"
                        }`}
                      >
                        {Number(forecastData.growth_pct) >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                        {Number(forecastData.growth_pct || 0).toFixed(2)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-widest text-muted">Models ready</p>
                      <p className="mt-2 text-sm font-semibold text-text">
                        {readyModelCount}/{forecastData.stock_predictions?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-panel bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-widest text-muted">Stock-wise forecast</p>
                    {readyModelCount === 0 ? (
                      <span className="text-xs text-gold">Models not trained yet, showing current-price fallback.</span>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {forecastRows.length > 0 ? (
                      forecastRows.map((item) => (
                        <div key={item.user_stock_id} className="flex items-center justify-between gap-3 rounded-panel border border-white/5 bg-base px-3 py-3">
                          <div>
                            <p className="font-display text-lg text-text">{item.symbol}</p>
                            <p className="text-xs text-muted">
                              Qty {item.quantity} • {item.model_status === "ready" ? "Model ready" : "Fallback"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm text-text">{formatPrice(item.predicted_value || 0, 2)}</p>
                            <p
                              className={`mt-1 text-xs font-semibold ${
                                Number(item.growth_pct) >= 0 ? "text-profit" : "text-loss"
                              }`}
                            >
                              {Number(item.growth_pct) >= 0 ? "+" : ""}
                              {Number(item.growth_pct || 0).toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted">No forecastable stocks found in this portfolio yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-panel bg-white/5 p-4 text-sm text-muted">
                Forecast data will appear here once the portfolio forecast loads.
              </div>
            )}
          </section>
        </div>
      </section>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add Stock" widthClass="max-w-2xl">
        <div className="space-y-5">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ticker or company name..."
              className="w-full rounded-panel border border-border bg-base px-11 py-3 text-text"
            />
          </div>

          {searchError ? <p className="text-sm text-loss">{searchError}</p> : null}

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {searchLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-20 w-full" />
              ))
            ) : searchResults.length > 0 ? (
              searchResults.map((item) => (
                <button
                  key={`${item.exchange}-${item.ticker}`}
                  type="button"
                  onClick={() => setSelectedTicker(item)}
                  className={`flex w-full items-center justify-between rounded-panel border px-4 py-3 text-left transition ${
                    selectedTicker?.ticker === item.ticker &&
                    selectedTicker?.exchange === item.exchange
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-base hover:border-primary/20"
                  }`}
                >
                  <div>
                    <p className="font-display text-lg text-text">{item.yahoo_ticker || item.ticker}</p>
                    <p className="text-sm text-muted">{item.stock_name}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-chip bg-white/5 px-2 py-1 text-xs text-muted">
                      {item.exchange}
                    </span>
                    <p className="mt-2 text-xs uppercase tracking-widest text-muted">
                      {item.market}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                title="No matching stocks found"
                description="Try a different ticker, company name, or shorter search term."
              />
            )}
          </div>

          {selectedTicker ? (
            <div className="rounded-panel border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-primary">Selected</p>
              <p className="mt-2 font-display text-xl text-text">
                {selectedTicker.yahoo_ticker || selectedTicker.ticker}
              </p>
              <p className="mt-1 text-sm text-muted">{selectedTicker.stock_name}</p>
            </div>
          ) : null}

          {addingStock ? (
            <div className="panel space-y-3 p-5">
              <p className="text-sm text-text">Syncing chart data...</p>
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-2/3" />
              <div className="flex gap-2">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "120ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "240ms" }} />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleAddStock}
            disabled={addingStock || !selectedTicker}
            className="w-full rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            Add & Fetch Data
          </button>
        </div>
      </Drawer>
    </div>
  );
}
