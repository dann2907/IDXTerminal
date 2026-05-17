# RFC: Screener.tsx Refactor

## Problem Statement

`Screener.tsx` has grown to 758 lines and now violates the single-responsibility principle across every dimension: data processing, business logic, UI presentation, and style definitions are all co-located. The developer experiences three compounding pain points:

1. **Navigation difficulty** — finding and changing anything requires scanning the entire file
2. **Performance risk** — `ScreenerRow` receives 11 props including unstable object references; `getSignals` and inline calculations run in render; no row virtualization for 500+ item lists
3. **Feature friction** — adding a new column, signal type, or filter requires touching render logic, type definitions, constants, and data processing all in one file

---

## Solution

Split `Screener.tsx` into a focused module tree where each file has one job. Extract all formatting, calculation, and signal logic into pure functions that can be tested in isolation. Slim the main orchestrator to wiring. Keep `ScreenerRow` as a display-only component that computes nothing.

Target directory structure:

```
screener/
  Screener.tsx              ← orchestrator only (~120 lines)
  ScreenerRow.tsx           ← display-only row component
  ScreenerFilters.tsx       ← preset bar + filter bar + column picker
  ScreenerTableHeader.tsx   ← sticky <thead> with sort indicators
  screener.css              ← hover/active CSS rules (remove <style> injection)
  hooks/
    useScreenerData.ts      ← all useMemo data transforms
    useSparklines.ts        ← sparkRef + tick accumulation effect
  utils/
    formatters.ts           ← fmt, fmtV, fmtRp, fmtPct, parseNum
    calculations.ts         ← rvol color, range pos, signal detection
  constants/
    tokens.ts               ← C color object + ALL_COLUMNS + shared style objects
```

---

## Commits

Each commit leaves the app fully working. Never break the build between steps.

### Commit 1 — Extract `tokens.ts`
Move the `C` color object, `ALL_COLUMNS`, `INPUT_STYLE`, `LABEL_STYLE`, and `RESET_BTN` to `constants/tokens.ts`. Update all imports in `Screener.tsx`. No behavior change. Verify visually that nothing changed.

### Commit 2 — Extract `formatters.ts`
Move `fmt`, `fmtV`, `fmtRp`, `fmtPct`, and `parseNum` to `utils/formatters.ts`. Import them back into `Screener.tsx`. No behavior change.

### Commit 3 — Extract `calculations.ts`
Move the following pure functions to `utils/calculations.ts`:
- `getVolColor(rvol)` — returns color string based on rvol thresholds
- `getRangePos(price, low, high)` — returns 0–100 percentage position
- `getSignal(q)` — returns `{ label, color } | null` signal for a quote

Remove `getSignals` from the component. Import and call from row. No behavior change.

### Commit 4 — Extract `screener.css`
Move the inline `<style>` block (screener-row hover, active, watchlist-btn rules) to a static `screener.css` file. Import it at the top of `Screener.tsx`. Remove the `<style>` JSX element. Verify hover/active states still work.

### Commit 5 — Extract `useSparklines.ts`
Move the `sparkRef` + `useEffect` that accumulates price history into `hooks/useSparklines.ts`. Hook signature: `useSparklines(quotes) → RefObject<Record<string, number[]>>`. Import and use in `Screener.tsx`. No behavior change.

### Commit 6 — Extract `useScreenerData.ts`
Move all `useMemo` blocks from `Screener.tsx` into `hooks/useScreenerData.ts`:
- `processed` (metrics + filter pass)
- `sorted`
- `grouped`
- `sectors`
- `visibleCols`
- `pageCount` / `rows`
- `activeFiltersCount`

Hook signature:
```
useScreenerData({ quotes, indexData, filters, sort, page })
→ { processed, sorted, grouped, rows, sectors, visibleCols, pageCount, activeFiltersCount }
```

Import into `Screener.tsx`. No behavior change.

### Commit 7 — Extract `ScreenerTableHeader.tsx`
Move the `<thead>` block into its own component. Props: `visibleCols`, `sort`, `onSort`. No behavior change; just reduces Screener render function length.

### Commit 8 — Extract `ColumnPicker.tsx`
Move the column-picker dropdown (`showColPicker` state + popover) into a self-contained `ColumnPicker` component. It manages its own open/close state internally. Props: `visibleColumns`, `onToggle`. Remove `showColPicker` state from `Screener.tsx`.

### Commit 9 — Extract `ScreenerFilters.tsx`
Move the entire preset bar and filter bar into `ScreenerFilters.tsx`. Props: all filter values + callbacks. `Screener.tsx` passes down store values; `ScreenerFilters` owns zero state. This commit cuts ~120 lines from the main file.

