import { useEffect, useState } from "react";

import { getEarningsAnalysis } from "../../../api/advanced";

export function useEarnings(ticker, company) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(ticker));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ticker) {
      setData(null);
      setLoading(false);
      setError("Missing ticker for earnings lookup.");
      return undefined;
    }

    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getEarningsAnalysis({ ticker, company });
        if (!ignore) {
          setData(response);
        }
      } catch (requestError) {
        if (!ignore) {
          setData(null);
          setError(
            requestError.response?.data?.error || "Unable to load earnings analysis right now."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [company, ticker]);

  return { data, loading, error };
}
