import { useEffect, useState } from "react";
import ScrollIndicator from "./ScrollIndicator";

const heroStats = [
  { label: "Live watchlists", value: "120+" },
  { label: "Signals processed", value: "3.2M" },
  { label: "Avg. execution", value: "89 ms" },
];

const performanceItems = [
  { label: "NIFTY 50", value: "+2.84%", positive: true },
  { label: "Portfolio Value", value: "Rs 12.8L", positive: true },
  { label: "Risk Alert", value: "Low", positive: true },
];

const summaryItems = [
  { label: "Portfolio P&L", value: "+Rs 18,640" },
  { label: "Win rate", value: "68.4%" },
];

const heroTrustItems = [
  "Realtime market tracking",
  "Institutional-grade signals",
  "Clean portfolio visibility",
];

const heroValues = ["Trade", "Invest", "Level Up"];

const Hero = () => {
  const [activeValueIndex, setActiveValueIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveValueIndex((currentIndex) => (currentIndex + 1) % heroValues.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className="hero" id="home">
      <p className="hero__tag fade-in-up">Fintech intelligence for modern investors</p>

      <div className="hero__content">
        <div className="hero__copy fade-in-up">
          <div className="hero__headline">
            <h1 className="hero__headline-title">Built for those who are</h1>

            <div className="hero__headline-accent">
              <span className="hero__headline-prefix">Born to</span>
              <span className="hero__value-window">
                <span className="hero__value-sizer">Level Up</span>
                <span key={heroValues[activeValueIndex]} className="hero__value-swap">
                  {heroValues[activeValueIndex]}
                </span>
              </span>
            </div>
          </div>

          <p className="hero__description">
            A sharper stock analysis experience for users who want trusted
            signals, disciplined market context, and portfolio insights that
            feel immediate.
          </p>

          <div className="hero__actions">
            <button className="hero__button hero__button--primary" type="button">
              Explore Platform
            </button>
            <button className="hero__button hero__button--secondary" type="button">
              Watch Demo
            </button>
          </div>

          <div className="hero__trust" aria-label="Platform highlights">
            {heroTrustItems.map((item) => (
              <span className="hero__trust-pill" key={item}>
                {item}
              </span>
            ))}
          </div>

          <div className="hero__stats">
            {heroStats.map((item) => (
              <div className="stat-card" key={item.label}>
                <span className="stat-card__label">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="hero__visual fade-in-up fade-in-up--delayed">
          <div className="visual-card">
            <div className="visual-card__header">
              <div>
                <p className="visual-card__label">Market overview</p>
                <h2>Sensex Trend</h2>
              </div>
              <div className="visual-card__pill">Realtime</div>
            </div>

            <div className="visual-card__summary">
              {summaryItems.map((item) => (
                <div className="summary-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="chart">
              <div className="chart__grid" />
              <div className="chart__area chart__area--primary" />
              <div className="chart__area chart__area--secondary" />
              <div className="chart__line" />
              <div className="chart__glow" />
              <div className="chart__tooltip">
                <span>Today</span>
                <strong>+1.86%</strong>
              </div>
            </div>

            <div className="visual-card__footer">
              {performanceItems.map((item) => (
                <div className="performance-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong className={item.positive ? "is-positive" : ""}>
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hero__scroll fade-in-up fade-in-up--delayed">
        <ScrollIndicator />
      </div>
    </section>
  );
};

export default Hero;
