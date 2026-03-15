# IDX Terminal

Bloomberg-style trading dashboard untuk pasar saham Indonesia (IDX).
Built with Tauri + React/TypeScript + Python FastAPI.

## Tech Stack

| Layer        | Tech                              |
|--------------|-----------------------------------|
| Desktop Shell| Tauri 2.x (Rust)                 |
| Frontend     | React 18 + TypeScript + Vite      |
| Styling      | Tailwind CSS + custom CSS vars    |
| State        | Zustand                           |
| Charts       | lightweight-charts (TradingView)  |
| Backend      | Python FastAPI (sidecar)          |
| Database     | SQLite via SQLAlchemy             |
| Data IDX     | idx.co.id API + yfinance          |
| Real-time    | WebSocket (FastAPI)               |
| Auth         | JWT + bcrypt (lokal)             |

## Project Structure

```
idx-terminal/
├── src/                          # React frontend
│   ├── components/
│   │   ├── chart/                # Candlestick, indicators
│   │   ├── market/               # Overview, heatmap, screener
│   │   ├── portfolio/            # Holdings, orders, history
│   │   ├── alerts/               # Price alerts
│   │   ├── auth/                 # Login, register
│   │   └── shared/               # Button, Modal, Skeleton
│   ├── pages/
│   ├── hooks/
│   ├── stores/
│   │   ├── useMarketStore.ts
│   │   ├── usePortfolioStore.ts
│   │   └── useAuthStore.ts
│   ├── lib/
│   │   ├── api.ts                # Axios → FastAPI
│   │   ├── ws.ts                 # WebSocket client
│   │   └── formatters.ts
│   └── types/index.ts
│
├── src-tauri/                    # Tauri (Rust)
│   ├── src/main.rs
│   └── tauri.conf.json
│
├── backend/                      # Python FastAPI sidecar
│   ├── main.py
│   ├── routers/
│   │   ├── market.py
│   │   ├── portfolio.py
│   │   ├── auth.py
│   │   └── alerts.py
│   ├── services/
│   │   ├── data_fetcher.py       
│   │   ├── portfolio_service.py  
│   │   ├── alert_service.py
│   │   └── ws_broadcaster.py
│   ├── models/
│   ├── db/
│   └── requirements.txt
│
└── package.json
```

## Setup

```bash
# Install deps
npm install
cd backend && pip install -r requirements.txt && cd ..

# Dev mode
npm run tauri dev
```

## Fase Development

- Fase 1 (M1-2): Foundation — Tauri setup, auth, SQLite, layout
- Fase 2 (M3-4): Data Layer — WebSocket, IDX API, yfinance
- Fase 3 (M5-6): Core Trading — Portfolio, alerts, watchlist
- Fase 4 (M7-8): Visualization — Charts, heatmap, screener
- Fase 5 (M9-10): Polish — PDF/Excel export, animations, installer
