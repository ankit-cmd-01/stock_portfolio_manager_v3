import { Sparkles } from "lucide-react";

export default function AIInsightPanel() {
  return (
    <section className="panel-elevated border-primary/20 p-5 shadow-cyan">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">AI Signal</p>
            <h3 className="font-display text-2xl text-text">BETA Insight</h3>
          </div>
        </div>
        <span className="rounded-chip border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-widest text-primary">
          Beta
        </span>
      </div>

      <p className="mt-5 text-sm leading-7 text-muted">
        PE is trending above its 30-day average while price remains above the
        short-term support band. Possible overvaluation pressure is building.
        Consider monitoring the next two weeks for confirmation.
      </p>

      <button
        type="button"
        disabled
        title="AI analysis coming soon"
        className="mt-5 rounded-panel border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-muted disabled:cursor-not-allowed"
      >
        Generate Fresh Insight
      </button>
    </section>
  );
}
