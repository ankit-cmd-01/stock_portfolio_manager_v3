import {
  BrainCircuit,
  Layers3,
  LineChart,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getPortfolioAiSummary, getPortfolioForecast, getUserStock } from "../api/stocks";
import {
  buildAiSummaryLines,
  buildKMeansClusters,
  buildPortfolioAnalytics,
  getGrowthRows,
  getPortfolioSnapshot,
  getRecommendationRows,
} from "../utils/portfolioInsights";
import { formatPrice } from "../utils/formatPrice";
import SkeletonBlock from "./SkeletonBlock";

const TAB_CONFIG = [
  {
    id: "recommendation",
    label: "Recommendation",
    title: "Recommended Stocks",
    description: "Prioritized picks inside this portfolio using trend, valuation, volume, and risk balance.",
    icon: Target,
  },
  {
    id: "forecasting",
    label: "Forecasting",
    title: "Forecasting",
    description: "Portfolio-level model output with current value, predicted value, and stock-wise expected move.",
    icon: LineChart,
  },
  {
    id: "clustering",
    label: "Clustering",
    title: "K-means Clustering",
    description: "Behavior groups based on momentum, valuation, and volatility with an in-panel cluster graph.",
    icon: Layers3,
  },
  {
    id: "growth",
    label: "Growth Analysis",
    title: "Growth Analysis",
    description: "Fast growth readout from recent price momentum, portfolio weight, and forecast support.",
    icon: TrendingUp,
  },
  {
    id: "ai_summary",
    label: "AI Summary",
    title: "AI Summary",
    description: "Structured portfolio commentary with a clear pulse, leadership read, and investor takeaway.",
    icon: BrainCircuit,
  },
];

function formatSignedPercent(value, digits = 2) {
  const numeric = Number(value ?? 0);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(digits)}%`;
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value ?? 0));
}

function hasForecastValue(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function InsightStat({
  label,
  value,
  tone = "text-text",
  helper = "",
  valueClassName = "",
}) {
  return (
    <div className="min-w-0 rounded-panel bg-white/5 p-4">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-2 min-w-0 font-display text-2xl ${tone} ${valueClassName}`.trim()}>{value}</p>
      {helper ? <p className="mt-2 min-w-0 text-xs text-muted">{helper}</p> : null}
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;
  return (
    <div className="rounded-panel border border-border bg-panel px-3 py-2 text-xs shadow-2xl">
      <p className="font-semibold text-text">{point.ticker}</p>
      <p className="mt-1 text-muted">{point.clusterLabel}</p>
      <p className="mt-2 text-text">Momentum: {formatSignedPercent(point.momentum20)}</p>
      <p className="text-text">Volatility: {formatSignedPercent(point.volatility14)}</p>
      <p className="text-text">PE: {point.peValue > 0 ? point.peValue.toFixed(2) : "N/A"}</p>
    </div>
  );
}

