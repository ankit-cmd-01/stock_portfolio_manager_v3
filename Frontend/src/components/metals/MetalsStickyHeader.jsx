import { useContext } from "react";
import { useNavigate } from "react-router-dom";

import { MetalsContext } from "../../context/MetalsContext";
import SyncStatusBar from "./SyncStatusBar";

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "gold", label: "Gold" },
  { key: "silver", label: "Silver" },
];

export default function MetalsStickyHeader({ activeTab = "overview", metal = null }) {
  const navigate = useNavigate();
  const { setSelectedMetal } = useContext(MetalsContext);

  const handleTabClick = (tab) => {
    if (tab.key === "overview") {
      setSelectedMetal("overview");
      navigate("/metals");
      return;
    }

    setSelectedMetal(tab.key);
    navigate(`/metals/${tab.key}`);
  };

  return (
    <div className="sticky top-4 z-20 space-y-4 lg:top-6">
      <div className="rounded-[28px] border border-border/80 bg-base/95 p-3 shadow-[0_18px_40px_rgba(2,8,23,0.35)] backdrop-blur">
        <SyncStatusBar metal={metal} />

        <section className="mt-4 panel p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabClick(tab)}
                  className={`rounded-panel px-4 py-3 text-sm font-semibold transition ${
                    active ? "bg-primary text-slate-950 shadow-cyan" : "bg-white/5 text-muted hover:text-text"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
