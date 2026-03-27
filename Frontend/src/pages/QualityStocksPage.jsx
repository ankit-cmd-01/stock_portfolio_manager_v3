import { ArrowDown, ArrowUp, Check, ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAppToast } from "../App";
import {
  generateQualityStocks,
  getQualityStockDetail,
  getQualityStockSnapshot,
  getQualityStocks,
  rerunQualityStock,
} from "../api/qualityStocks";
import Drawer from "../components/Drawer";
import EmptyState from "../components/EmptyState";
import SkeletonBlock from "../components/SkeletonBlock";
import { usePortfolio } from "../hooks/usePortfolio";
import { formatDate, formatRelativeMinutes } from "../utils/formatDate";
import { formatPrice } from "../utils/formatPrice";

const SIGNAL_OPTIONS = ["all", "BUY", "HOLD", "SELL"];

const signalClasses = {
  BUY: "border-profit/30 bg-profit/10 text-profit",
  HOLD: "border-gold/30 bg-gold/10 text-gold",
  SELL: "border-loss/30 bg-loss/10 text-loss",
};

const getSignalClass = (signal) => signalClasses[signal] || signalClasses.HOLD;
const formatSignedPercent = (value) => `${Number(value || 0) >= 0 ? "+" : ""}${Number(value || 0).toFixed(2)}%`;

