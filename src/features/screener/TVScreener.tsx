import { useEffect, useRef, memo } from "react";
import { C } from "./constants/tokens";

interface TVScreenerProps {
  colorTheme?: "dark" | "light";
}

/**
 * TVScreener Component
 * 
 * Embeds the TradingView Stock Screener widget.
 * Note: Data for IDX is delayed by 15 minutes.
 * Future Presets (Manual Configuration in Widget):
 * - BSJP (Beli Sore Jual Pagi): Filter for late-day strength/volume spikes.
 * - BPJS (Beli Pagi Jual Sore): Filter for gap-ups and early momentum.
 * - SWING: Filter for trend alignment (EMA/SMA crosses).
 */
const TVScreener = memo(({ colorTheme = "dark" }: TVScreenerProps) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    // Clear previous widget
    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-screener.js";
    script.type = "text/javascript";
    script.async = true;
    
    // Config logic: Indonesia market, localized to IDX.
    // Users can manually save their "BSJP/BPJS" templates using the widget's built-in Save feature.
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: "100%",
      defaultColumn: "overview",
      defaultScreen: "most_capitalized",
      market: "indonesia",
      showToolbar: true,
      colorTheme: colorTheme,
      locale: "en",
      isTransparent: false,
    });

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";
    
    const widgetSubContainer = document.createElement("div");
    widgetSubContainer.className = "tradingview-widget-container__widget";
    widgetSubContainer.style.height = "100%";
    widgetSubContainer.style.width = "100%";
    
    widgetContainer.appendChild(widgetSubContainer);
    widgetContainer.appendChild(script);
    
    container.current.appendChild(widgetContainer);

    return () => {
      if (container.current) {
        container.current.innerHTML = "";
      }
    };
  }, [colorTheme]);

  return (
    <div 
      ref={container} 
      className="tv-screener-wrapper"
      style={{ width: "100%", height: "100%", background: C.bg }}
    />
  );
});

export default TVScreener;
