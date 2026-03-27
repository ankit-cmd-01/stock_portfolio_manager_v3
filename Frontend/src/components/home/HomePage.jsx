import { ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import FeatureBentoGrid from "./FeatureBentoGrid";
import Hero3D from "./Hero3D";
import HowItWorks3D from "./HowItWorks3D";
import SectionReveal from "./SectionReveal";
import StatsBar from "./StatsBar";
import TechStackBadges from "./TechStackBadges";
import ValuePropCards from "./ValuePropCards";

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#0a0f1e_0%,#09111e_38%,#0b1221_100%)]">
      <Hero3D />
      <HowItWorks3D />
      <FeatureBentoGrid />
      <ValuePropCards />
      <TechStackBadges />
      <StatsBar />

      <SectionReveal className="mx-auto max-w-[100rem] px-4 pb-16 pt-4 lg:px-8">
        <div className="rounded-[2rem] border border-white/5 bg-surface px-6 py-8 lg:px-8 lg:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-primary">Ready to explore</p>
              <h3 className="mt-4 font-display text-4xl text-text">Launch the terminal and start building signal-aware portfolios.</h3>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                Everything on this page reflects the current product context: multi-basket portfolios, metals analytics,
                chart-first stock views, and AI-assisted investor workflows.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-panel bg-primary px-5 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-cyan">
                Get started
                <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-panel border border-border px-5 py-3 text-sm font-semibold text-text transition hover:border-primary/40">
                Open workspace
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </SectionReveal>
    </div>
  );
}
