import { useCallback, useEffect, useState } from "react";

import { getPortfolioStocks, getPortfolios } from "../api/stocks";

export function usePortfolio(portfolioId) {
  const [portfolios, setPortfolios] = useState([]);
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [portfolioListResult, selectedPortfolioResult] = await Promise.allSettled([
      getPortfolios(),
      portfolioId ? getPortfolioStocks(portfolioId) : Promise.resolve(null),
    ]);

    let nextError = "";
    let nextPortfolios = [];

    if (portfolioListResult.status === "fulfilled") {
      nextPortfolios = portfolioListResult.value.portfolios ?? [];
      setPortfolios(nextPortfolios);
    } else {
      setPortfolios([]);
      nextError =
        portfolioListResult.reason?.response?.data?.error || "Unable to load portfolio list.";
    }

    if (selectedPortfolioResult.status === "fulfilled") {
      setPortfolioData(selectedPortfolioResult.value);
    } else if (portfolioId) {
      const matchedPortfolio = nextPortfolios.find(
        (portfolio) => String(portfolio.id) === String(portfolioId)
      );
      setPortfolioData(
        matchedPortfolio
          ? {
              portfolio: matchedPortfolio.title,
              count: 0,
              user_stocks: [],
            }
          : null
      );
      nextError =
        selectedPortfolioResult.reason?.response?.data?.error ||
        selectedPortfolioResult.reason?.message ||
        "Unable to load stocks for this portfolio right now.";
    } else {
      setPortfolioData(null);
    }

    setError(nextError);
    setLoading(false);
  }, [portfolioId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    portfolios,
    portfolioData,
    loading,
    error,
    reload: load,
  };
}
