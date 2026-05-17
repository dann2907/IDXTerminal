# IDXTerminal Project Reorganization Guide

## Problem Summary

Your project structure has 3 main issues:
1. **Root clutter** — docs/data/scripts mixed with config files
2. **Duplicate utilities** — 2+ formatter/indicator files doing same job
3. **Inconsistent organization** — some features in `components/market/`, some in `features/dashboard/`

## Solution: 3-Phase Reorganization

---

## Phase 1: Clean Root (AUTOMATED, SAFE)

**What it does:** Moves loose files into organizational folders

```bash
chmod +x reorganize-project.sh
./reorganize-project.sh
```

**Changes:**
```
screener-refactor-plan.md      → docs/
screenertableredesign.md       → docs/
portfolio_data.json            → data/
test.py                        → scripts/
```

**Risk:** LOW — Only moves files, no code changes

---

## Phase 2: Consolidate Shared Code (MANUAL)

**Goal:** Single source of truth for formatters, indicators, utils

### Step 2.1: Merge Formatters

You have formatters in 2 places:
- `src/features/dashboard/helpers/formatters.ts`
- `src/components/market/screener/utils/formatters.ts`

**Action:**
```bash
# Create merged file
cat src/features/dashboard/helpers/formatters.ts > src/lib/formatters.ts
echo "\n// From screener utils:\n" >> src/lib/formatters.ts
cat src/components/market/screener/utils/formatters.ts >> src/lib/formatters.ts

# Review for duplicate function names
code src/lib/formatters.ts
```

**Then:** Remove duplicate functions, keep best implementation

### Step 2.2: Consolidate Indicators

Currently scattered:
- `src/lib/indicators.ts` (already exists)
- `src/features/dashboard/helpers/indicators.ts`
- `src/hooks/useIndicators.ts`

**Action:**
```bash
# Merge helper into lib
cat src/features/dashboard/helpers/indicators.ts >> src/lib/indicators.ts

# Keep useIndicators hook as wrapper around lib/indicators
# Review and dedupe src/lib/indicators.ts
```

---

## Phase 3: Reorganize Features (MANUAL, HIGH IMPACT)

### Target Structure

```
src/
  features/
    screener/          ← Everything screener-related
    portfolio/         ← Orders, performance, trade history
    chart/             ← All chart types
    alerts/            ← Alert panel
    dashboard/
      layout/          ← ONLY layout components
        Topbar.tsx
        SidebarWatchlist.tsx
        FeedBar.tsx
        RightPanel.tsx
      IDXTerminal.tsx  ← Main container
  shared/
    ui/                ← Generic reusable UI
  lib/                 ← Shared utilities (formatters, api, ws)
  hooks/               ← Global hooks only
  stores/              ← Zustand stores
  types/               ← TypeScript types
```

### Step 3.1: Move Screener

```bash
# Move entire screener module
mv src/components/market/screener src/features/screener

# Update imports in all files
grep -r "from.*components/market/screener" src/ --include="*.tsx" --include="*.ts"
# Replace with: from '@/features/screener'
```

### Step 3.2: Move Portfolio

```bash
mv src/components/portfolio src/features/portfolio

# Update imports
# from '@/components/portfolio' → from '@/features/portfolio'
```

### Step 3.3: Move Chart

```bash
mkdir -p src/features/chart
mv src/components/chart/* src/features/chart/
mv src/components/LWChart.tsx src/features/chart/

# Update imports
```

### Step 3.4: Move Alerts

```bash
mv src/components/alerts src/features/alerts

# Update imports
```

### Step 3.5: Reorganize Dashboard

Dashboard currently mixes layout + pages. Split them:

```bash
# Keep layout components in dashboard
mkdir -p src/features/dashboard/layout
mv src/features/dashboard/Topbar.tsx src/features/dashboard/layout/
mv src/features/dashboard/SidebarWatchlist.tsx src/features/dashboard/layout/
mv src/features/dashboard/FeedBar.tsx src/features/dashboard/layout/
mv src/features/dashboard/RightPanel.tsx src/features/dashboard/layout/

# Pages can stay in dashboard OR move to feature folders:
# Option A: Keep MarketPage.tsx in dashboard (it's a container)
# Option B: Move to features/screener/MarketPage.tsx (if it's screener-specific)
```

