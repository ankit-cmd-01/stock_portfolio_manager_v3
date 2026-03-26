const CLUSTER_COLORS = ["#00D4FF", "#22C55E", "#F59E0B"];
const FALLBACK_PE = 22;
const TRADING_DAYS_PER_YEAR = 252;
const VOLATILITY_WINDOW = 14;
const DAILY_RETURN_CLIP = 0.2;
const MAX_ANNUALIZED_VOLATILITY_PCT = 100;

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function average(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (!cleanValues.length) {
    return 0;
  }

  return cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length;
}

function standardDeviation(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (cleanValues.length < 2) {
    return 0;
  }

  const mean = average(cleanValues);
  const variance =
    cleanValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / cleanValues.length;
  return Math.sqrt(variance);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function computePctChange(values) {
  return values
    .slice(1)
    .map((currentValue, index) => {
      const previousValue = values[index];
      if (!Number.isFinite(previousValue) || previousValue <= 0 || !Number.isFinite(currentValue)) {
        return Number.NaN;
      }

      return (currentValue - previousValue) / previousValue;
    })
    .filter((value) => Number.isFinite(value));
}

function computeAnnualizedVolatilityPct(closeSeries, windowSize = VOLATILITY_WINDOW) {
  const returns = computePctChange(closeSeries)
    .map((value) => clamp(value, -DAILY_RETURN_CLIP, DAILY_RETURN_CLIP))
    .filter((value) => Number.isFinite(value));

  if (returns.length < 2) {
    return 0;
  }

  const rollingWindow = returns.slice(-windowSize);
  if (rollingWindow.length < 2) {
    return 0;
  }

  const rollingStd = standardDeviation(rollingWindow);
  const annualizedVolatilityPct = rollingStd * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;

  return clamp(annualizedVolatilityPct, 0, MAX_ANNUALIZED_VOLATILITY_PCT);
}

function scoreRecommendation({
  momentum20,
  volumeRatio,
  peValue,
  latestClose,
  ma10,
  volatility14,
  forecastGrowthPct,
}) {
  const momentumScore = clamp(momentum20, -15, 15) * 1.6;
  const volumeScore = clamp((volumeRatio - 1) * 18, -10, 20);
  const valuationScore =
    peValue <= 0 ? 0 : peValue < 15 ? 18 : peValue < 24 ? 12 : peValue < 32 ? 5 : -10;
  const trendScore = latestClose >= ma10 ? 12 : -8;
  const forecastScore = Number.isFinite(forecastGrowthPct) ? clamp(forecastGrowthPct, -10, 10) * 0.8 : 0;
  const riskPenalty = clamp(volatility14, 0, 12) * 1.1;

  return clamp(55 + momentumScore + volumeScore + valuationScore + trendScore + forecastScore - riskPenalty, 0, 100);
}

function getRecommendationReasons(snapshot) {
  const reasons = [];

  if (snapshot.momentum20 >= 8) {
    reasons.push("Momentum is leading the portfolio over the last 20 sessions.");
  } else if (snapshot.momentum20 <= -6) {
    reasons.push("Recent momentum is soft, so this name may need patience.");
  }

  if (snapshot.volumeRatio >= 1.2) {
    reasons.push("Trading activity is above its recent average.");
  } else if (snapshot.volumeRatio > 0 && snapshot.volumeRatio <= 0.8) {
    reasons.push("Participation is light versus the recent volume trend.");
  }

  if (snapshot.peValue > 0 && snapshot.peValue < 18) {
    reasons.push("Valuation looks relatively disciplined on trailing PE.");
  } else if (snapshot.peValue >= 32) {
    reasons.push("Valuation is stretched, which raises execution risk.");
  }

  if (Number.isFinite(snapshot.forecastGrowthPct) && snapshot.forecastGrowthPct >= 3) {
    reasons.push("The forecast model still points to upside from current value.");
  } else if (Number.isFinite(snapshot.forecastGrowthPct) && snapshot.forecastGrowthPct <= -3) {
    reasons.push("The forecast model currently points to downside risk.");
  }

  if (!reasons.length) {
    reasons.push("Price, valuation, and volume are broadly balanced right now.");
  }

  return reasons.slice(0, 3);
}

function getRecommendationLabel(score) {
  if (score >= 78) {
    return "High conviction";
  }
  if (score >= 66) {
    return "Accumulation";
  }
  if (score >= 54) {
    return "Watchlist";
  }
  return "Caution";
}

export function buildPortfolioAnalytics(stocks, detailMap, forecastData) {
  const forecastByStockId = new Map(
    (forecastData?.stock_predictions ?? []).map((item) => [Number(item.user_stock_id), item])
  );

  return stocks.map((stock) => {
    const detail = detailMap?.[stock.id];
    const candles = Array.isArray(detail?.stock_data) ? detail.stock_data : [];
    const quantity = toNumber(stock.quantity, 0);
    const forecastItem = forecastByStockId.get(Number(stock.id));

    if (!candles.length) {
      return {
        id: stock.id,
        ticker: stock.ticker,
        companyName: stock.company_name,
        quantity,
        hasData: false,
        holdingValue: 0,
        momentum20: 0,
        dailyChangePct: 0,
        volatility14: 0,
        volumeRatio: 0,
        peValue: 0,
        recommendationScore: 0,
        recommendationLabel: "Unavailable",
        recommendationReasons: ["Market data is not synced for this stock yet."],
        growthScore: 0,
        forecastGrowthPct: Number.isFinite(toNumber(forecastItem?.growth_pct, Number.NaN))
          ? toNumber(forecastItem?.growth_pct, 0)
          : null,
        forecastPredictedValue: toNumber(forecastItem?.predicted_value, 0),
      };
    }

    const latest = candles[candles.length - 1] ?? {};
    const previous = candles[candles.length - 2] ?? latest;
    const closes = candles
      .map((item) => toNumber(item.close, Number.NaN))
      .filter((value) => Number.isFinite(value));
    const volumes = candles
      .map((item) => toNumber(item.volume, Number.NaN))
      .filter((value) => Number.isFinite(value));
    const latestClose = toNumber(latest.close, 0);
    const previousClose = toNumber(previous.close, latestClose);
    const latestOpen = toNumber(latest.open, latestClose);
    const latestVolume = toNumber(latest.volume, 0);
    const peValue = toNumber(latest.pe_ratio, 0);
    const comparisonClose = closes[Math.max(0, closes.length - 21)] ?? closes[0] ?? latestClose;
    const dailyChangePct = previousClose > 0 ? ((latestClose - previousClose) / previousClose) * 100 : 0;
    const intradayMovePct = latestOpen > 0 ? ((latestClose - latestOpen) / latestOpen) * 100 : 0;
    const momentum20 = comparisonClose > 0 ? ((latestClose - comparisonClose) / comparisonClose) * 100 : 0;
    const avgVolume20 = average(volumes.slice(-20));
    const ma10 = average(closes.slice(-10));
    const ma20 = average(closes.slice(-20));
    const volatility14 = computeAnnualizedVolatilityPct(closes);
    const volumeRatio = avgVolume20 > 0 ? latestVolume / avgVolume20 : 0;
    const holdingValue = latestClose * quantity;
    const forecastGrowthPct = Number.isFinite(toNumber(forecastItem?.growth_pct, Number.NaN))
      ? toNumber(forecastItem?.growth_pct, 0)
      : null;
    const recommendationScore = scoreRecommendation({
      momentum20,
      volumeRatio,
      peValue,
      latestClose,
      ma10,
      volatility14,
      forecastGrowthPct,
    });
    const growthScore =
      momentum20 * 0.6 +
      (Number.isFinite(forecastGrowthPct) ? forecastGrowthPct * 0.4 : 0) +
      (latestClose >= ma20 ? 6 : -3);

    const snapshot = {
      id: stock.id,
      ticker: stock.ticker,
      companyName: stock.company_name,
      quantity,
      latestClose,
      previousClose,
      latestVolume,
      holdingValue,
      peValue,
      ma10,
      ma20,
      dailyChangePct,
      intradayMovePct,
      momentum20,
      volatility14,
      volumeRatio,
      forecastGrowthPct,
      forecastPredictedValue: toNumber(forecastItem?.predicted_value, 0),
      forecastCurrentValue: toNumber(forecastItem?.current_value, holdingValue),
      modelStatus: forecastItem?.model_status ?? "unloaded",
      hasData: true,
      recommendationScore,
      recommendationLabel: getRecommendationLabel(recommendationScore),
      growthScore,
    };

    return {
      ...snapshot,
      recommendationReasons: getRecommendationReasons(snapshot),
    };
  });
}

export function getRecommendationRows(analyticsStocks) {
  return analyticsStocks
    .filter((item) => item.hasData)
    .sort((left, right) => right.recommendationScore - left.recommendationScore)
    .slice(0, 4);
}

export function getGrowthRows(analyticsStocks) {
  return analyticsStocks
    .filter((item) => item.hasData)
    .sort((left, right) => right.growthScore - left.growthScore)
    .slice(0, 5);
}

export function getPortfolioSnapshot(analyticsStocks, forecastData) {
  const tracked = analyticsStocks.filter((item) => item.hasData);
  const strongestMomentum = [...tracked].sort((left, right) => right.momentum20 - left.momentum20)[0] ?? null;
  const highestConviction = [...tracked].sort(
    (left, right) => right.recommendationScore - left.recommendationScore
  )[0] ?? null;
  const largestHolding = [...tracked].sort((left, right) => right.holdingValue - left.holdingValue)[0] ?? null;
  const riskiest = [...tracked].sort((left, right) => right.volatility14 - left.volatility14)[0] ?? null;

  return {
    trackedCount: tracked.length,
    totalCount: analyticsStocks.length,
    averageMomentum: average(tracked.map((item) => item.momentum20)),
    averageVolatility: average(tracked.map((item) => item.volatility14)),
    totalHoldingValue: tracked.reduce((sum, item) => sum + item.holdingValue, 0),
    gainers: tracked.filter((item) => item.dailyChangePct >= 0).length,
    strongestMomentum,
    highestConviction,
    largestHolding,
    riskiest,
    forecastGrowthPct: forecastData ? toNumber(forecastData.growth_pct, 0) : null,
  };
}

function normalizeRows(rows, keys) {
  const stats = Object.fromEntries(
    keys.map((key) => {
      const values = rows.map((row) => row[key]);
      return [
        key,
        {
          mean: average(values),
          deviation: standardDeviation(values) || 1,
        },
      ];
    })
  );

  return rows.map((row) => ({
    ...row,
    normalized: Object.fromEntries(
      keys.map((key) => [key, (row[key] - stats[key].mean) / stats[key].deviation])
    ),
  }));
}

function distanceBetween(point, centroid, keys) {
  return Math.sqrt(
    keys.reduce((sum, key) => sum + (point.normalized[key] - centroid[key]) ** 2, 0)
  );
}

function buildClusterLabels(clusters) {
  const labels = {};
  const orderedByMomentum = [...clusters].sort((left, right) => right.avgMomentum - left.avgMomentum);
  const orderedByVolatility = [...clusters].sort(
    (left, right) => right.avgVolatility - left.avgVolatility
  );
  const orderedByPe = [...clusters].sort((left, right) => left.avgPe - right.avgPe);

  if (orderedByMomentum[0]) {
    labels[orderedByMomentum[0].clusterId] = "Momentum leaders";
  }
  if (orderedByPe[0] && !labels[orderedByPe[0].clusterId]) {
    labels[orderedByPe[0].clusterId] = "Value core";
  }
  if (orderedByVolatility[0] && !labels[orderedByVolatility[0].clusterId]) {
    labels[orderedByVolatility[0].clusterId] = "High volatility";
  }

  clusters.forEach((cluster, index) => {
    if (!labels[cluster.clusterId]) {
      labels[cluster.clusterId] = `Cluster ${index + 1}`;
    }
  });

  return labels;
}

export function buildKMeansClusters(analyticsStocks, desiredClusters = 3) {
  const eligibleStocks = analyticsStocks.filter((item) => item.hasData);
  if (!eligibleStocks.length) {
    return {
      points: [],
      clusters: [],
    };
  }

  const rows = normalizeRows(
    eligibleStocks.map((item) => ({
      ...item,
      momentum: item.momentum20,
      volatility: item.volatility14,
      pe: item.peValue > 0 ? item.peValue : FALLBACK_PE,
    })),
    ["momentum", "volatility", "pe"]
  );

  const clusterCount = Math.min(desiredClusters, rows.length);
  let centroids = Array.from({ length: clusterCount }, (_, index) => {
    const source = rows[Math.floor((index * rows.length) / clusterCount)];
    return { ...source.normalized };
  });
  let assignments = new Array(rows.length).fill(0);

  for (let iteration = 0; iteration < 12; iteration += 1) {
    assignments = rows.map((row) => {
      let bestCluster = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      centroids.forEach((centroid, clusterIndex) => {
        const distance = distanceBetween(row, centroid, ["momentum", "volatility", "pe"]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = clusterIndex;
        }
      });

      return bestCluster;
    });

    centroids = centroids.map((centroid, clusterIndex) => {
      const members = rows.filter((_, rowIndex) => assignments[rowIndex] === clusterIndex);
      if (!members.length) {
        return centroid;
      }

      return {
        momentum: average(members.map((member) => member.normalized.momentum)),
        volatility: average(members.map((member) => member.normalized.volatility)),
        pe: average(members.map((member) => member.normalized.pe)),
      };
    });
  }

  const clusterSummaries = Array.from({ length: clusterCount }, (_, clusterId) => {
    const members = rows.filter((_, rowIndex) => assignments[rowIndex] === clusterId);

    return {
      clusterId,
      color: CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length],
      count: members.length,
      avgMomentum: average(members.map((member) => member.momentum20)),
      avgVolatility: average(members.map((member) => member.volatility14)),
      avgPe: average(
        members.map((member) => (member.peValue > 0 ? member.peValue : FALLBACK_PE))
      ),
      tickers: members.map((member) => member.ticker),
      points: members,
    };
  }).filter((cluster) => cluster.count > 0);

  const labels = buildClusterLabels(clusterSummaries);

  const clusters = clusterSummaries.map((cluster) => ({
    ...cluster,
    label: labels[cluster.clusterId],
  }));

  const points = rows.map((row, index) => {
    const cluster = clusters.find((item) => item.clusterId === assignments[index]);
    return {
      ...row,
      clusterId: assignments[index],
      clusterLabel: cluster?.label ?? "Cluster",
      clusterColor: cluster?.color ?? CLUSTER_COLORS[0],
    };
  });

  return {
    points,
    clusters,
  };
}