function RecommendationView({
  analyticsLoading,
  analyticsError,
  recommendationRows,
  portfolioSnapshot,
}) {
  if (analyticsLoading && recommendationRows.length === 0) {
    return (
      <div className="space-y-3">
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-28 w-full" />
        <SkeletonBlock className="h-28 w-full" />
      </div>
    );
  }

  if (analyticsError && recommendationRows.length === 0) {
    return <div className="rounded-panel border border-loss/20 bg-loss/10 p-4 text-sm text-loss">{analyticsError}</div>;
  }

  if (!recommendationRows.length) {
    return <div className="rounded-panel bg-white/5 p-4 text-sm text-muted">No synced stock data is available for recommendations yet.</div>;
  }

  const topPick = recommendationRows[0];

  return (
    <div className="space-y-4">
      <div className="rounded-panel border border-primary/20 bg-primary/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary">Top pick</p>
            <h4 className="mt-2 font-display text-2xl text-text">{topPick.ticker}</h4>
            <p className="mt-1 text-sm text-muted">{topPick.companyName}</p>
          </div>
          <span className="rounded-chip border border-primary/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            {topPick.recommendationLabel}
          </span>
        </div>
        <p className="mt-4 text-sm leading-6 text-text">{topPick.recommendationReasons.join(" ")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InsightStat
          label="Average momentum"
          value={formatSignedPercent(portfolioSnapshot.averageMomentum)}
          tone={portfolioSnapshot.averageMomentum >= 0 ? "text-profit" : "text-loss"}
          helper={`${portfolioSnapshot.trackedCount}/${portfolioSnapshot.totalCount} stocks synced`}
        />
        <InsightStat
          label="Portfolio value"
          value={formatPrice(portfolioSnapshot.totalHoldingValue || 0, 2)}
          helper={`${portfolioSnapshot.gainers} holdings are green on the latest move`}
        />
      </div>

      <div className="space-y-3">
        {recommendationRows.map((item, index) => (
          <div key={item.id} className="rounded-panel border border-white/5 bg-base px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted">Rank {index + 1}</p>
                <p className="mt-1 font-display text-xl text-text">{item.ticker}</p>
                <p className="text-sm text-muted">{item.companyName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-muted">Score</p>
                <p className="mt-1 font-mono text-lg text-text">{item.recommendationScore.toFixed(0)}/100</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-panel bg-white/5 p-2.5">
                <p className="uppercase tracking-widest text-muted">20D momentum</p>
                <p className={`mt-2 font-semibold ${item.momentum20 >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatSignedPercent(item.momentum20)}
                </p>
              </div>
              <div className="rounded-panel bg-white/5 p-2.5">
                <p className="uppercase tracking-widest text-muted">Volume ratio</p>
                <p className="mt-2 font-semibold text-text">{item.volumeRatio.toFixed(2)}x</p>
              </div>
              <div className="rounded-panel bg-white/5 p-2.5">
                <p className="uppercase tracking-widest text-muted">PE</p>
                <p className="mt-2 font-semibold text-text">
                  {item.peValue > 0 ? item.peValue.toFixed(2) : "N/A"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{item.recommendationReasons.join(" ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ForecastingView({
  forecastLoading,
  forecastError,
  forecastData,
  forecastRows,
  readyModelCount,
}) {
  if (forecastLoading && !forecastData) {
    return (
      <div className="space-y-3">
        <SkeletonBlock className="h-16 w-full" />
        <SkeletonBlock className="h-16 w-full" />
        <SkeletonBlock className="h-28 w-full" />
      </div>
    );
  }

  if (forecastError && !forecastData) {
    return <div className="rounded-panel border border-loss/20 bg-loss/10 p-4 text-sm text-loss">{forecastError}</div>;
  }

  if (!forecastData) {
    return <div className="rounded-panel bg-white/5 p-4 text-sm text-muted">Forecast data will load when you open this tab.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightStat label="Current value" value={formatPrice(forecastData.current_value || 0, 2)} />
        <InsightStat label="Predicted value" value={formatPrice(forecastData.predicted_value || 0, 2)} />
      </div>

      <div
        className={`rounded-panel border p-4 ${
          Number(forecastData.growth_pct) >= 0 ? "border-profit/20 bg-profit/10" : "border-loss/20 bg-loss/10"
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
            <span className="text-xs text-gold">Models are still warming up, so fallback values are shown.</span>
          ) : null}
        </div>
        <div className="mt-4 space-y-3">
          {forecastRows.length ? (
            forecastRows.map((item) => (
              <div
                key={item.user_stock_id}
                className="flex items-center justify-between gap-3 rounded-panel border border-white/5 bg-base px-3 py-3"
              >
                <div>
                  <p className="font-display text-lg text-text">{item.symbol}</p>
                  <p className="text-xs text-muted">
                    Qty {item.quantity} | {item.model_status === "ready" ? "Model ready" : "Fallback"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-text">{formatPrice(item.predicted_value || 0, 2)}</p>
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      Number(item.growth_pct) >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {formatSignedPercent(item.growth_pct || 0)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">No forecastable stocks were found in this portfolio yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ClusteringView({ analyticsLoading, analyticsError, clusterModel }) {
  if (analyticsLoading && clusterModel.points.length === 0) {
    return (
      <div className="space-y-3">
        <SkeletonBlock className="h-64 w-full" />
        <SkeletonBlock className="h-20 w-full" />
      </div>
    );
  }

  if (analyticsError && clusterModel.points.length === 0) {
    return <div className="rounded-panel border border-loss/20 bg-loss/10 p-4 text-sm text-loss">{analyticsError}</div>;
  }

  if (!clusterModel.points.length) {
    return <div className="rounded-panel bg-white/5 p-4 text-sm text-muted">Cluster groups will appear after portfolio stock data finishes loading.</div>;
  }

  const maxObservedVolatility = Math.max(
    ...clusterModel.points.map((point) => Number(point.volatility14 || 0)),
    0
  );
  const yAxisMax = Math.min(100, Math.max(20, Math.ceil(maxObservedVolatility / 10) * 10));

  return (
    <div className="space-y-4">
      <div className="rounded-panel border border-white/5 bg-base p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Cluster graph</p>
            <p className="mt-1 text-sm text-muted">X axis is 20-session momentum. Y axis is 14-session annualized volatility.</p>
          </div>
          <span className="rounded-chip border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-widest text-primary">
            K-means
          </span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="rgba(107, 127, 163, 0.15)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="momentum20"
                stroke="#6B7FA3"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                name="Momentum"
              />
              <YAxis
                type="number"
                dataKey="volatility14"
                domain={[0, yAxisMax]}
                stroke="#6B7FA3"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                name="Volatility"
              />
              <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "4 4" }} />
              {clusterModel.clusters.map((cluster) => (
                <Scatter
                  key={cluster.clusterId}
                  data={clusterModel.points.filter((point) => point.clusterId === cluster.clusterId)}
                  fill={cluster.color}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-3">
        {clusterModel.clusters.map((cluster) => (
          <div key={cluster.clusterId} className="rounded-panel border border-white/5 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cluster.color }} />
                <div>
                  <p className="font-semibold text-text">{cluster.label}</p>
                  <p className="text-xs text-muted">{cluster.count} stocks in this behavior bucket</p>
                </div>
              </div>
              <p className="text-xs uppercase tracking-widest text-muted">
                {cluster.tickers.slice(0, 3).join(", ")}
                {cluster.tickers.length > 3 ? "..." : ""}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="min-w-0 rounded-panel bg-base p-2.5">
                <p className="min-h-[2rem] text-[10px] uppercase leading-snug tracking-[0.12em] text-muted break-words">
                  Momentum
                </p>
                <p className={`mt-2 text-sm font-semibold ${cluster.avgMomentum >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatSignedPercent(cluster.avgMomentum)}
                </p>
              </div>
              <div className="min-w-0 rounded-panel bg-base p-2.5">
                <p className="min-h-[2rem] text-[10px] uppercase leading-snug tracking-[0.12em] text-muted break-words">
                  Volatility
                </p>
                <p className="mt-2 text-sm font-semibold text-text">{cluster.avgVolatility.toFixed(2)}%</p>
              </div>
              <div className="min-w-0 rounded-panel bg-base p-2.5">
                <p className="min-h-[2rem] text-[10px] uppercase leading-snug tracking-[0.12em] text-muted break-words">
                  Avg PE
                </p>
                <p className="mt-2 text-sm font-semibold text-text">{cluster.avgPe.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthView({
  analyticsLoading,
  analyticsError,
  growthRows,
  portfolioSnapshot,
  forecastLoading,
  forecastError,
}) {
  if (analyticsLoading && growthRows.length === 0) {
    return (
      <div className="space-y-3">
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-20 w-full" />
      </div>
    );
  }

  if (analyticsError && growthRows.length === 0) {
    return <div className="rounded-panel border border-loss/20 bg-loss/10 p-4 text-sm text-loss">{analyticsError}</div>;
  }

  if (!growthRows.length) {
    return <div className="rounded-panel bg-white/5 p-4 text-sm text-muted">Growth analysis needs synced price history for at least one stock.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightStat
          label="Strongest momentum"
          value={portfolioSnapshot.strongestMomentum?.ticker ?? "--"}
          valueClassName="overflow-hidden text-xl leading-tight break-all sm:text-2xl"
          helper={
            portfolioSnapshot.strongestMomentum
              ? `${formatSignedPercent(portfolioSnapshot.strongestMomentum.momentum20)} over 20 sessions`
              : "Awaiting price history"
          }
        />
        <InsightStat
          label="Largest holding"
          value={portfolioSnapshot.largestHolding?.ticker ?? "--"}
          valueClassName="overflow-hidden text-xl leading-tight break-all sm:text-2xl"
          helper={
            portfolioSnapshot.largestHolding
              ? formatPrice(portfolioSnapshot.largestHolding.holdingValue || 0, 2)
              : "Awaiting portfolio values"
          }
        />
      </div>

      {forecastLoading ? (
        <div className="rounded-panel border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          Loading forecast support for the growth scores...
        </div>
      ) : forecastError ? (
        <div className="rounded-panel border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
          {forecastError}
        </div>
      ) : null}

      <div className="space-y-3">
        {growthRows.map((item) => {
          const scoreWidth = Math.max(8, Math.min(100, item.growthScore + 35));
          return (
            <div key={item.id} className="rounded-panel border border-white/5 bg-base px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl text-text">{item.ticker}</p>
                  <p className="text-sm text-muted">{item.companyName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-muted">Growth score</p>
                  <p className="mt-1 font-mono text-lg text-text">{item.growthScore.toFixed(1)}</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-primary" style={{ width: `${scoreWidth}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-panel bg-white/5 p-2.5">
                  <p className="uppercase tracking-widest text-muted">20D momentum</p>
                  <p className={`mt-2 font-semibold ${item.momentum20 >= 0 ? "text-profit" : "text-loss"}`}>
                    {formatSignedPercent(item.momentum20)}
                  </p>
                </div>
                <div className="rounded-panel bg-white/5 p-2.5">
                  <p className="uppercase tracking-widest text-muted">Holding value</p>
                  <p className="mt-2 font-semibold text-text">{formatPrice(item.holdingValue || 0, 2)}</p>
                </div>
                <div className="rounded-panel bg-white/5 p-2.5">
                  <p className="uppercase tracking-widest text-muted">Forecast move</p>
                  <p
                    className={`mt-2 font-semibold ${
                      !hasForecastValue(item.forecastGrowthPct)
                        ? "text-text"
                        : Number(item.forecastGrowthPct) >= 0
                          ? "text-profit"
                          : "text-loss"
                    }`}
                  >
                    {hasForecastValue(item.forecastGrowthPct)
                      ? formatSignedPercent(item.forecastGrowthPct)
                      : "Pending"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AiSummaryView({
  analyticsLoading,
  analyticsError,
  summaryCards,
  aiSummaryData,
  aiSummaryLoading,
  aiSummaryError,
  forecastLoading,
}) {
  if ((analyticsLoading || aiSummaryLoading) && !aiSummaryData && summaryCards.length === 0) {
    return (
      <div className="space-y-3">
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-20 w-full" />
      </div>
    );
  }

  if (analyticsError && !aiSummaryData && summaryCards.length === 0) {
    return <div className="rounded-panel border border-loss/20 bg-loss/10 p-4 text-sm text-loss">{analyticsError}</div>;
  }

  const paragraphs = String(aiSummaryData?.summary || "")
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const sectionTitles = ["Portfolio Pulse", "Leadership & Risk", "Investor Takeaway"];

  return (
    <div className="space-y-3">
      {forecastLoading ? (
        <div className="rounded-panel border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          Pulling in forecast context for the summary...
        </div>
      ) : null}
      {aiSummaryError ? (
        <div className="rounded-panel border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
          {aiSummaryError}
        </div>
      ) : null}
      {aiSummaryData && paragraphs.length ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <InsightStat
              label="Portfolio"
              value={aiSummaryData.portfolio_title}
              valueClassName="text-xl leading-tight break-words sm:text-2xl"
              helper={`${aiSummaryData.stock_count || 0} tracked holdings`}
            />
            <InsightStat
              label="Forecast stance"
              value={formatSignedPercent(aiSummaryData.forecast_growth_pct || 0)}
              tone={Number(aiSummaryData.forecast_growth_pct) >= 0 ? "text-profit" : "text-loss"}
              helper="Based on the latest loaded portfolio forecast"
            />
          </div>

          <div className="space-y-3">
            {paragraphs.map((paragraph, index) => {
              const isTakeaway = index === Math.min(2, paragraphs.length - 1);

              return (
                <div
                  key={index}
                  className={`rounded-panel border p-4 ${
                    isTakeaway
                      ? "border-primary/20 bg-primary/10"
                      : "border-white/5 bg-white/5"
                  }`}
                >
                  <p
                    className={`text-xs uppercase tracking-widest ${
                      isTakeaway ? "text-primary" : "text-muted"
                    }`}
                  >
                    {sectionTitles[index] || `Section ${index + 1}`}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-text">{paragraph}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        summaryCards.map((card) => (
          <div key={card.title} className="rounded-panel border border-white/5 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-muted">{card.title}</p>
            <p className="mt-3 text-sm leading-7 text-text">{card.body}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default function PortfolioInsightsPanel({
  portfolioId,
  stocks,
  onToast,
}) {
  const [activeTab, setActiveTab] = useState("recommendation");
  const [analyticsDetailsMap, setAnalyticsDetailsMap] = useState({});
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [aiSummaryData, setAiSummaryData] = useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState("");
  const analyticsRequestKeyRef = useRef("");
  const forecastRequestKeyRef = useRef("");
  const aiSummaryRequestKeyRef = useRef("");

  const analyticsSignature = useMemo(
    () => stocks.map((stock) => `${stock.id}:${stock.quantity}:${stock.modified_at}`).join("|"),
    [stocks]
  );

  useEffect(() => {
    setActiveTab("recommendation");
  }, [portfolioId]);

  useEffect(() => {
    setAnalyticsDetailsMap({});
    setAnalyticsLoading(false);
    setAnalyticsError("");
    setForecastData(null);
    setForecastLoading(false);
    setForecastError("");
    setAiSummaryData(null);
    setAiSummaryLoading(false);
    setAiSummaryError("");
    analyticsRequestKeyRef.current = "";
    forecastRequestKeyRef.current = "";
    aiSummaryRequestKeyRef.current = "";
  }, [analyticsSignature]);

  const ensureAnalyticsDetails = useCallback(async () => {
    if (!stocks.length) {
      analyticsRequestKeyRef.current = analyticsSignature;
      return;
    }

    const missingStocks = stocks.filter(
      (stock) => !Array.isArray(analyticsDetailsMap?.[stock.id]?.stock_data)
    );

    if (!missingStocks.length) {
      analyticsRequestKeyRef.current = analyticsSignature;
      return;
    }

    if (analyticsLoading || analyticsRequestKeyRef.current === analyticsSignature) {
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsError("");

    const results = await Promise.allSettled(
      missingStocks.map(async (stock) => {
        const response = await getUserStock(stock.id);
        return [stock.id, response.user_stock];
      })
    );

    const fulfilled = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const rejected = results.filter((result) => result.status === "rejected");

    if (fulfilled.length) {
      setAnalyticsDetailsMap((current) => ({
        ...current,
        ...Object.fromEntries(fulfilled),
      }));
    }

    if (!rejected.length) {
      analyticsRequestKeyRef.current = analyticsSignature;
    } else {
      setAnalyticsError("Some analytics inputs could not be loaded right now.");
    }

    setAnalyticsLoading(false);
  }, [analyticsDetailsMap, analyticsLoading, analyticsSignature, stocks]);

  const ensureForecast = useCallback(
    async ({ force = false, announce = false } = {}) => {
      if (!portfolioId || !stocks.length) {
        setForecastData(null);
        setForecastLoading(false);
        setForecastError("");
        forecastRequestKeyRef.current = analyticsSignature;
        return;
      }

      if (!force && forecastRequestKeyRef.current === analyticsSignature && forecastData) {
        return;
      }

      if (forecastLoading) {
        return;
      }

      setForecastLoading(true);
      setForecastError("");

      try {
        const response = await getPortfolioForecast(portfolioId);
        setForecastData(response);
        forecastRequestKeyRef.current = analyticsSignature;
        if (announce) {
          onToast?.({ type: "success", message: "Portfolio forecast refreshed." });
        }
      } catch (error) {
        setForecastData(null);
        setForecastError(
          error.response?.data?.error || "Unable to load the portfolio forecast."
        );
        if (announce) {
          onToast?.({
            type: "error",
            message: error.response?.data?.error || "Unable to refresh portfolio forecast.",
          });
        }
      } finally {
        setForecastLoading(false);
      }
    },
    [analyticsSignature, forecastData, forecastLoading, onToast, portfolioId, stocks.length]
  );

  const ensureAiSummary = useCallback(async () => {
    if (!portfolioId || !stocks.length) {
      setAiSummaryData(null);
      setAiSummaryLoading(false);
      setAiSummaryError("");
      aiSummaryRequestKeyRef.current = analyticsSignature;
      return;
    }

    if (aiSummaryLoading || (aiSummaryRequestKeyRef.current === analyticsSignature && aiSummaryData)) {
      return;
    }

    setAiSummaryLoading(true);
    setAiSummaryError("");

    try {
      const response = await getPortfolioAiSummary(portfolioId);
      setAiSummaryData(response);
      aiSummaryRequestKeyRef.current = analyticsSignature;
    } catch (error) {
      setAiSummaryData(null);
      setAiSummaryError(
        error.response?.data?.error || "Unable to load the AI portfolio summary right now."
      );
    } finally {
      setAiSummaryLoading(false);
    }
  }, [aiSummaryData, aiSummaryLoading, analyticsSignature, portfolioId, stocks.length]);

  useEffect(() => {
    const needsAnalytics = ["recommendation", "clustering", "growth", "ai_summary"].includes(activeTab);
    const needsForecast = ["forecasting", "growth", "ai_summary"].includes(activeTab);
    const needsAiSummary = activeTab === "ai_summary";

    if (needsAnalytics) {
      ensureAnalyticsDetails();
    }
    if (needsForecast) {
      ensureForecast();
    }
    if (needsAiSummary) {
      ensureAiSummary();
    }
  }, [activeTab, ensureAiSummary, ensureAnalyticsDetails, ensureForecast]);

  const analyticsStocks = useMemo(
    () => buildPortfolioAnalytics(stocks, analyticsDetailsMap, forecastData),
    [analyticsDetailsMap, forecastData, stocks]
  );
  const recommendationRows = useMemo(() => getRecommendationRows(analyticsStocks), [analyticsStocks]);
  const growthRows = useMemo(() => getGrowthRows(analyticsStocks), [analyticsStocks]);
  const portfolioSnapshot = useMemo(
    () => getPortfolioSnapshot(analyticsStocks, forecastData),
    [analyticsStocks, forecastData]
  );
  const clusterModel = useMemo(() => buildKMeansClusters(analyticsStocks), [analyticsStocks]);
  const summaryCards = useMemo(
    () => buildAiSummaryLines(analyticsStocks, forecastData, clusterModel),
    [analyticsStocks, clusterModel, forecastData]
  );
  const forecastRows = useMemo(
    () =>
      [...(forecastData?.stock_predictions ?? [])]
        .sort((left, right) => Math.abs(Number(right.growth_pct ?? 0)) - Math.abs(Number(left.growth_pct ?? 0)))
        .slice(0, 4),
    [forecastData]
  );
  const readyModelCount = useMemo(
    () =>
      (forecastData?.stock_predictions ?? []).filter((item) => item.model_status === "ready").length,
    [forecastData]
  );

  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab) ?? TAB_CONFIG[0];
  const ActiveIcon = activeTabConfig.icon;

  return (
    <section className="panel flex flex-col overflow-hidden p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <ActiveIcon size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Smart Insights</p>
            <h3 className="font-display text-2xl text-text">{activeTabConfig.title}</h3>
          </div>
        </div>
        {activeTab === "forecasting" ? (
          <button
            type="button"
            onClick={() => ensureForecast({ force: true, announce: true })}
            disabled={forecastLoading}
            className="inline-flex items-center gap-2 rounded-panel border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-text transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} className={forecastLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        ) : (
          <span className="rounded-chip border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-widest text-primary">
            Loads on click
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              startTransition(() => {
                setActiveTab(tab.id);
              });
            }}
            className={`rounded-chip border px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
              activeTab === tab.id
                ? "border-primary/30 bg-primary text-slate-950"
                : "border-border bg-white/5 text-muted hover:border-primary/20 hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="smart-insights-scroll scrollbar-thin mt-4 min-h-0 flex-1 overflow-y-auto pr-1 lg:pr-2">
        <p className="text-sm leading-6 text-muted">{activeTabConfig.description}</p>

        {!stocks.length ? (
          <div className="mt-4 rounded-panel bg-white/5 p-4 text-sm text-muted">
            Add stocks to this portfolio to unlock forecasting, clustering, and recommendation insights.
          </div>
        ) : (
          <div className="mt-5">
            {activeTab === "recommendation" ? (
              <RecommendationView
                analyticsLoading={analyticsLoading}
                analyticsError={analyticsError}
                recommendationRows={recommendationRows}
                portfolioSnapshot={portfolioSnapshot}
              />
            ) : null}

            {activeTab === "forecasting" ? (
              <ForecastingView
                forecastLoading={forecastLoading}
                forecastError={forecastError}
                forecastData={forecastData}
                forecastRows={forecastRows}
                readyModelCount={readyModelCount}
              />
            ) : null}

            {activeTab === "clustering" ? (
              <ClusteringView
                analyticsLoading={analyticsLoading}
                analyticsError={analyticsError}
                clusterModel={clusterModel}
              />
            ) : null}

            {activeTab === "growth" ? (
              <GrowthView
                analyticsLoading={analyticsLoading}
                analyticsError={analyticsError}
                growthRows={growthRows}
                portfolioSnapshot={portfolioSnapshot}
                forecastLoading={forecastLoading}
                forecastError={forecastError}
              />
            ) : null}

            {activeTab === "ai_summary" ? (
            <AiSummaryView
              analyticsLoading={analyticsLoading}
              analyticsError={analyticsError}
              summaryCards={summaryCards}
              aiSummaryData={aiSummaryData}
              aiSummaryLoading={aiSummaryLoading}
              aiSummaryError={aiSummaryError}
              forecastLoading={forecastLoading}
            />
          ) : null}
          </div>
        )}

        {activeTab === "recommendation" && portfolioSnapshot.highestConviction ? (
          <div className="mt-5 rounded-panel border border-white/5 bg-base px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted">Quick scan</p>
                <p className="mt-1 text-sm text-text">
                  Best idea: {portfolioSnapshot.highestConviction.ticker} | Highest risk:{" "}
                  {portfolioSnapshot.riskiest?.ticker ?? "--"}
                </p>
              </div>
              <div className="text-right text-xs text-muted">
                <p>Tracked value</p>
                <p className="mt-1 font-mono text-sm text-text">
                  {formatCompactNumber(portfolioSnapshot.totalHoldingValue || 0)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2 pb-1 text-xs text-muted">
          <Sparkles size={14} className="text-primary" />
          <span>Tab data stays cached after the first load to keep switching fast.</span>
        </div>
      </div>
    </section>
  );
}
