import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PresetType = 
  | "all" 
  | "top_gainer" 
  | "top_loser" 
  | "breakout" 
  | "high_vol" 
  | "near_ath" 
  | "oversold" 
  | "value" 
  | "dividend";

export interface ScreenerFilters {
  search: string;
  minChg: string;
  maxChg: string;
  minVol: string;
  minPrice: string;
  maxPrice: string;
  liveOnly: boolean;
  sector: string;
  minPE: string;
  maxPE: string;
  minPBV: string;
  maxPBV: string;
  groupBySector: boolean;
  visibleColumns: string[];
}

interface ScreenerState {
  activePreset: PresetType;
  filters: ScreenerFilters;
  savedFilters: Record<string, ScreenerFilters>;
  
  setPreset: (preset: PresetType) => void;
  setFilter: <K extends keyof ScreenerFilters>(key: K, value: ScreenerFilters[K]) => void;
  toggleGroupBySector: () => void;
  toggleColumn: (column: string) => void;
  resetFilters: () => void;
  saveCurrentFilter: (name: string) => void;
  loadSavedFilter: (name: string) => void;
}

const DEFAULT_COLUMNS = ["price", "sparkline", "change_pct", "volume", "range", "rvol", "signals", "market_cap"];

const DEFAULT_FILTERS: ScreenerFilters = {
  search: "",
  minChg: "",
  maxChg: "",
  minVol: "",
  minPrice: "",
  maxPrice: "",
  liveOnly: false,
  sector: "All",
  minPE: "",
  maxPE: "",
  minPBV: "",
  maxPBV: "",
  groupBySector: false,
  visibleColumns: [...DEFAULT_COLUMNS],
};

export const useScreenerStore = create<ScreenerState>()(
  persist(
    (set) => ({
      activePreset: "all",
      filters: { ...DEFAULT_FILTERS },
      savedFilters: {},

      setPreset: (preset) => {
        const newFilters = { ...DEFAULT_FILTERS };
        
        // Apply preset logic
        switch (preset) {
          case "top_gainer":
            newFilters.minChg = "3";
            newFilters.minVol = "1";
            break;
          case "top_loser":
            newFilters.maxChg = "-3";
            newFilters.minVol = "1";
            break;
          case "high_vol":
            newFilters.minVol = "10";
            break;
          case "breakout":
            newFilters.minChg = "2";
            newFilters.minVol = "5";
            break;
          case "near_ath":
            newFilters.minChg = "0";
            break;
          case "oversold":
            newFilters.maxChg = "-2";
            break;
          case "value":
            newFilters.maxPE = "15";
            newFilters.maxPBV = "1.5";
            newFilters.minVol = "0.5";
            newFilters.visibleColumns = [...DEFAULT_COLUMNS, "pe_ratio", "pbv_ratio"];
            break;
          case "dividend":
            newFilters.minVol = "0.1";
            newFilters.visibleColumns = [...DEFAULT_COLUMNS, "pe_ratio"];
            break;
        }

        set({ activePreset: preset, filters: newFilters });
      },

      setFilter: (key, value) => 
        set((state) => ({ 
          filters: { ...state.filters, [key]: value },
          activePreset: "all" // Custom filter breaks preset
        })),

      toggleGroupBySector: () =>
        set((state) => ({
          filters: { ...state.filters, groupBySector: !state.filters.groupBySector }
        })),

      toggleColumn: (column) =>
        set((state) => {
          const cols = state.filters.visibleColumns;
          const newCols = cols.includes(column)
            ? cols.filter(c => c !== column)
            : [...cols, column];
          return { filters: { ...state.filters, visibleColumns: newCols } };
        }),

      resetFilters: () => set({ activePreset: "all", filters: { ...DEFAULT_FILTERS, visibleColumns: [...DEFAULT_COLUMNS] } }),

      saveCurrentFilter: (name) => 
        set((state) => ({
          savedFilters: { ...state.savedFilters, [name]: { ...state.filters } }
        })),

      loadSavedFilter: (name) => 
        set((state) => ({
          filters: state.savedFilters[name] ? { ...state.savedFilters[name] } : state.filters,
          activePreset: "all"
        })),
    }),
    {
      name: "idx-screener-storage",
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Ensure new columns are present in existing user state
          if (persistedState.filters) {
            const current = persistedState.filters.visibleColumns || [];
            const essential = ["sparkline", "range", "rvol", "market_cap"];
            essential.forEach(col => {
              if (!current.includes(col)) current.push(col);
            });
            // Clean up obsolete IDs if any
            persistedState.filters.visibleColumns = current.filter((c: string) => c !== "high" && c !== "low");
          }
        }
        return persistedState;
      },
    }
  )
);
