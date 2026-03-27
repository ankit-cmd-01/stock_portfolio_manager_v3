import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768) {
  const getValue = () => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.innerWidth < breakpoint;
  };

  const [isMobile, setIsMobile] = useState(getValue);

  useEffect(() => {
    const handleResize = () => setIsMobile(getValue());
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isMobile;
}
