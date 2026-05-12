# IDX Terminal

Bloomberg-style trading dashboard untuk pasar saham Indonesia (IDX).
Built with Tauri + React/TypeScript + Python FastAPI.

## Tech Stack

| Layer        | Tech                              |
|--------------|--------------|
| Desktop Shell| Tauri 2.x (Rust)                  |
| Frontend     | React 18 + TypeScript + Vite      |
| Shell Layout | CSS Grid (3-Column Architecture)  |
| Styling      | Tailwind CSS                      |
| State        | Zustand                           |
| Charts       | lightweight-charts (TradingView)  |
| Backend      | Python FastAPI (sidecar)          |
| Database     | SQLite via SQLAlchemy             |
| Data IDX     | idx.co.id API + yfinance          |
| Real-time    | WebSocket (MsgPack Serialization) |

## Key Features

- **Professional App Shell**: Stable 3-column layout (Sidebar, Main, Execution Panel).
- **Interactive Portfolio**: Real-time holdings tracking with P&L heat highlighting and column toggles.
- **Advanced Performance Analytics**:
  - Cumulative P&L Equity Curve with rolling period support (Day, Week, Month).
  - Win Rate tracking and asset-level performance breakdown.
  - Interactive data series with tooltip drill-downs.
- **Automated Orders**: Take Profit (TP) and Stop Loss (SL) triggers with backend monitoring.
- **Real-time Feed**: Pinned bottom ticker for live market updates.

## Project Structure

```
idx-terminal/
├── backend/                  # FastAPI (API + WS + DB)
│   ├── main.py               # Entry point
│   ├── routers/              # auth, market, portfolio, alerts
│   ├── services/             # business logic (portfolio_service, data_fetcher)
│   └── models/               # SQLAlchemy models
├── src/                      # React frontend
│   ├── features/dashboard/   # Core app shell and dashboard pages
│   ├── components/           # Shared components (charts, trade dialogs)
│   └── stores/               # Zustand (usePortfolioStore, useMarketStore)
└── src-tauri/                # Desktop shell (Rust)
```

## Setup

```bash
# Install deps
npm install
cd backend && pip install -r requirements.txt && cd ..

# Dev mode
npm run tauri dev
```

## Development Status

- ✅ **Fase 1**: Foundation — Tauri, Auth, Layout Architecture.
- ✅ **Fase 2**: Data Layer — WebSocket snapshots, IDX integration.
- ✅ **Fase 3**: Core Trading — Watchlist management, Portfolio tracking.
- ✅ **Fase 4**: Visualization — High-fidelity charts, Performance polishing.
- 🚧 **Fase 5 (Active)**: Documentation & UX Stabilization.
