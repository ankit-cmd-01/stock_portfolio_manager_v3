import { useCallback, useEffect, useState } from "react";

import { getUserStock, getUserStocks } from "../api/stocks";

export function useStocks(autoLoad = true) {
  const [stocks, setStocks] = useState([]);
  const [detailsMap, setDetailsMap] = useState({});
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState("");

  const loadStocks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getUserStocks();
      const items = response.user_stocks ?? [];
      setStocks(items);

      const details = await Promise.all(
        items.slice(0, 8).map(async (item) => {
          try {
            const detail = await getUserStock(item.id);
            return [item.id, detail.user_stock];
          } catch (detailError) {
            return [item.id, null];
          }
        })
      );

      setDetailsMap(Object.fromEntries(details));
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load your tracked stocks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadStocks();
    }
  }, [autoLoad, loadStocks]);

  return {
    stocks,
    detailsMap,
    loading,
    error,
    reload: loadStocks,
  };
}