export function buildAiSummaryLines(analyticsStocks, forecastData, clusterModel) {
  const snapshot = getPortfolioSnapshot(analyticsStocks, forecastData);
  const largestCluster = [...(clusterModel?.clusters ?? [])].sort((left, right) => right.count - left.count)[0];

  if (!snapshot.trackedCount) {
    return [
      {
        title: "Portfolio pulse",
        body: "Sync at least one stock with market history to unlock recommendation, clustering, and growth insights.",
      },
    ];
  }

  return [
    {
      title: "Portfolio pulse",
      body: `${snapshot.trackedCount} of ${snapshot.totalCount} holdings have usable market history. Average 20-session momentum is ${snapshot.averageMomentum.toFixed(2)}%, and ${snapshot.gainers} names are currently positive on the latest move.`,
    },
    {
      title: "Leadership read",
      body: snapshot.highestConviction
        ? `${snapshot.highestConviction.ticker} stands out as the strongest recommendation with a score of ${snapshot.highestConviction.recommendationScore.toFixed(0)}/100. ${snapshot.highestConviction.recommendationReasons[0]}`
        : "Recommendation strength will appear here once enough portfolio data is available.",
    },
    {
      title: "Cluster read",
      body: largestCluster
        ? `K-means grouping shows a largest bucket called ${largestCluster.label.toLowerCase()}, holding ${largestCluster.count} stocks with average momentum of ${largestCluster.avgMomentum.toFixed(2)}% and average volatility of ${largestCluster.avgVolatility.toFixed(2)}%.`
        : "Open the Clustering tab to inspect the behavior groups inside the portfolio.",
    },
    {
      title: "Forecast stance",
      body: forecastData
        ? `The loaded forecast model implies a portfolio move of ${toNumber(forecastData.growth_pct, 0).toFixed(2)}% from the current value. Use the Forecasting tab to compare current and predicted portfolio totals.`
        : "Forecast data loads only when needed, so this summary stays fast by default.",
    },
  ];
}
