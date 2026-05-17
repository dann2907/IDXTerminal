import { memo } from "react";
import { C, ALL_COLUMNS } from "./constants/tokens";
import type { SortKey, Direction } from "./hooks/useScreenerData";

interface Props {
  visibleCols: string[];
  sort: { key: SortKey; dir: Direction };
  onSort: (key: SortKey) => void;
}

const ScreenerTableHeader = memo(function ScreenerTableHeader({ visibleCols, sort, onSort }: Props) {
  return (
    <thead style={{ position: "sticky", top: 0, zIndex: 10, background: C.surface, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
      <tr>
        <th onClick={() => onSort("ticker")}
          style={{
            padding: "12px 16px", textAlign: "left",
            fontFamily: "'Syne',sans-serif", fontSize: 11, letterSpacing: 1,
            color: sort.key === "ticker" ? C.accent : C.label,
            fontWeight: 700, whiteSpace: "nowrap",
            cursor: "pointer",
            borderBottom: `2px solid ${C.border}`,
            width: 110, minWidth: 110,
            userSelect: "none",
            textTransform: "uppercase"
          }}>
          Symbol
          {sort.key === "ticker" && <span style={{ marginLeft: 6 }}>{sort.dir === "asc" ? "▲" : "▼"}</span>}
        </th>

        {ALL_COLUMNS.filter(c => visibleCols.includes(c.id)).map(col => (
          <th key={col.id}
            onClick={() => onSort(col.id as SortKey)}
            style={{
              padding: "12px 16px", textAlign: col.align as any,
              fontFamily: "'Syne',sans-serif", fontSize: 11, letterSpacing: 1,
              color: sort.key === col.id ? C.accent : C.label,
              fontWeight: 700, whiteSpace: "nowrap",
              cursor: "pointer",
              borderBottom: `2px solid ${C.border}`,
              width: col.w, minWidth: col.w,
              userSelect: "none",
              textTransform: "uppercase"
            }}>
            {col.label}
            {sort.key === col.id && <span style={{ marginLeft: 6 }}>{sort.dir === "asc" ? "▲" : "▼"}</span>}
          </th>
        ))}

        <th style={{
          padding: "12px 16px", textAlign: "center",
          fontFamily: "'Syne',sans-serif", fontSize: 11, letterSpacing: 1,
          color: C.label,
          fontWeight: 700, whiteSpace: "nowrap",
          borderBottom: `2px solid ${C.border}`,
          width: 50, minWidth: 50,
          userSelect: "none",
          textTransform: "uppercase"
        }}>
          Action
        </th>
      </tr>
    </thead>
  );
});

export default ScreenerTableHeader;
