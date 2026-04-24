import SearchBar from "../../SearchBar";
import IndexPill from "./IndexPill";
import { useMarketStore } from "../../../stores/useMarketStore";

// Pages constant
const PAGES = ["MARKET", "CHART", "PORTFOLIO", "SCREENER", "ALERTS", "HEATMAP"];

export default function Topbar({ wsStatus, currentTime, activePage, onPageChange, onSearchSelect }) {
  return (
    <div className="topbar">
      <div className="logo">
        IDX<span>TERMINAL</span>
      </div>
      <IndexPill label="IHSG" data={null} /> {/* IHSG is fetched inside IndexPill or we could pass from parent */}
      <div className="market-status">
        <div className={`dot-pulse${wsStatus === "connected" ? "" : " offline"}`} />
        <span>{wsStatus === "connected" ? "LIVE" : wsStatus.toUpperCase()}</span>
        <span style={{ color: "#2a4060" }}>·</span>
        <span>{currentTime.toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        <span style={{ color: "#2a4060" }}>WIB</span>
      </div>
      <SearchBar onSelect={onSearchSelect} />
      <div className="nav-tabs">
        {PAGES.map((p) => (
          <button
            key={p}
            className={`nav-tab${activePage === p ? " active" : ""}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}