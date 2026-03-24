import { useCallback, useEffect, useState } from "react";

import { getSuggestedPortfolios } from "../api/stocks";

export function useSuggestedPortfolios(autoLoad = true) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getSuggestedPortfolios();
      setCategories(response.categories ?? []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load suggested portfolios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);

  return {
    categories,
    loading,
    error,
    reload: load,
  };
}
