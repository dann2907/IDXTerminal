import { memo, useState } from "react";
import SearchBar from "@/shared/ui/SearchBar";
import IndexPill from "./IndexPill";
import { Bell, Clock, Search, Settings, UserRound, Wifi, WifiOff } from "lucide-react";
import type { QuoteData } from "@/stores/market";

const PAGES = ["Market", "Chart", "Portfolio", "Screener", "Heatmap"];

interface TopbarProps {
  indexData: QuoteData | null;
  wsStatus: string;
  currentTime: Date;
  activePage: string;
  onPageChange: (page: string) => void;
  onSearchSelect: (ticker: string) => void;
}

type TopbarMenu = "settings" | "profile" | null;

const Topbar = memo(function Topbar({ indexData, wsStatus, currentTime, activePage, onPageChange, onSearchSelect }: TopbarProps) {
  const isConnected = wsStatus === "connected";
  const [openMenu, setOpenMenu] = useState<TopbarMenu>(null);

  const toggleMenu = (menu: Exclude<TopbarMenu, null>) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  return (
    <header className="h-16 flex items-center gap-6 px-6 bg-[#0A0F1B] border-b border-slate-800 shrink-0 z-50">
      {/* Logo */}
      <div className="flex items-baseline gap-1 min-w-[140px]" aria-label="IDX Terminal">
        <span className="text-xl font-black text-blue-500 tracking-tighter">IDX</span>
        <span className="text-lg font-extrabold text-white tracking-tight">TERMINAL</span>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-1" aria-label="Main Navigation">
        {PAGES.map((p) => (
          <button
            key={p}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              activePage === p.toUpperCase() 
                ? "bg-slate-800 text-white shadow-inner" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
            onClick={() => onPageChange(p.toUpperCase())}
            aria-current={activePage === p.toUpperCase() ? "page" : undefined}
          >
            {p}
          </button>
        ))}
      </nav>

      {/* Search Bar Fluid */}
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-md relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors z-10" />
          <SearchBar onSelect={onSearchSelect} />
        </div>
      </div>

      {/* Meta Stats */}
      <div className="flex items-center gap-4 ml-auto">
        <IndexPill label="IHSG" data={indexData} />
        
        <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-900/50 border border-slate-800 rounded-full">
          <div className="flex items-center gap-1.5">
            {isConnected ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-rose-400" />}
            <span className={`text-[10px] font-black uppercase tracking-widest ${isConnected ? "text-emerald-400" : "text-rose-400"}`}>
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
          <div className="w-px h-3 bg-slate-800" />
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock size={12} />
            <span className="text-[10px] font-mono font-bold tracking-tight">
              {currentTime.toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          className={`p-2 rounded-lg transition-colors ${
            activePage === "ALERTS" ? "bg-slate-800 text-blue-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
          }`}
          type="button"
          title="Buka alerts"
          onClick={() => {
            setOpenMenu(null);
            onPageChange("ALERTS");
          }}
        >
          <Bell size={18} />
        </button>

        <div className="relative">
          <button
            className={`p-2 rounded-lg transition-colors ${
              openMenu === "settings" ? "bg-slate-800 text-blue-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
            type="button"
            title="Pengaturan tampilan"
            onClick={() => toggleMenu("settings")}
          >
            <Settings size={18} />
          </button>
          {openMenu === "settings" && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-[#111827] border border-slate-800 rounded-xl shadow-2xl p-3 z-50">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Display Settings</h5>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked readOnly className="w-3 h-3 rounded border-slate-700 bg-slate-800 text-blue-500" />
                  <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-200 transition-colors">Compact View</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked readOnly className="w-3 h-3 rounded border-slate-700 bg-slate-800 text-blue-500" />
                  <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-200 transition-colors">Real-time Flash</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
              openMenu === "profile" ? "bg-blue-600 text-white shadow-lg" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
            type="button"
            title="Profil"
            onClick={() => toggleMenu("profile")}
          >
            <UserRound size={14} />
            <span>JD</span>
          </button>
          {openMenu === "profile" && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-[#111827] border border-slate-800 rounded-xl shadow-2xl p-4 z-50">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-black text-white">John Doe</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Demo Account</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

export default Topbar;
