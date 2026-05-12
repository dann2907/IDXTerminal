Screener Table Redesign — IDX Terminal
Context
Fix information-dense stock screener table. Goal: improve scanability, reduce cognitive load, maintain data richness. Users need quick visual pattern recognition for 20+ stocks simultaneously.

CRITICAL FIXES (Do These First)
1. Spacing & Density
Current: Row height ~32px (cramped)
Fix: Row height 52px minimum

Rationale: Financial data requires breathing room. Bloomberg Terminal uses 48-56px rows. Eyes need rest stops between data rows.

Implementation:
- Table row: min-height: 52px
- Cell padding: 12px vertical, 16px horizontal
- Line height: 1.5 for all text
2. Visual Hierarchy — Typography
Current: All text similar size/weight
Fix: Create 3-tier hierarchy

Tier 1 (Primary): Ticker symbol + Price change %
- Font size: 16px
- Weight: 600 (semi-bold)
- Color: White (ticker), Green/Red (% change)

Tier 2 (Secondary): Last price, Volume
- Font size: 14px
- Weight: 500 (medium)
- Color: #E5E5E5

Tier 3 (Tertiary): High, Low, other metadata
- Font size: 13px
- Weight: 400 (regular)
- Color: #A0A0A0

Rationale: Eye scans ticker + % change first (most volatile data), then price/volume (context), then range (optional detail).
3. Color System Simplification
Current: 5+ badge colors (HIGH VOL, OVERSOLD, BREAKOUT, STRONG RS, etc.)
Fix: 2-color badge system + grayscale

Keep ONLY:
- RED badges: Alert/Oversold conditions (max 1 per row)
- BLUE badges: Volume/Momentum indicators (max 1 per row)

Remove:
- Yellow badges (creates visual noise)
- Multiple badges per row (forces user to decode too much)

If multiple conditions exist, prioritize:
1. Oversold/Alert (red)
2. High Volume (blue)
3. Others → hide in tooltip on hover

Badge styling:
- Border radius: 4px (not pill)
- Padding: 4px 8px
- Font size: 11px
- Opacity: 0.9 (not full solid)

Rationale: Jakob's Law — users expect color coding similar to Bloomberg/TradingView (red=danger, blue=info). Too many colors = cognitive overload.
4. Add Inline Sparkline Chart
Insert between "Last" and "Chg%" columns

Dimensions:
- Width: 80px
- Height: 32px
- Line thickness: 2px
- Color: 
  - Green if trend up
  - Red if trend down
  - Gray if flat

Data: Last 20 price points (intraday or daily depending on view)

Rationale: Instant visual trend recognition. TradingView and Robinhood both use this pattern. Reduces need to read numbers for pattern detection.

SECONDARY FIXES (High Impact, Lower Priority)
5. Remove/Collapse Useless Columns
Problem: "Grouping" column shows "OFF" for all rows
Fix: Remove entirely OR make collapsible filter row

Problem: "Action" column buttons always visible
Fix: Show plus button only on row hover
Alternative: Double-click row = add to watchlist
6. Interaction States
Current: Unclear which row is active/selected
Fix: Add clear hover + active states

Hover state:
- Background: rgba(255,255,255, 0.05)
- Transition: 150ms ease
- Border-left: 3px solid #00A8FF

Active/selected state:
- Background: rgba(0,168,255, 0.15)
- Border-left: 3px solid #00A8FF
- Font weight: +100 for ticker

Click behavior:
- Single click: Select row (highlight)
- Double click: Add to watchlist OR open detail panel
7. Sticky Header with Context
Current: Header scrolls away, lose context
Fix: Sticky table header

Additional header enhancement:
- Show total results count: "Showing 18 of 245 stocks"
- Show active filters as removable pills
- Add "Clear all filters" if >1 filter active

CSS:
position: sticky;
top: 0;
z-index: 10;
background: #1A1D29; /* match app bg */
box-shadow: 0 2px 8px rgba(0,0,0,0.3);

POLISH FIXES (Low Effort, Nice to Have)
8. Volume Bar Visualization
Current: Volume column just number (e.g., "1.7M")
Fix: Number + horizontal bar

Example:
┌─────────────────────┐
│ 1.7M ▓▓▓▓▓▓░░░░     │
└─────────────────────┘

Bar represents volume relative to stock's 30-day avg:
- 0-50%: Red bar (low volume, caution)
- 50-100%: Gray bar (normal)
- 100%+: Green bar (high volume, interest)
9. High/Low Range Indicator
Current: Two separate columns (High: 135, Low: 111)
Fix: Single combined column with visual range

Example:
111 ●━━━━○━━━━ 135
    ↑
  Current (114)

- Line = price range today
- Filled dot = current price position
- Grayed out if price hasn't moved much
10. Improved Filter Tabs
Current: 6 filter buttons compete for attention
Fix: Visual hierarchy

Primary tabs (always visible):
- [Semua] [Top Gainer] [Top Loser] [Breakout]
Style: Solid background when active

Secondary filters (dropdown "More filters"):
- High Volume
- Moar ATH
- Custom screens
Style: Icon-based dropdown

Active tab styling:
- Background: #00A8FF
- Bottom border: 3px solid #0088CC
- Font weight: 600

TECHNICAL SPECIFICATIONS
Color Palette
css/* Base */
--bg-primary: #1A1D29;
--bg-row-hover: rgba(255,255,255,0.05);
--bg-row-active: rgba(0,168,255,0.15);

/* Text */
--text-primary: #FFFFFF;
--text-secondary: #E5E5E5;
--text-tertiary: #A0A0A0;

/* Accent */
--accent-blue: #00A8FF;
--success-green: #00D66F;
--danger-red: #FF4D4D;

/* Badges */
--badge-alert: #FF4D4D;
--badge-info: #00A8FF;
--badge-bg: rgba(255,255,255,0.1);
Spacing Scale
css--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;
--space-xl: 24px;
Typography Scale
css--font-size-xs: 11px;
--font-size-sm: 13px;
--font-size-md: 14px;
--font-size-lg: 16px;

--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;

BEFORE/AFTER COMPARISON
Before:

32px row height → cramped
5+ badge colors → confusing
No trend indicators → must read numbers
Weak hover states → unclear selection
All columns visible → information overload

After:

52px row height → scannable
2 badge colors → clear signals
Inline sparklines → instant pattern recognition
Strong hover/active states → clear feedback
Prioritized columns → focused data
Sticky header → maintained context

VALIDATION CHECKLIST
After implementing, verify:

 Can scan 20 rows in <5 seconds for outliers?
 Badge colors don't require legend?
 Hover state appears <150ms?
 Sparkline renders without layout shift?
 Active row remains highlighted when scrolling?
 Works on 1920x1080 and 1366x768 resolutions?

REFERENCE INSPIRATION
Study these for similar patterns:

- TradingView stock screener (sparklines + density)
- Bloomberg Terminal (typography hierarchy)
- Robinhood watchlist (interaction states)
- Interactive Brokers TWS (color discipline)

Priority order: Do fixes 1-4 first (80% visual improvement), then 5-7 (polish), then 8-10 (nice-to-have).
Target: Reduce user's "time to insight" from 10 seconds → 3 seconds per stock
