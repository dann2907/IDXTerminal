# IDXTerminal Reorganization Plan

## Objective
Reorganize the project structure to address root clutter, duplicate utilities, and inconsistent feature organization according to the `REORGANIZATION_GUIDE.md`, executing step-by-step for safety.

## Scope & Impact
- **Root Files**: Move loose docs, data, and scripts to dedicated folders (`docs/`, `data/`, `scripts/`).
- **Utilities**: Consolidate formatters and indicators into `src/lib/`.
- **Features**: Group feature-specific components, hooks, and utils into domain folders under `src/features/` (e.g., `screener`, `portfolio`, `chart`, `alerts`).
- **UI**: Extract generic reusable UI to `src/shared/ui/`.
- **Dashboard**: Retain only layout components in `src/features/dashboard/layout/` and move pages.
- **Stores**: Flatten Zustand store filenames (optional but recommended).

## Proposed Solution & Implementation Plan
We will execute this step-by-step, pausing for verification after each phase.

### Phase 1: Clean Root
- Create directories: `docs/`, `data/`, `scripts/`.
- Move `screener-refactor-plan.md`, `screenertableredesign.md` to `docs/`.
- Move `portfolio_data.json` to `data/`.
- Move `test.py` to `scripts/`.

### Phase 2: Consolidate Shared Utilities
- **2.1 Merging Formatters**: Read `src/features/dashboard/helpers/formatters.ts` and `src/components/market/screener/utils/formatters.ts`. Merge non-duplicate functions into `src/lib/formatters.ts`. Update dependent imports.
- **2.2 Consolidating Indicators**: Ensure `src/lib/indicators.ts` contains all necessary logic from `src/features/dashboard/helpers/indicators.ts` and remove duplicates.

### Phase 3: Reorganize Feature Structure & Phase 4: Update Imports
*Executed iteratively per feature to ensure safety.*
- **3.1 Screener**: Move `src/components/market/screener` to `src/features/screener`. Update relative imports.
- **3.2 Portfolio**: Move `src/components/portfolio` to `src/features/portfolio`. Update relative imports.
- **3.3 Chart**: Move `src/components/chart/*` and `src/components/LWChart.tsx` to `src/features/chart`. Update relative imports.
- **3.4 Alerts**: Move `src/components/alerts` to `src/features/alerts`. Update relative imports.
- **3.5 Dashboard & Pages**: Move layout components to `src/features/dashboard/layout/`. Move pages (`MarketPage.tsx`, `PortfolioPage.tsx`, etc.) to appropriate feature directories. Update imports.
- **3.6 Shared UI**: Move generic components (`SearchBar`, `TradeConfirmDialog`, `OrderTriggeredDialog`) to `src/shared/ui/`. Update imports.

### Phase 5: Cleanup & Stores
- **5.1 Stores**: Flatten store filenames (e.g., `useMarketStore.ts` -> `market.ts`). Update imports.
- **5.2 Cleanup**: Delete empty legacy folders (`src/components/market`, `src/features/dashboard/helpers`, etc.).

## Verification & Testing
- After each sub-phase, we will run `npm run build` or `npx tsc --noEmit` to verify that imports and types are valid.
- Visually verify changes in IDE or CLI.

## Rollback Plan

- Use `git restore` or `git checkout HEAD` to revert uncommitted changes if a phase breaks the build in a way that is difficult to fix quickly. All changes will be staged logically.
