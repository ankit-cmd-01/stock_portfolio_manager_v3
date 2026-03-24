import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import MetalsOverview from "../components/metals/MetalsOverview";
import SyncStatusBar from "../components/metals/SyncStatusBar";
import { MetalsContext } from "../context/MetalsContext";

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "gold", label: "Gold" },
  { key: "silver", label: "Silver" },
];

export default function MetalsPage() {
  const navigate = useNavigate();
  const { selectedMetal, setSelectedMetal } = useContext(MetalsContext);

  useEffect(() => {
    setSelectedMetal("overview");
  }, [setSelectedMetal]);

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
    <div className="space-y-6">
      <SyncStatusBar />

      <section className="panel p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {tabs.map((tab) => {
            const active = selectedMetal === tab.key;
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

      <MetalsOverview />
    </div>
  );
}