export default function QualityStocksPage() {
  const { onToast } = useAppToast();
  const { portfolios, loading: portfoliosLoading } = usePortfolio();
  const [portfolioFilter, setPortfolioFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snapshotPortfolioId, setSnapshotPortfolioId] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");
  const [selectedStockIds, setSelectedStockIds] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  const averageRating =
    reports.length > 0
      ? (reports.reduce((sum, item) => sum + Number(item.ai_rating || 0), 0) / reports.length).toFixed(1)
      : "0.0";
  const buyCount = reports.filter((item) => item.buy_signal === "BUY").length;
  const snapshotCount = candidates.length;
  const selectedSnapshotPortfolio = portfolios.find((item) => String(item.id) === String(snapshotPortfolioId));
  const financialMetrics = (selectedReport?.graphs_data?.financial_metrics ?? []).slice(0, 6);
  const priceHistory = selectedReport?.graphs_data?.price_history ?? [];

  async function loadReports() {
    setReportsLoading(true);
    setReportsError("");
    try {
      const response = await getQualityStocks({
        portfolio: portfolioFilter === "all" ? undefined : portfolioFilter,
        signal: signalFilter,
      });
      setReports(response.quality_stocks ?? []);
    } catch (requestError) {
      setReports([]);
      setReportsError(requestError.response?.data?.error || "Unable to load quality reports.");
    } finally {
      setReportsLoading(false);
    }
  }

  async function loadSnapshot(portfolioId) {
    if (!portfolioId) {
      setCandidates([]);
      setSelectedStockIds([]);
      return;
    }

    setSnapshotLoading(true);
    setSnapshotError("");
    try {
      const response = await getQualityStockSnapshot(portfolioId);
      const nextCandidates = response.candidates ?? [];
      setCandidates(nextCandidates);
      setSelectedStockIds(nextCandidates.slice(0, 3).map((item) => item.stock_id));
    } catch (requestError) {
      setCandidates([]);
      setSelectedStockIds([]);
      setSnapshotError(requestError.response?.data?.error || "Unable to load snapshot candidates.");
    } finally {
      setSnapshotLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [portfolioFilter, signalFilter]);

  useEffect(() => {
    if (!portfolios.length) {
      setSnapshotPortfolioId("");
      return;
    }
    if (portfolioFilter !== "all") {
      setSnapshotPortfolioId(String(portfolioFilter));
      return;
    }
    setSnapshotPortfolioId((current) => current || String(portfolios[0].id));
  }, [portfolioFilter, portfolios]);

  useEffect(() => {
    if (!reports.length) {
      setSelectedReportId(null);
      setSelectedReport(null);
      return;
    }
    if (!reports.some((item) => item.id === selectedReportId)) {
      setSelectedReportId(reports[0].id);
    }
  }, [reports, selectedReportId]);

  useEffect(() => {
    if (!selectedReportId) {
      setSelectedReport(null);
      setDetailError("");
      return;
    }

    let ignore = false;
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const response = await getQualityStockDetail(selectedReportId);
        if (!ignore) {
          setSelectedReport(response.quality_stock ?? null);
        }
      } catch (requestError) {
        if (!ignore) {
          setSelectedReport(null);
          setDetailError(requestError.response?.data?.error || "Unable to load report detail.");
        }
      } finally {
        if (!ignore) {
          setDetailLoading(false);
        }
      }
    };

    loadDetail();
    return () => {
      ignore = true;
    };
  }, [selectedReportId]);

  useEffect(() => {
    if (snapshotPortfolioId) {
      loadSnapshot(snapshotPortfolioId);
    }
  }, [snapshotPortfolioId]);

  const handleToggleStock = (stockId) => {
    setSelectedStockIds((current) =>
      current.includes(stockId) ? current.filter((item) => item !== stockId) : [...current, stockId]
    );
  };

  const handleGenerate = async () => {
    if (!snapshotPortfolioId || selectedStockIds.length === 0) {
      onToast({ type: "error", message: "Pick at least one stock candidate first." });
      return;
    }

    setGenerating(true);
    try {
      const response = await generateQualityStocks({
        portfolioId: snapshotPortfolioId,
        stockIds: selectedStockIds,
      });
      await loadSnapshot(snapshotPortfolioId);
      await loadReports();
      setSelectedReportId(response.quality_stocks?.[0]?.id || null);
      setDrawerOpen(false);
      onToast({ type: "success", message: `${response.count || selectedStockIds.length} report(s) generated.` });
    } catch (requestError) {
      onToast({
        type: "error",
        message: requestError.response?.data?.stock_ids?.[0] || requestError.response?.data?.error || "Unable to generate reports.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRerun = async () => {
    if (!selectedReportId) {
      return;
    }

    setRerunning(true);
    try {
      const response = await rerunQualityStock(selectedReportId);
      setSelectedReport(response.quality_stock ?? null);
      await loadReports();
      onToast({ type: "success", message: "Quality report refreshed." });
    } catch (requestError) {
      onToast({ type: "error", message: requestError.response?.data?.error || "Unable to rerun report." });
    } finally {
      setRerunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="panel relative overflow-hidden p-5 sm:p-6 xl:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,179,0,0.10),transparent_26%),radial-gradient(circle_at_left_center,rgba(0,212,255,0.10),transparent_24%)]" />
        <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] xl:items-end">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Research Deck</p>
            <h1 className="mt-3 max-w-[14ch] font-display text-[clamp(2.2rem,4vw,3.8rem)] leading-[0.94] text-text">
              Quality signals are now visible in the frontend.
            </h1>
            <p className="mt-4 max-w-2xl text-[0.98rem] leading-7 text-muted">
              Filter saved reports, inspect the AI justification, and generate fresh quality-stock reports from any portfolio snapshot.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                disabled={!portfolios.length}
                className="inline-flex items-center gap-2 rounded-panel bg-primary px-4 py-2.5 text-[0.96rem] font-semibold text-slate-950 transition hover:shadow-cyan disabled:opacity-60"
              >
                <Sparkles size={16} />
                Generate Reports
              </button>
              {selectedSnapshotPortfolio ? (
                <div className="rounded-panel border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm text-muted">
                  Previewing <span className="font-semibold text-text">{selectedSnapshotPortfolio.title}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Portfolios</p>
              <p className="mt-3 font-display text-[2rem] text-text">{portfolios.length}</p>
            </div>
            <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Snapshot Candidates</p>
              <p className="mt-3 font-display text-[2rem] text-primary">{snapshotLoading ? "--" : snapshotCount}</p>
            </div>
            <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Saved Reports</p>
              <p className="mt-3 font-display text-[2rem] text-profit">{reports.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="panel p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Saved Reports</p>
              <h2 className="font-display text-[2rem] text-text">Report Queue</h2>
            </div>
            <button
              type="button"
              onClick={loadReports}
              disabled={reportsLoading}
              className="inline-flex items-center gap-2 rounded-panel border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-text transition hover:border-primary/30 disabled:opacity-60"
            >
              <RefreshCw size={14} className={reportsLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <select
              value={portfolioFilter}
              onChange={(event) => setPortfolioFilter(event.target.value)}
              className="rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
            >
              <option value="all">All portfolios</option>
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.title}
                </option>
              ))}
            </select>
            <select
              value={signalFilter}
              onChange={(event) => setSignalFilter(event.target.value)}
              className="rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
            >
              {SIGNAL_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All signals" : item}
                </option>
              ))}
            </select>
          </div>

          {portfolioFilter === "all" && portfolios.length > 0 ? (
            <div className="mt-3 rounded-panel border border-white/5 bg-white/[0.03] p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Snapshot Preview Portfolio</p>
              <select
                value={snapshotPortfolioId}
                onChange={(event) => setSnapshotPortfolioId(event.target.value)}
                className="mt-2 w-full rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
              >
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {portfoliosLoading || reportsLoading ? (
              Array.from({ length: 5 }).map((_, index) => <SkeletonBlock key={index} className="h-28 w-full" />)
            ) : reportsError ? (
              <div className="rounded-panel border border-loss/20 bg-loss/10 p-4 text-sm text-loss">{reportsError}</div>
            ) : reports.length === 0 ? (
              snapshotLoading ? (
                Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="h-28 w-full" />)
              ) : candidates.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-panel border border-primary/15 bg-primary/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Live Snapshot Preview</p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      No saved reports yet. These are the current ranked candidates from{" "}
                      <span className="font-semibold text-text">{selectedSnapshotPortfolio?.title || "the selected portfolio"}</span>.
                    </p>
                  </div>
                  {candidates.map((candidate) => {
                    const selected = selectedStockIds.includes(candidate.stock_id);
                    return (
                      <button
                        key={candidate.stock_id}
                        type="button"
                        onClick={() => handleToggleStock(candidate.stock_id)}
                        className={`w-full rounded-panel border p-4 text-left transition ${
                          selected
                            ? "border-primary/30 bg-primary/10 shadow-cyan"
                            : "border-white/5 bg-white/[0.03] hover:border-primary/20 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-display text-[1.35rem] text-text">{candidate.symbol}</p>
                              {selected ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-slate-950">
                                  <Check size={13} />
                                </span>
                              ) : null}
                            </div>
                            <p className="truncate text-sm text-muted">{candidate.stock_name}</p>
                          </div>
                          <span className={`rounded-chip border px-3 py-1 text-xs font-semibold ${getSignalClass(candidate.buy_signal)}`}>
                            {candidate.buy_signal}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-panel bg-base/70 p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">AI rating</p>
                            <p className="mt-2 font-semibold text-text">{Number(candidate.ai_rating || 0).toFixed(1)}</p>
                          </div>
                          <div className="rounded-panel bg-base/70 p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Current</p>
                            <p className="mt-2 font-semibold text-text">{formatPrice(candidate.current_price || 0, 2)}</p>
                          </div>
                          <div className="rounded-panel bg-base/70 p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Expected move</p>
                            <p className={`mt-2 inline-flex items-center gap-1 font-semibold ${Number(candidate.expected_change_pct) >= 0 ? "text-profit" : "text-loss"}`}>
                              {Number(candidate.expected_change_pct) >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                              {formatSignedPercent(candidate.expected_change_pct)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating || selectedStockIds.length === 0}
                    className="w-full rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    {generating ? "Generating..." : `Generate ${selectedStockIds.length || ""} Report${selectedStockIds.length === 1 ? "" : "s"} From Snapshot`}
                  </button>
                </div>
              ) : (
                <EmptyState
                  title="No quality reports yet"
                  description="This portfolio snapshot has no ranked candidates yet. Add tracked stocks to a portfolio and try again."
                />
              )
            ) : (
              <div className="scrollbar-thin max-h-[58rem] space-y-3 overflow-y-auto pr-1">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setSelectedReportId(report.id)}
                    className={`w-full rounded-panel border p-4 text-left transition ${
                      selectedReportId === report.id
                        ? "border-primary/30 bg-primary/10 shadow-cyan"
                        : "border-white/5 bg-white/[0.03] hover:border-primary/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-[1.35rem] text-text">{report.symbol}</p>
                        <p className="truncate text-sm text-muted">{report.stock_name}</p>
                      </div>
                      <span className={`rounded-chip border px-3 py-1 text-xs font-semibold ${getSignalClass(report.buy_signal)}`}>
                        {report.buy_signal}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted">{report.portfolio_title}</span>
                      <span className="font-semibold text-text">{Number(report.ai_rating || 0).toFixed(1)}</span>
                    </div>
                    <p className="mt-3 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-muted">
                      {report.justification || "Open the report to inspect the full analysis."}
                    </p>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted">
                      {formatRelativeMinutes(report.generated_at)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Detail View</p>
              <h2 className="font-display text-[2rem] text-text">Report Breakdown</h2>
            </div>
            <button
              type="button"
              onClick={handleRerun}
              disabled={!selectedReportId || rerunning || detailLoading}
              className="inline-flex items-center gap-2 rounded-panel border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-text transition hover:border-primary/30 disabled:opacity-60"
            >
              <RefreshCw size={14} className={rerunning ? "animate-spin" : ""} />
              Rerun Analysis
            </button>
          </div>

          <div className="mt-5 space-y-5">
            {detailLoading ? (
              <>
                <SkeletonBlock className="h-28 w-full" />
                <SkeletonBlock className="h-24 w-full" />
                <SkeletonBlock className="h-48 w-full" />
              </>
            ) : detailError ? (
              <div className="rounded-panel border border-loss/20 bg-loss/10 p-4 text-sm text-loss">{detailError}</div>
            ) : !selectedReport ? (
              candidates.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-panel border border-primary/15 bg-primary/5 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Snapshot Summary</p>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      {selectedSnapshotPortfolio?.title || "This portfolio"} has {candidates.length} ranked candidate{candidates.length === 1 ? "" : "s"} ready.
                      Generate reports from the left side or the drawer to populate the detailed analysis view.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Selected For Run</p>
                      <p className="mt-2 font-display text-[1.7rem] text-text">{selectedStockIds.length}</p>
                    </div>
                    <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Top Candidate</p>
                      <p className="mt-2 font-display text-[1.7rem] text-text">{candidates[0]?.symbol || "--"}</p>
                    </div>
                    <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Best Rating</p>
                      <p className="mt-2 font-display text-[1.7rem] text-primary">{Number(candidates[0]?.ai_rating || 0).toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No report selected"
                  description="Pick a saved report from the left side to inspect its quality analysis."
                />
              )
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Stock</p>
                    <p className="mt-2 font-display text-[1.7rem] text-text">{selectedReport.symbol}</p>
                    <p className="mt-1 text-sm text-muted">{selectedReport.stock_name}</p>
                  </div>
                  <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">AI Rating</p>
                    <p className="mt-2 font-display text-[1.7rem] text-primary">{Number(selectedReport.ai_rating || 0).toFixed(1)}</p>
                    <span className={`mt-2 inline-flex rounded-chip border px-3 py-1 text-xs font-semibold ${getSignalClass(selectedReport.buy_signal)}`}>
                      {selectedReport.buy_signal}
                    </span>
                  </div>
                  <div className="rounded-panel border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Portfolio</p>
                    <p className="mt-2 text-lg font-semibold text-text">{selectedReport.portfolio_title}</p>
                    <Link
                      to={`/portfolio/${selectedReport.portfolio_id}`}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                    >
                      Open portfolio
                      <ChevronRight size={15} />
                    </Link>
                  </div>
                </div>

                <div className="rounded-panel border border-white/5 bg-white/[0.03] p-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Justification</p>
                  <p className="mt-3 text-[0.98rem] leading-8 text-text">
                    {selectedReport.report_json?.justification || "No justification was stored for this report."}
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-panel border border-white/5 bg-white/[0.03] p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Risks</p>
                    <div className="mt-4 space-y-3">
                      {(selectedReport.report_json?.risks ?? []).map((item, index) => (
                        <div key={`${item}-${index}`} className="rounded-panel bg-base/70 p-3 text-sm leading-6 text-text">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-panel border border-white/5 bg-white/[0.03] p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Catalysts</p>
                    <div className="mt-4 space-y-3">
                      {(selectedReport.report_json?.catalysts ?? []).map((item, index) => (
                        <div key={`${item}-${index}`} className="rounded-panel bg-base/70 p-3 text-sm leading-6 text-text">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-panel border border-white/5 bg-white/[0.03] p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Stored Summary</p>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      {selectedReport.report_json?.key_metrics_summary || "No metrics summary was returned."}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-panel bg-base/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Generated</p>
                        <p className="mt-2 text-sm font-semibold text-text">{formatDate(selectedReport.generated_at)}</p>
                      </div>
                      <div className="rounded-panel bg-base/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Provider</p>
                        <p className="mt-2 text-sm font-semibold text-text">
                          {selectedReport.report_json?.provider || "deterministic-fallback"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-panel border border-white/5 bg-white/[0.03] p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Data Snapshot</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-panel bg-base/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">History Points</p>
                        <p className="mt-2 text-sm font-semibold text-text">{priceHistory.length}</p>
                      </div>
                      <div className="rounded-panel bg-base/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Latest Close</p>
                        <p className="mt-2 text-sm font-semibold text-text">
                          {priceHistory.length ? formatPrice(priceHistory[priceHistory.length - 1]?.close || 0, 2) : "--"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {financialMetrics.length > 0 ? (
                        financialMetrics.map((metric, index) => (
                          <div key={`${metric.label}-${index}`} className="flex items-center justify-between rounded-panel bg-base/70 px-3 py-2 text-sm">
                            <span className="text-muted">{metric.label}</span>
                            <span className="font-semibold text-text">
                              {metric.unit === "%" ? `${Number(metric.value || 0).toFixed(2)}%` : metric.value ?? "--"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted">No stored financial metrics were returned for this report.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Generate Quality Reports" widthClass="max-w-3xl">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <select
              value={snapshotPortfolioId}
              onChange={(event) => setSnapshotPortfolioId(event.target.value)}
              className="rounded-panel border border-border bg-base px-4 py-3 text-text outline-none transition focus:border-primary"
            >
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadSnapshot(snapshotPortfolioId)}
              disabled={!snapshotPortfolioId || snapshotLoading}
              className="inline-flex items-center justify-center gap-2 rounded-panel border border-border bg-white/5 px-4 py-3 text-sm font-semibold text-text transition hover:border-primary/30 disabled:opacity-60"
            >
              <RefreshCw size={15} className={snapshotLoading ? "animate-spin" : ""} />
              Refresh Snapshot
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedStockIds(candidates.slice(0, 1).map((item) => item.stock_id))}
              disabled={!candidates.length}
              className="rounded-panel border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-text disabled:opacity-60"
            >
              Select top 1
            </button>
            <button
              type="button"
              onClick={() => setSelectedStockIds(candidates.slice(0, 3).map((item) => item.stock_id))}
              disabled={!candidates.length}
              className="rounded-panel border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-text disabled:opacity-60"
            >
              Select top 3
            </button>
          </div>

          {snapshotError ? <div className="rounded-panel border border-loss/20 bg-loss/10 p-4 text-sm text-loss">{snapshotError}</div> : null}

          <div className="space-y-3">
            {snapshotLoading ? (
              Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-28 w-full" />)
            ) : candidates.length === 0 ? (
              <EmptyState
                title="No snapshot candidates"
                description="This portfolio needs tracked stocks before quality candidates can be ranked."
              />
            ) : (
              candidates.map((candidate) => {
                const selected = selectedStockIds.includes(candidate.stock_id);
                return (
                  <button
                    key={candidate.stock_id}
                    type="button"
                    onClick={() => handleToggleStock(candidate.stock_id)}
                    className={`w-full rounded-panel border p-4 text-left transition ${
                      selected
                        ? "border-primary/30 bg-primary/10 shadow-cyan"
                        : "border-white/5 bg-white/[0.03] hover:border-primary/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-display text-[1.35rem] text-text">{candidate.symbol}</p>
                          {selected ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-slate-950">
                              <Check size={13} />
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-sm text-muted">{candidate.stock_name}</p>
                      </div>
                      <span className={`rounded-chip border px-3 py-1 text-xs font-semibold ${getSignalClass(candidate.buy_signal)}`}>
                        {candidate.buy_signal}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-panel bg-base/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">AI rating</p>
                        <p className="mt-2 font-semibold text-text">{Number(candidate.ai_rating || 0).toFixed(1)}</p>
                      </div>
                      <div className="rounded-panel bg-base/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Current</p>
                        <p className="mt-2 font-semibold text-text">{formatPrice(candidate.current_price || 0, 2)}</p>
                      </div>
                      <div className="rounded-panel bg-base/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Predicted</p>
                        <p className="mt-2 font-semibold text-text">{formatPrice(candidate.predicted_price || 0, 2)}</p>
                      </div>
                      <div className="rounded-panel bg-base/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Expected move</p>
                        <p className={`mt-2 inline-flex items-center gap-1 font-semibold ${Number(candidate.expected_change_pct) >= 0 ? "text-profit" : "text-loss"}`}>
                          {Number(candidate.expected_change_pct) >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                          {formatSignedPercent(candidate.expected_change_pct)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || selectedStockIds.length === 0}
            className="w-full rounded-panel bg-primary px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {generating ? "Generating..." : `Generate ${selectedStockIds.length || ""} Report${selectedStockIds.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </Drawer>
    </div>
  );
}
