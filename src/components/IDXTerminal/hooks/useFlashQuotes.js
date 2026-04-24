import { useState, useEffect, useRef } from "react";

export function useFlashQuotes(quotes) {
  const [flashMap, setFlashMap] = useState({});
  const prevRef = useRef({});

  useEffect(() => {
    const flashes = {};
    for (const [ticker, q] of Object.entries(quotes)) {
      const prev = prevRef.current[ticker];
      if (prev && q.price !== prev.price) {
        flashes[ticker] = q.price > prev.price ? "up" : "dn";
      }
    }
    prevRef.current = quotes;
    if (Object.keys(flashes).length) {
      setFlashMap(flashes);
      const timer = setTimeout(() => setFlashMap({}), 700);
      return () => clearTimeout(timer);
    }
  }, [quotes]);

  return flashMap;
}