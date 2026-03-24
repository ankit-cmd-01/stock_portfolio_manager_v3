import { useCallback, useEffect, useMemo, useState } from "react";

import { metalsApi } from "../api/metalsApi";

const cache = new Map();

const buildCacheKey = (metal, range) => `${metal}:${range}`;

export function useMetals(metal, range = "1m") {
  const [prices, setPrices] = useState([]);
  const [ohlc, setOhlc] = useState([]);
  const [summary, setSummary] = useState(null);
  const [eda, setEda] = useState(null);
  const [loading, setLoading] = useState(Boolean(metal));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!metal) {
      return undefined;
    }

    let cancelled = false;
    const cacheKey = buildCacheKey(metal, range);

    const hydrateCache = () => {
      const cached = cache.get(cacheKey);
      if (!cached) {
        return false;
      }

      setPrices(cached.prices);
      setOhlc(cached.ohlc);
      setSummary(cached.summary);
      setEda(cached.eda);
      return true;
    };

    const load = async () => {
      const hadCache = hydrateCache();
      setLoading(!hadCache);
      setError("");

      try {
        const [pricesResponse, ohlcResponse, summaryResponse, edaResponse] = await Promise.all([
          metalsApi.prices(metal, { limit: 500 }),
          metalsApi.ohlc(metal, range),
          metalsApi.summary(metal),
          metalsApi.eda(metal),
        ]);

        if (cancelled) {
          return;
        }

        const nextState = {
          prices: pricesResponse.data.results ?? [],
          ohlc: ohlcResponse.data.results ?? [],
          summary: summaryResponse.data ?? null,
          eda: edaResponse.data?.report ?? null,
        };

        setPrices(nextState.prices);
        setOhlc(nextState.ohlc);
        setSummary(nextState.summary);
        setEda(nextState.eda);
        cache.set(cacheKey, nextState);
      } catch (requestError) {
        if (cancelled) {
          return;
        }
        setError(requestError.response?.data?.error || "Unable to load metals data.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [metal, range]);

  const refresh = useCallback(async () => {
    if (!metal) {
      return;
    }

    const cacheKey = buildCacheKey(metal, range);
    try {
      setLoading(true);
      const [pricesResponse, ohlcResponse, summaryResponse, edaResponse] = await Promise.all([
        metalsApi.prices(metal, { limit: 500 }),
        metalsApi.ohlc(metal, range),
        metalsApi.summary(metal),
        metalsApi.eda(metal),
      ]);
      const nextState = {
        prices: pricesResponse.data.results ?? [],
        ohlc: ohlcResponse.data.results ?? [],
        summary: summaryResponse.data ?? null,
        eda: edaResponse.data?.report ?? null,
      };
      setPrices(nextState.prices);
      setOhlc(nextState.ohlc);
      setSummary(nextState.summary);
      setEda(nextState.eda);
      cache.set(cacheKey, nextState);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to refresh metals data.");
    } finally {
      setLoading(false);
    }
  }, [metal, range]);

  return useMemo(
    () => ({
      prices,
      ohlc,
      summary,
      eda,
      loading,
      error,
      refresh,
    }),
    [prices, ohlc, summary, eda, loading, error, refresh]
  );
}