### Commit 10 — Slim `ScreenerRow.tsx`
Refactor the existing `ScreenerRow` inline component into its own file. Change the component to call `getVolColor`, `getRangePos`, and `getSignal` from `calculations.ts` rather than accepting `getSignals` as a prop. Reduce prop count from 11 to 8. Stable prop set means `memo()` now actually prevents re-renders.

### Commit 11 — Stabilize callbacks in `Screener.tsx`
Audit `handleRowClick`, `handleWatchlist`, `toggleSort` for unnecessary recreations. Ensure `useCallback` deps are minimal. Add `activeWatchlistCategoryId` to `handleWatchlist` dep array if missing.

### Commit 12 — Final cleanup of `Screener.tsx`
At this point the orchestrator should be ~120 lines: imports, store hooks, two custom hooks, handler definitions, and JSX that assembles `ScreenerFilters`, `ScreenerTableHeader`, `ScreenerRow` rows, and pagination. Remove all dead code. Add file-level comment documenting the module's sole responsibility.

---

## Decision Document

**Module responsibilities:**
- `Screener.tsx` — wires stores to child components; owns sort/page/activeTicker state
- `ScreenerRow.tsx` — renders one table row; calls util functions internally; zero store access
- `ScreenerFilters.tsx` — renders preset chips, filter inputs, column picker; stateless (props only)
- `ScreenerTableHeader.tsx` — renders sticky `<thead>` with sort indicators; stateless
- `useScreenerData.ts` — owns all filtering, sorting, grouping, and pagination memos
- `useSparklines.ts` — owns sparkline tick accumulation ref and effect
- `calculations.ts` — pure functions for signal detection, range position, volume color
- `formatters.ts` — pure formatting functions for prices, volumes, percentages
- `tokens.ts` — single source of truth for colors, column config, shared style objects

**Architectural decisions:**
- `ScreenerRow` will NOT access Zustand stores directly — all data passed via props
- `getSignals` promoted from `useCallback` inside component to a pure function in `calculations.ts`; `useCallback` wrapping removed
- `showColPicker` state moves inside `ColumnPicker` — reduces orchestrator state count
- Inline `<style>` injection replaced with static CSS import to avoid FOUC and improve CSP compatibility
- `memo()` on `ScreenerRow` kept but only becomes effective after prop stabilization in Commit 10
- No virtualization in this refactor scope (see Out of Scope)
- No changes to `useScreenerStore` API or `QuoteData` type

**Prop interface for `ScreenerRow` after refactor:**
```
q: QuoteData & { rvol: number; rs_rank: number }
spark: number[]
visibleColumns: string[]
inWl: boolean
isActive: boolean
onSelectTicker: (ticker: string) => void
onWatchlist: (e: React.MouseEvent, ticker: string) => void
```

---

## Testing Decisions

**What makes a good test here:**
- Test external behavior, not implementation details
- Test pure functions with known inputs and assert outputs
- Do NOT test that a specific component sub-tree renders — test what the user would observe

**Modules to test first (pure functions, easiest wins):**
- `formatters.ts` — unit test every function: edge cases like `v=0`, `v=undefined`, large values, negative pct
- `calculations.ts` — unit test `getVolColor`, `getRangePos`, `getSignal` with quote fixtures
- `useScreenerData.ts` — test with `renderHook`; assert filter exclusion, sort direction, RS rank percentile math, pagination slice

**Prior art:**
- No existing tests in codebase; start a `__tests__` folder co-located with `utils/`
- Use Vitest (if already in project) or Jest; no special setup needed for pure functions

**What NOT to test:**
- That `ScreenerRow` renders a `<tr>` — too coupled to markup
- Store integration — covered by store's own tests
- CSS hover states — visual regression territory

---

## Out of Scope

- **Row virtualization** (e.g. `react-virtual`) — meaningful perf win for 500+ rows but separate concern; file in follow-up issue
- **Refactoring `useScreenerStore`** — store shape and preset logic not touched
- **Adding new columns or signals** — this refactor enables it but doesn't do it
- **Changing filter UX** — layout and inputs unchanged
- **TypeScript strictness improvements** — `as any` casts in sort logic left for separate pass
- **Accessibility audit** — table keyboard navigation and ARIA labels deferred

---

## Further Notes

The `grouped` sector rendering and flat-list rendering currently duplicate the `ScreenerRow` call. After Commit 9, consider a small `renderRows(quotes)` helper inside `Screener.tsx` to DRY this up — but only as a minor cleanup, not a separate component.

The `contentVisibility: "auto"` hint on `<tbody>` (line 614) is a low-cost perf boost already in place — keep it.

After Commit 5, `useSparklines` can be independently tested with a mock quotes stream to verify the 30-tick cap and dedup logic.
