import { fmtPrice, fmtPct } from "../helpers/formatters";

export default function FeedBar({ quotes }) {
  return (
    <div className="feed-bar">
      <div className="feed-label">LIVE FEED</div>
      <div className="ticker-tape">
        {Object.values(quotes)
          .slice(0, 12)
          .map((q) => (
            <div key={q.ticker} className="tape-item">
              <span className="tape-sym">{q.ticker.replace(".JK", "")}</span>
              <span style={{ color: "#c8d8f0" }}>{fmtPrice(q.price)}</span>
              <span className={q.change_pct >= 0 ? "up" : "dn"}>{fmtPct(q.change_pct)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}