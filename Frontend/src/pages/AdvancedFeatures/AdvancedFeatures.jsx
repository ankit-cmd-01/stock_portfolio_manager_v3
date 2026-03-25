import { ArrowLeft, BrainCircuit, Gauge, Newspaper, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import EmptyState from "../../components/EmptyState";
import AISummaryCard from "./components/AISummaryCard";
import EarningsScorecard from "./components/EarningsScorecard";
import IncrementalBadge from "./components/IncrementalBadge";
import NewsCard from "./components/NewsCard";
import SentimentMeter from "./components/SentimentMeter";
import { useEarnings } from "./hooks/useEarnings";
import { useNewsSentiment } from "./hooks/useNewsSentiment";
import styles from "./AdvancedFeatures.module.css";

export default function AdvancedFeatures() {
  const { ticker } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const company = state?.company || ticker;
  const fromPortfolioId = state?.fromPortfolioId;

  const { data: newsData, loading: newsLoading, error: newsError } = useNewsSentiment(ticker, company);
  const { data: earningsData, loading: earningsLoading, error: earningsError } = useEarnings(ticker, company);

  const articleCountLabel = useMemo(() => {
    const count = Math.max(newsData?.overall?.article_count || 0, newsData?.articles?.length || 0);
    if (count === 0) {
      return "No cached articles";
    }
    return `${count} cached ${count === 1 ? "article" : "articles"}`;
  }, [newsData]);

  const analyzedCount = useMemo(
    () => Math.max(newsData?.overall?.article_count || 0, newsData?.articles?.length || 0),
    [newsData]
  );

  const hasNewsArticles = analyzedCount > 0;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <button
          type="button"
          onClick={() => {
            if (fromPortfolioId) {
              navigate(`/portfolio/${fromPortfolioId}`);
              return;
            }
            navigate(-1);
          }}
          className={styles.backButton}
        >
          <ArrowLeft size={16} />
          Back to portfolio
        </button>

        <div className={styles.heroHeader}>
          <div>
            <div className={styles.kicker}>
              <Sparkles size={14} />
              Advanced intelligence
            </div>
            <h1 className={styles.title}>Advanced Features</h1>
            <p className={styles.subtitle}>
              Fresh news sentiment and the latest earnings readout for <strong>{company}</strong>.
            </p>
          </div>

          <div className={styles.heroMeta}>
            <div className={styles.tickerBadge}>{ticker}</div>
            <div className={styles.metaPanel}>
              <span>AI pipeline</span>
              <strong>FinBERT + Groq</strong>
            </div>
          </div>
        </div>

        <div className={styles.statStrip}>
          <div className={styles.statCard}>
            <Newspaper size={18} />
            <div>
              <span>News cache</span>
              <strong>{articleCountLabel}</strong>
            </div>
          </div>
          <div className={styles.statCard}>
            <Gauge size={18} />
            <div>
              <span>Sentiment</span>
              <strong>
                {newsLoading ? "Loading" : hasNewsArticles ? newsData?.overall?.overall_sentiment || "NEUTRAL" : "No news yet"}
              </strong>
            </div>
          </div>
          <div className={styles.statCard}>
            <BrainCircuit size={18} />
            <div>
              <span>Earnings engine</span>
              <strong>{earningsData?.ai_model_used || "Groq pending"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.sectionShell}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Section 01</p>
            <h2 className={styles.sectionTitle}>News Sentiment Analysis</h2>
          </div>
          <div className={styles.sectionTags}>
            <span className={styles.tag}>FinBERT</span>
            <span className={styles.tag}>Incremental cache</span>
            {newsData?.new_articles_added > 0 ? <IncrementalBadge count={newsData.new_articles_added} /> : null}
          </div>
        </div>

        {newsLoading ? (
          <div className={styles.newsSkeletonGrid}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={`${styles.skeletonBlock} skeleton`} />
            ))}
          </div>
        ) : newsError ? (
          <div className={styles.errorPanel}>{newsError}</div>
        ) : !hasNewsArticles ? (
          <EmptyState
            title="No News Articles Yet"
            description={`We couldn't fetch recent news for ${company} right now. Try this stock again in a little while or open another company with an active news feed.`}
          />
        ) : (
          <>
            <div className={styles.overviewGrid}>
              <SentimentMeter
                label={newsData?.overall?.overall_sentiment}
                positive={newsData?.overall?.positive_pct}
                negative={newsData?.overall?.negative_pct}
                neutral={newsData?.overall?.neutral_pct}
                count={analyzedCount}
                lastUpdated={newsData?.overall?.last_updated}
              />

              <div className={styles.sidePanel}>
                <p className={styles.sideLabel}>Refresh logic</p>
                <h3 className={styles.sideTitle}>Cache-first with incremental inserts</h3>
                <p className={styles.sideCopy}>
                  We keep older articles for context, analyze only newly discovered links, and refresh the overall tone
                  from the full cached set.
                </p>
                <div className={styles.sideList}>
                  <span>Preserves historical context</span>
                  <span>Avoids repeat model inference</span>
                  <span>Keeps newest items on top</span>
                </div>
              </div>
            </div>

            <div className={styles.newsGrid}>
              {(newsData?.articles || []).map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className={styles.sectionShell}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Section 02</p>
            <h2 className={styles.sectionTitle}>Last Quarter Earnings</h2>
          </div>
          <div className={styles.sectionTags}>
            <span className={styles.tag}>yfinance</span>
            <span className={styles.tag}>Groq</span>
          </div>
        </div>

        {earningsLoading ? (
          <div className={`${styles.largeSkeleton} skeleton`} />
        ) : earningsError ? (
          <div className={styles.errorPanel}>{earningsError}</div>
        ) : (
          <div className={styles.earningsStack}>
            <EarningsScorecard data={earningsData} />
            <AISummaryCard summary={earningsData?.ai_summary} model={earningsData?.ai_model_used} />
          </div>
        )}
      </section>
    </div>
  );
}