### Step 3.6: Move Generic UI to Shared

```bash
mkdir -p src/shared/ui
mv src/components/SearchBar.tsx src/shared/ui/
mv src/components/TradeConfirmDialog.tsx src/shared/ui/
mv src/components/OrderTriggeredDialog.tsx src/shared/ui/

# Update imports to: from '@/shared/ui/SearchBar'
```

---

## Phase 4: Update Imports (SEMI-AUTOMATED)

### Option A: Use Provided Script

```bash
chmod +x update-imports.sh
./update-imports.sh
```

This updates common patterns automatically.

### Option B: Manual Find & Replace in VS Code

1. Open Find in Files (Ctrl+Shift+F)
2. Enable regex mode
3. Find/Replace patterns:

**Pattern 1: Screener imports**
```
Find:    from ['"].*components/market/screener
Replace: from '@/features/screener
```

**Pattern 2: Formatter imports**
```
Find:    from ['"].*features/dashboard/helpers/formatters
Replace: from '@/lib/formatters
```

**Pattern 3: Indicator imports**
```
Find:    from ['"].*features/dashboard/helpers/indicators
Replace: from '@/lib/indicators
```

**Pattern 4: Portfolio imports**
```
Find:    from ['"].*components/portfolio
Replace: from '@/features/portfolio
```

---

## Phase 5: Cleanup (SAFE TO RUN AFTER VERIFICATION)

```bash
# Delete empty old folders
rm -rf src/components/market
rm -rf src/features/dashboard/helpers

# Delete formatter duplicates
rm src/features/dashboard/helpers/formatters.ts  # if still exists
rm src/components/market/screener/utils/formatters.ts  # if exists

# Verify no broken imports
npm run build
```

---

## Verification Checklist

After each phase:

- [ ] **Phase 1**: Root is clean, docs/data/scripts folders exist
- [ ] **Phase 2**: `src/lib/formatters.ts` has all functions, no duplicates
- [ ] **Phase 3**: All features in `src/features/`, generic UI in `src/shared/ui/`
- [ ] **Phase 4**: No import errors in IDE
- [ ] **Phase 5**: `npm run build` succeeds, no warnings

### Final Test

```bash
# Build succeeds
npm run build

# Dev server runs
npm run dev

# Navigate through app:
# - Open screener page ✓
# - View portfolio ✓
# - Open chart ✓
# - Create alert ✓
```

---

## Rollback Plan

If something breaks:

```bash
# Git stash changes
git stash

# Or revert specific files
git checkout HEAD -- src/path/to/broken/file.tsx
```

**Best practice:** Do one phase at a time, commit after each successful verification.

---

## Optional: Flatten Store Filenames

Current:
```
stores/useMarketStore.ts    → export const useMarketStore
stores/useScreenerStore.ts  → export const useScreenerStore
```

Cleaner:
```
stores/market.ts     → export const useMarketStore
stores/screener.ts   → export const useScreenerStore
```

**Why:** Filename doesn't need "use" prefix since export already has it.

**How:**
```bash
cd src/stores
mv useMarketStore.ts market.ts
mv useScreenerStore.ts screener.ts
mv usePortfolioStore.ts portfolio.ts
mv useChartStore.ts chart.ts
mv useAlertStore.ts alerts.ts
mv useAuthStore.ts auth.ts

# Update imports:
# from '@/stores/useMarketStore' → from '@/stores/market'
```

---

## Timeline Estimate

- **Phase 1 (automated):** 2 minutes
- **Phase 2 (merge utils):** 15-30 minutes
- **Phase 3 (move features):** 30-45 minutes
- **Phase 4 (update imports):** 15-30 minutes
- **Phase 5 (cleanup):** 5 minutes
- **Verification:** 10-15 minutes

**Total:** ~2 hours for full reorganization

---

## Questions?

**Q: Will this break my app?**
A: Not if you update imports correctly. Do one feature at a time, verify build after each.

**Q: Can I skip phases?**
A: Yes. Phase 1 is independent. Phases 2-5 can be done in any order, but imports must be updated together with moves.

**Q: What if I have uncommitted changes?**
A: Stash them first: `git stash`, do reorganization, then `git stash pop`

**Q: Should I delete old folders immediately?**
A: No. Keep them until build succeeds, then delete in Phase 5.
