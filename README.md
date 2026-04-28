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
├── backend/                  # FastAPI (API + WS + DB)
│   ├── main.py
│   ├── routers/              # auth, market, portfolio, alerts
│   ├── services/             # business logic (auth, data, ws)
│   ├── models/               # SQLAlchemy models
│   └── db/                   # database setup
│
├── src/                      # React frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── IDXTerminal/      # core dashboard (UI + logic)
│   │   ├── chart/
│   │   ├── portfolio/
│   │   ├── market/
│   │   ├── alerts/
│   │   └── auth/
│   ├── stores/               # Zustand state
│   ├── lib/                  # API + WebSocket client
│   └── hooks/
│
├── src-tauri/                # Desktop shell (Tauri)
├── scripts/                  # utilities (migration, etc)
├── tests/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tsconfig.node.json
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
