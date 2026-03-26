import { useContext, useEffect } from "react";

import MetalsOverview from "../components/metals/MetalsOverview";
import MetalsStickyHeader from "../components/metals/MetalsStickyHeader";
import { MetalsContext } from "../context/MetalsContext";

export default function MetalsPage() {
  const { setSelectedMetal } = useContext(MetalsContext);

  useEffect(() => {
    setSelectedMetal("overview");
  }, [setSelectedMetal]);

  return (
    <div className="space-y-6">
      <MetalsStickyHeader activeTab="overview" />

      <MetalsOverview />
    </div>
  );
}
