import { fmtPct } from "../helpers/formatters";

export default function IndexPill({ label, data }) {
  return (
    <div className="ihsg-pill">
      <span className="ihsg-label">{label}</span>
      <span className="ihsg-val">{data ? data.price.toLocaleString("id") : "—"}</span>
      {data && (
        <span className={`ihsg-ch ${data.change_pct >= 0 ? "up" : "dn"}`}>
          {data.change_pct >= 0 ? "▲" : "▼"} {Math.abs(data.change_pct).toFixed(2)}%
        </span>
      )}
    </div>
  );
}