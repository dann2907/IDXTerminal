import { QuoteData } from "../../../types";

interface PrevQuotes {
  [ticker: string]: QuoteData;
}

interface FlashMap {
  [ticker: string]: "up" | "dn";
}

import { useRef, useState, useEffect } from "react";

export function useFlashQuotes(quotes: Record<string, QuoteData>) {
  const prevRef = useRef<PrevQuotes>({});
  const [flashes, setFlashes] = useState<FlashMap>({});

  useEffect(() => {
    const newFlashes: FlashMap = {};
    for (const ticker in quotes) {
      const q = quotes[ticker];
      const prev = prevRef.current[ticker];
      if (prev && q.price !== prev.price) {
        newFlashes[ticker] = q.price > prev.price ? "up" : "dn";
      }
    }

    if (Object.keys(newFlashes).length > 0) {
      setFlashes((prev) => ({ ...prev, ...newFlashes }));
      setTimeout(() => {
        setFlashes((prev) => {
          const updated = { ...prev };
          for (const t in newFlashes) delete updated[t];
          return updated;
        });
      }, 600);
    }

    prevRef.current = { ...quotes };
  }, [quotes]);

  return flashes;
}
