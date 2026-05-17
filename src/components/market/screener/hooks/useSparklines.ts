import { useRef, useEffect } from "react";
import type { QuoteData } from "../../../../stores/useMarketStore";

export function useSparklines(quotes: Record<string, QuoteData>) {
  const sparkRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    Object.keys(quotes).forEach(ticker => {
      const q = quotes[ticker];
      if (!q) return;
      if (!sparkRef.current[ticker]) sparkRef.current[ticker] = [];
      const history = sparkRef.current[ticker];
      if (history.length === 0 || history[history.length - 1] !== q.price) {
        history.push(q.price);
        if (history.length > 30) history.shift();
      }
    });
  }, [quotes]);

  return sparkRef;
}
