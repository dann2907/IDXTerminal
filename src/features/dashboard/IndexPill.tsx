import { memo } from "react";
import type { QuoteData } from "../../stores/useMarketStore";

interface IndexPillProps {
  label: string;
  data: QuoteData | null;
}

const IndexPill = memo(function IndexPill({ label, data }: IndexPillProps) {
  return (
    <div className="ihsg-pill">
      <span className="ihsg-label">{label}</span>
      <span className="ihsg-val">{data ? data.price.toLocaleString("id") : "-"}</span>
      {data ? (
        <span className={`ihsg-ch ${data.change_pct >= 0 ? "up" : "dn"}`}>
          <span aria-hidden="true">{data.change_pct >= 0 ? "^" : "v"}</span>
          {" "}{Math.abs(data.change_pct).toFixed(2)}%
        </span>
      ) : null}
    </div>
  );
});

export default IndexPill;
