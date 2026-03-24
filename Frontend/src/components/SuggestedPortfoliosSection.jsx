import { Check, Plus, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import Drawer from "./Drawer";
import { formatPrice } from "../utils/formatPrice";

const sortOptions = [
  { value: "performance", label: "Performance" },
  { value: "market_cap", label: "Market Cap" },
  { value: "stock_name", label: "Name" },
  { value: "ticker", label: "Ticker" },
];

const filterOptions = [
  { value: "all", label: "All Markets" },
  { value: "Indian", label: "Indian" },
  { value: "US", label: "US" },
];

function getRiskTone(riskLevel) {
  if (riskLevel === "High") {
    return "border-loss/30 bg-loss/10 text-loss";
  }
  if (riskLevel === "Medium") {
    return "border-gold/30 bg-gold/10 text-gold";
  }
  return "border-profit/30 bg-profit/10 text-profit";
}

function formatMiniStat(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "--";
  }
  const number = Number(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

export default function SuggestedPortfoliosSection({ categories = [], loading = false, error = "", onCreatePortfolio }) {
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [selectionMode, setSelectionMode] = useState("default");
  const [portfolioName, setPortfolioName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMarket, setFilterMarket] = useState("all");
  const [sortKey, setSortKey] = useState("performance");
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [categoryPage, setCategoryPage] = useState(0);
  const [categoryPageDirection, setCategoryPageDirection] = useState("next");
  const nameInputRef = useRef(null);
  const categoryPageSize = 8;

  const activeCategory = useMemo(
    () => categories.find((category) => String(category.id) === String(activeCategoryId)) || null,
    [activeCategoryId, categories]
  );

  useEffect(() => {
    if (!activeCategory) {
      return;
    }

    setPortfolioName(`${activeCategory.name} Basket`);
    setSearchTerm("");
    setFilterMarket("all");
    setSortKey("performance");
    setSelectedIds(activeCategory.default_stock_ids ?? []);
  }, [activeCategory]);

  useEffect(() => {
    if (activeCategory) {
      window.requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [activeCategory]);

  const categoryPageCount = Math.max(1, Math.ceil(categories.length / categoryPageSize));
  const currentCategoryPage = Math.min(categoryPage, categoryPageCount - 1);
  const pagedCategories = useMemo(
    () =>
      categories.slice(
        currentCategoryPage * categoryPageSize,
        currentCategoryPage * categoryPageSize + categoryPageSize
      ),
    [categories, currentCategoryPage]
  );

  useEffect(() => {
    setCategoryPage((current) => Math.min(current, Math.max(0, categoryPageCount - 1)));
  }, [categoryPageCount]);

  const visibleStocks = useMemo(() => {
    if (!activeCategory) {
      return [];
    }

    const term = searchTerm.trim().toLowerCase();
    let items = [...(activeCategory.stocks ?? [])];

    if (filterMarket !== "all") {
      items = items.filter((stock) => stock.market === filterMarket);
    }

    if (term) {
      items = items.filter((stock) => {
        const haystack = [stock.ticker, stock.stock_name, stock.exchange, stock.market]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    items.sort((a, b) => {
      if (sortKey === "performance") {
        return Number(b.performance_pct ?? 0) - Number(a.performance_pct ?? 0);
      }
      if (sortKey === "market_cap") {
        return Number(b.market_cap ?? 0) - Number(a.market_cap ?? 0);
      }
      return String(a[sortKey] || "").localeCompare(String(b[sortKey] || ""));
    });

    return items;
  }, [activeCategory, filterMarket, searchTerm, sortKey]);

  const defaultPreview = useMemo(() => visibleStocks.slice(0, 8), [visibleStocks]);
  const selectedCount = selectedIds.length;

  const toggleStock = (stockId) => {
    setSelectedIds((current) =>
      current.includes(stockId) ? current.filter((id) => id !== stockId) : [...current, stockId]
    );
  };

  const openCategory = (category, mode = "default") => {
    setActiveCategoryId(category.id);
    setSelectionMode(mode);
    setSelectedIds(category.default_stock_ids ?? []);
    setPortfolioName(`${category.name} Basket`);
    setSearchTerm("");
    setFilterMarket("all");
    setSortKey("performance");
  };

  const closeCategoryDrawer = () => {
    setActiveCategoryId(null);
  };

  const handleCreatePortfolio = async () => {
    if (!activeCategory) {
      return;
    }

    setSaving(true);
    try {
      await onCreatePortfolio({
        title: portfolioName.trim() || `${activeCategory.name} Basket`,
        description: activeCategory.description || `Suggested portfolio built from ${activeCategory.name}.`,
        stock_ids: selectionMode === "custom" ? selectedIds : activeCategory.default_stock_ids,
      });
      setActiveCategoryId(null);
    } catch (error) {
      // Parent handler already shows the toast; keep the drawer open for another try.
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryPageChange = (nextPage) => {
    if (nextPage === currentCategoryPage) {
      return;
    }

    setCategoryPageDirection(nextPage > currentCategoryPage ? "next" : "prev");
    setCategoryPage(nextPage);
  };

  const categoryPageLabel =
    categories.length === 0
      ? "Showing 0 of 0 suggested portfolios"
      : `Showing ${currentCategoryPage * categoryPageSize + 1}-${Math.min(
          (currentCategoryPage + 1) * categoryPageSize,
          categories.length
        )} of ${categories.length} suggested portfolios`;

  const categoryPageMotionClass =
    categoryPageDirection === "next" ? "animate-page-slide-next" : "animate-page-slide-prev";

  const categoryPager = (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted">{categoryPageLabel}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleCategoryPageChange(Math.max(currentCategoryPage - 1, 0))}
          disabled={currentCategoryPage === 0}
          aria-label="Previous suggested portfolios"
          className="inline-flex h-10 w-10 items-center justify-center rounded-panel border border-border bg-white/5 text-text transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-lg leading-none">‹</span>
        </button>
        <button
          type="button"
          onClick={() => handleCategoryPageChange(Math.min(currentCategoryPage + 1, categoryPageCount - 1))}
          disabled={currentCategoryPage >= categoryPageCount - 1}
          aria-label="Next suggested portfolios"
          className="inline-flex h-10 w-10 items-center justify-center rounded-panel border border-border bg-white/5 text-text transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-lg leading-none">›</span>
        </button>
      </div>
    </div>
  );

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Section B</p>
          <h2 className="font-display text-3xl text-text">Suggested Portfolios</h2>
          <p className="mt-1 text-sm text-muted">
            Curated baskets inspired by indices, sectors, global leaders, and thematic ideas.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-chip bg-primary/10 px-3 py-1 text-xs text-primary">
          <Sparkles size={14} />
          Baskets ready
        </span>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="panel h-56 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="panel border border-loss/20 bg-loss/10 p-5 text-loss">{error}</div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-end">{categoryPager}</div>

          <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-4 ${categoryPageMotionClass}`} key={currentCategoryPage}>
            {pagedCategories.map((category) => (
              <article key={category.id} className="panel hover-panel flex h-full flex-col justify-between p-5">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted">
                        {String(category.category_type || "").replace("_", " ")}
                      </p>
                      <h3 className="mt-2 font-display text-2xl text-text">{category.name}</h3>
                    </div>
                    <span className="rounded-chip bg-primary/10 px-3 py-1 text-xs text-primary">
                      {category.stock_count} stocks
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-panel bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-muted">Avg return</p>
                      <p className="mt-2 font-mono text-sm text-text">{formatMiniStat(category.avg_return)}</p>
                    </div>
                    <div className={`rounded-panel border px-3 py-3 ${getRiskTone(category.risk_level)}`}>
                      <p className="text-[11px] uppercase tracking-widest">Risk level</p>
                      <p className="mt-2 text-sm font-semibold">{category.risk_level}</p>
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-muted">
                    {category.description || "A balanced portfolio idea built from the current master list."}
                  </p>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => openCategory(category, "default")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-panel border border-border bg-white/5 px-3 py-3 text-sm font-semibold text-text transition hover:border-primary/30 hover:text-primary"
                  >
                    <Search size={16} />
                    View Stocks
                  </button>
                  <button
                    type="button"
                    onClick={() => openCategory(category, "custom")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-panel bg-primary px-3 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-cyan"
                  >
                    <Plus size={16} />
                    Add Portfolio
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <Drawer
        open={Boolean(activeCategory)}
        onClose={closeCategoryDrawer}
        title={activeCategory ? activeCategory.name : "Suggested Portfolio"}
        widthClass="max-w-4xl"
      >
        {activeCategory ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted">
                  {String(activeCategory.category_type || "").replace("_", " ")}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {activeCategory.stock_count} stocks inside this basket. Switch to custom selection if you want to trim the list.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectionMode("default")}
                  className={`rounded-chip px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                    selectionMode === "default" ? "bg-primary text-slate-950" : "border border-border bg-white/5 text-muted"
                  }`}
                >
                  Default Stocks
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode("custom")}
                  className={`rounded-chip px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                    selectionMode === "custom" ? "bg-primary text-slate-950" : "border border-border bg-white/5 text-muted"
                  }`}
                >
                  Custom Selection
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[240px] flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search stocks in this category..."
                      className="w-full rounded-panel border border-border bg-base px-11 py-3 text-text placeholder:text-muted outline-none transition focus:border-primary/40"
                    />
                  </div>

                  <select
                    value={filterMarket}
                    onChange={(event) => setFilterMarket(event.target.value)}
                    className="rounded-panel border border-border bg-base px-3 py-3 text-sm text-text outline-none"
                  >
                    {filterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sortKey}
                    onChange={(event) => setSortKey(event.target.value)}
                    className="rounded-panel border border-border bg-base px-3 py-3 text-sm text-text outline-none"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        Sort by {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectionMode === "default" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {defaultPreview.map((stock) => (
                      <div key={stock.id} className="rounded-panel border border-white/5 bg-white/5 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-lg text-text">{stock.ticker}</p>
                            <p className="text-xs text-muted">{stock.stock_name}</p>
                          </div>
                          <span className="text-xs uppercase tracking-widest text-muted">{stock.exchange}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-muted">Market cap</span>
                          <span className="font-mono text-text">
                            {stock.market_cap ? formatPrice(stock.market_cap, 0) : "--"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-widest text-muted">
                        Custom selection {selectedCount ? `(${selectedCount})` : ""}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedIds(visibleStocks.map((stock) => stock.id))}
                          className="rounded-chip border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-text"
                        >
                          Select filtered
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedIds([])}
                          className="rounded-chip border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-text"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                      {visibleStocks.map((stock) => {
                        const selected = selectedIds.includes(stock.id);
                        return (
                          <button
                            key={stock.id}
                            type="button"
                            onClick={() => toggleStock(stock.id)}
                            className={`flex w-full items-center justify-between rounded-panel border px-4 py-3 text-left transition ${
                              selected ? "border-primary/40 bg-primary/10" : "border-border bg-base hover:border-primary/20"
                            }`}
                          >
                            <div>
                              <p className="font-display text-lg text-text">{stock.ticker}</p>
                              <p className="text-sm text-muted">{stock.stock_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs uppercase tracking-widest text-muted">
                                {stock.market} - {stock.exchange}
                              </p>
                              <p className="mt-2 font-mono text-xs text-text">
                                {stock.performance_pct != null
                                  ? `${stock.performance_pct >= 0 ? "+" : ""}${stock.performance_pct.toFixed(2)}%`
                                  : "N/A"}
                              </p>
                            </div>
                            <span
                              className={`ml-3 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                                selected ? "border-primary bg-primary text-slate-950" : "border-border text-muted"
                              }`}
                            >
                              {selected ? <Check size={12} /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-panel bg-white/5 p-4">
                  <label className="mb-2 block text-xs uppercase tracking-widest text-muted" htmlFor="portfolio-name">
                    Portfolio name
                  </label>
                  <input
                    id="portfolio-name"
                    ref={nameInputRef}
                    value={portfolioName}
                    onChange={(event) => setPortfolioName(event.target.value)}
                    className="w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary/40"
                    placeholder="Name your basket"
                  />
                </div>

                <div className="rounded-panel bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-muted">Portfolio Preview</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {activeCategory.description || "A category-based suggested portfolio with the current master stock list."}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
                    <span className="text-muted">Selected stocks</span>
                    <span className="font-semibold text-text">
                      {selectionMode === "custom" ? selectedCount : activeCategory.default_stock_ids?.length || 0}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreatePortfolio}
                  disabled={saving}
                  className="w-full rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {saving ? "Creating..." : "Add Portfolio"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}
