import { useEffect, useState } from "react";

import { getNewsSentiment } from "../../../api/advanced";

function buildFallbackData(ticker, company) {
  return {
    ticker,
    company,
    new_articles_added: 0,
    overall: {
      overall_sentiment: "NEUTRAL",
      positive_pct: 0,
      negative_pct: 0,
      neutral_pct: 100,
      article_count: 0,
      last_updated: null,
    },
    articles: [],
  };
}

export function useNewsSentiment(ticker, company) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(ticker));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ticker) {
      setData(null);
      setLoading(false);
      setError("Missing ticker for sentiment lookup.");
      return undefined;
    }

    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getNewsSentiment({ ticker, company });
        if (!ignore) {
          setData(response);
        }
      } catch (requestError) {
        if (!ignore) {
          setData(buildFallbackData(ticker, company));
          setError(requestError.response?.status === 400 ? requestError.response?.data?.error : "");
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
