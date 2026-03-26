export const metalLabelMap = {
  gold: "Gold",
  silver: "Silver",
};

const USD_TO_INR_RATE = 92.44;

export function formatPrice(val, metal) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    return "--";
  }

  const convertedValue = Number(val) * USD_TO_INR_RATE;
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(convertedValue);
}

export function formatChange(pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) {
    return { text: "--", className: "text-muted" };
  }

  const value = Number(pct);
  const prefix = value > 0 ? "+" : "";
  return {
    text: `${prefix}${value.toFixed(2)}%`,
    className: value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-muted",
  };
}

export function getRSILabel(rsi) {
  if (rsi === null || rsi === undefined || Number.isNaN(Number(rsi))) {
    return "Neutral";
  }

  const value = Number(rsi);
  if (value >= 70) {
    return "Overbought";
  }
  if (value <= 30) {
    return "Oversold";
  }
  return "Neutral";
}

export function getMACDSignal(macd, sig) {
  if (macd === null || sig === null || macd === undefined || sig === undefined) {
    return "Neutral";
  }
  return Number(macd) >= Number(sig) ? "Bullish" : "Bearish";
}

export function getBBPosition(close, upper, lower) {
  if ([close, upper, lower].some((value) => value === null || value === undefined)) {
    return "Inside";
  }
  if (Number(close) > Number(upper)) {
    return "Above";
  }
  if (Number(close) < Number(lower)) {
    return "Below";
  }
  return "Inside";
}

export function formatTimestamp(ts) {
  if (!ts) {
    return "--";
  }

  return `${new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} IST`;
}
