# Mike 2.1 Design Token & Component Specification

Source: `/Users/z/mike-2.0/Mike-2.1.pen` — extracted via Pencil MCP.

This document is the source of truth for the Mike 2.1 redesign. It is intended to be consumed by a downstream frontend-implementation agent that will translate it into a Tailwind v4 `@theme` block in `globals.css` and matching React components built on shadcn/ui primitives.

The Pencil file defines three coexisting token systems:

1. **Unprefixed (`--*`)** — the bespoke Mike 2.1 token system. This is the canonical, production system. All custom components (`btn/`, `card/`, `composer/`, `chrome/`, etc.) and all four production screens reference these tokens.
2. **`F:--*`** — shadcn/ui reference tokens (Light/Dark + Neutral/Gray/Stone/Zinc/Slate base + 7 accent variants). Used inside the `F:*` reference component library for comparison only.
3. **`B:--*`** — nitro reference tokens (Light/Dark). Used inside the `B:*` reference component library for comparison only.

**Implement only the unprefixed tokens.** The `F:` and `B:` systems exist in the file as side-by-side reference kits to help the designer prove that the bespoke system can absorb their primitives — they are not shipped.

---

## Section 1: Token Inventory

### 1.1 Colors (Unprefixed — Production)

The bespoke system ships **light mode only** (no dark-mode variants on the unprefixed tokens). Dark mode, if needed later, can be derived using the `B:` and `F:` reference palettes as guides.

#### Surfaces & background

| Variable | Hex | Semantic role |
|---|---|---|
| `--bg` | `#FFFFFF` | App background (chrome — rails, sidebars) |
| `--bg-canvas` | `#FFFFFF` | Main content canvas |
| `--surface` | `#FFFFFF` | Card/surface base |
| `--surface-2` | `#F5F6F8` | Secondary surface — subtle warm-paper tint |
| `--surface-3` | `#222233` | Dark surface (tooltip, keybinding chip on dark bg) |
| `--surface-hover` | `#F5F6F8` | Hover state for surfaces (= `--surface-2`) |

#### Borders

| Variable | Hex | Semantic role |
|---|---|---|
| `--border` | `#E5E7EB` | Default hairline border |
| `--border-strong` | `#D1D5DB` | Stronger border (composer outline, selection toolbar) |
| `--border-active` | `#0A0A0A` | Active/focused border (= `--accent`) |

#### Text

| Variable | Hex | Semantic role |
|---|---|---|
| `--text` | `#0A0A0A` | Primary ink — near-black |
| `--text-secondary` | `#4B5563` | Secondary copy |
| `--text-muted` | `#6B7280` | Muted/labels |
| `--text-dim` | `#9CA3AF` | Dimmed placeholder |

#### Accent (the "ink-purple" replacement — currently neutral near-black)

| Variable | Hex | Semantic role |
|---|---|---|
| `--accent` | `#0A0A0A` | Primary accent (used as fill on `btn/primary/*`, send button, logo bg) |
| `--accent-hover` | `#1F2024` | Accent hover state |
| `--accent-soft` | `#F5F6F8` | Soft accent surface (active pills, playbook chip bg) |
| `--accent-text` | `#0A0A0A` | Text-on-accent-soft |
| `--accent-glow` | `#0A0A0A1A` | Translucent accent for glow/ring |

#### Semantic / status colors

The redesign uses muted, warm-paper-friendly status tones (not the saturated Tailwind defaults).

| Variable | Hex | Semantic role |
|---|---|---|
| `--green` | `#3E8E5D` | Success text / active status |
| `--green-soft` | `#DDEEDF` | Success background |
| `--green-dim` | `#22c55e1f` | Success translucent (rings, glows) |
| `--amber` | `#8B6A0F` | Warning / pending text |
| `--amber-soft` | `#F8EAB8` | Warning background |
| `--amber-dim` | `#f59e0b1f` | Warning translucent |
| `--rose` | `#A04E48` | Destructive / blocked text |
| `--rose-soft` | `#FBE0DD` | Destructive background |
| `--rose-dim` | `#f43f5e1f` | Destructive translucent |
| `--blue` | `#3B6BA6` | Info / review text |
| `--blue-soft` | `#E0E9F5` | Info background |
| `--purple` | `#3B6BA6` | Aliased to blue (purpose unclear — same hex as `--blue`; likely placeholder for a future violet accent) |
| `--purple-dim` | `#E0E9F5` | Aliased to `--blue-soft` (purpose unclear) |
| `--cyan` | `#06b6d4` | Info accent (purpose unclear — only `-dim` is referenced) |
| `--cyan-dim` | `#06b6d41f` | Cyan translucent |
| `--gold` | `#d4a017` | Gold accent (purpose unclear — likely premium/highlight) |

#### Dark-mode reference (from `B:` system, for future use)

The `B:` system encodes a Light/Dark pair on every semantic role. Notable Mike-2.1-compatible dark values:

| Role | Light | Dark |
|---|---|---|
| background | `#F5F5F5` | `#252629` |
| card | `#FFFFFF` | `#1F1F1F` |
| foreground | `#333333` | `#F5F5F5` |
| muted | `#F2F3F0` | `#2E2E2E` |
| muted-foreground | `#5B5F66` | `#A0A6B2` |
| border | `#E1E2E5` | `#2E2E2E` |
| primary | `#0F5FFE` | `#0F5FFE` |
| destructive | `#A62911` | `#A62911` |

### 1.2 Typography

| Variable | Value | Role |
|---|---|---|
| `--font-sans` | `Inter` | Default UI / body |
| `--font-serif` | `Inter` | Display / titles (note: aliased to Inter — likely a forthcoming serif swap; treat as "display" slot) |
| `--font-mono` | `JetBrains Mono` | Mono / keyboard shortcuts / hints |

**Observed font sizes** (no scale variables — sizes are inline on text nodes):

| Size (px) | Used for |
|---|---|
| 10 | Mono micro-hints (`Shift + ⏎ newline`) |
| 11 | Small labels, button text on `btn/primary/sm`, chip text |
| 12 | Composer placeholder, body small, source sub-text, library sub-copy |
| 13 | Standard card title, section eyebrow, library title |
| 14 | shadcn-style input/label (`F:` family default) |
| 24 | (assumed) screen-level headings — not observed in samples, infer from `frontend-ui-engineering` defaults |
| 28 | (registration form example only) — confirm during implementation |

**Observed font weights:** `normal` (400), `500`, `600`.

**Observed line heights:** `1.4285714285714286` (≈ 1.43, shadcn default for size-14), `1.5` (body / wrapped copy).

**Observed letter-spacing:** `-1` (only on the library title — tight display tracking).

### 1.3 Spacing scale

| Variable | px |
|---|---|
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 24 |
| `--space-6` | 32 |

Common padding values seen inline (not variable-bound, but conforming to the scale): `[3,5]`, `[3,8]`, `[4,9]`, `[6,8]`, `[8,16]`, `[10,12]`, `[10,14]`, `[10,16]`, `[14,14,10,14]`, `18`, `32`, `48`.

### 1.4 Corner radii

| Variable | px | Used for |
|---|---|---|
| `--radius-sm` | 6 | Buttons (shadcn-style), small chips, dropdown items |
| `--radius-md` | 8 | Icon-rail item, secondary chrome surfaces |
| `--radius-lg` | 12 | Standard card, panels |
| `--radius-xl` | 16 | Hero/specimen frames |

Non-variable radii used inline: `14` (composer), `999` (pills, send button, primary buttons) — treat `999` as the pill token.

`B:` system adds `--radius-xs: 2`, `--radius-none: 0`, `--radius-pill: 999` — adopt `--radius-pill: 999` and `--radius-xs: 2` into the production scale.

### 1.5 Shadows / elevation

**No shadow tokens are defined.** The redesign relies on hairline borders (`--border`, `--border-strong`) plus solid surfaces — a deliberate flat, paper aesthetic. The only ambient depth effect found is `--accent-glow: #0A0A0A1A`, which is a translucent accent used as a glow ring/halo. No `Effect` objects of type `"shadow"` are bound to variables.

If shadows are required at implementation time, derive from `--accent-glow` for ring/focus and define ad-hoc soft shadows per surface.

---

## Section 2: Component Catalog

The file contains **238 reusable components** organised into three families: bespoke Mike-2.1 primitives (no prefix), shadcn-style references (`F:` prefix), and nitro-style references (`B:` prefix).

### 2.1 Production family (the bespoke kit — no prefix)

| Group | Count | Purpose | Representative IDs |
|---|---|---|---|
| `btn/` | 15 | Buttons. Variants: primary/outline/ghost/destructive/icon × sm/md/lg, plus `btn/send` for the chat composer | `LXiYJ` (btn/primary/sm), `VqS1c` (btn/primary/md), `bVOd5` (btn/primary/lg), `SfFta` (btn/send) |
| `pill/` | 7 | Status pills (active/pending/review/blocked/neutral) and filter pills (default/active) | `sW5NM` (pill/status/active), `MKLDa` (pill/filter/active) |
| `chip/` | 5 | Inline chips: file, file/red (destructive variant), citation, context, kbd | `l9Xbc` (chip/file), `O7h4y9` (chip/citation), `Iomfn` (chip/kbd) |
| `chrome/` | 5 | App chrome — icon rail item, icon rail container, nav item, breadcrumb, topbar, page header | `wF9tL` (chrome/icon-rail-item), `yEGYQ` (chrome/topbar), `QxArF` (chrome/page-header) |
| `card/` | 10 | Cards — standard, kpi, source, matter, list-row, empty-state, section-header, divider, document-task, agent-plan | `Uke1z` (card/standard), `kyXAe` (card/source), `lSh0T` (card/matter) |
| `identity/` | 6 | Avatars — xs/sm/md/lg, stack, user-chip | `Hqivv` (identity/avatar/sm), `B8ZiC8` (identity/avatar/lg), `xDnqj` (identity/avatar/user-chip) |
| `composer/` | 2 | Chat composer — default (full) and compact | `eIDlV` (composer/default), `IWRSW` (composer/compact) |
| `dialog/` | 3 | Modal pieces — overlay scrim, panel, composite | `bfGsI` (dialog/overlay), `PH0Xo` (dialog/panel), `acbyZ` (dialog/composite) |
| misc | 1 | `BxlTC` — `bDef` (likely button-default base, purpose unclear) | `BxlTC` |

**Total bespoke components: 54.**

### 2.2 shadcn reference family (`F:` prefix)

| Group | Count | Purpose | Representative IDs |
|---|---|---|---|
| Buttons & icon buttons | ~22 | shadcn button matrix: Default/Secondary/Outline/Ghost/Destructive × Default/Large, plus Icon Button equivalents | `F:VSnC2` (Button/Default), `F:C10zH` (Button/Outline), `F:urnwK` (Icon Button/Default) |
| Inputs / forms | ~14 | Input, Input Group, Select, Combobox, OTP, Textarea, Checkbox, Radio, Switch — Default/Filled/Checked/Unchecked | `F:1415a` (Input Group/Default), `F:fEUdI` (Input/Default), `F:c8fiq` (Switch/Checked) |
| Cards & containers | ~5 | Card, Card Plain, Card Action, Card Image, Dialog | `F:pcGlv` (Card), `F:OtykB` (Dialog) |
| Navigation | ~8 | Sidebar, Sidebar Item/Active+Default, Sidebar Section Title, Tabs+Tab Item, Breadcrumb pieces, Pagination | `F:PV1ln` (Sidebar), `F:qCCo8` (Sidebar Item/Active), `F:PbofX` (Tabs) |
| Tables & data | ~7 | Table, Table Row, Table Cell, Table Column Header, Data Table Header/Footer, Data Table | `F:bG7YL` (Table), `F:shadcnDataTable` (Data Table) |
| Feedback | ~6 | Alert, Tooltip, Progress, Badge (Default/Secondary/Destructive/Outline), Accordion | `F:QyzNg` (Alert/Default), `F:lxrnE` (Tooltip), `F:UjXug` (Badge/Default) |
| Lists & modals | ~10 | List Item/Title/Divider, List Search Box, Modal/Left/Center/Icon, Dropdown | `F:OtykB` (Dialog), `F:oVUJY` (Modal/Left), `F:cTN8T` (Dropdown) |
| Avatar | 2 | Avatar/Text, Avatar/Image | `F:DpPVg`, `F:HWTb9` |

**Total `F:` components: ~90.**

### 2.3 nitro reference family (`B:` prefix)

Same component coverage as `F:` (Buttons, Inputs, Cards, Sidebar, Tables, Alerts, Labels, Avatars, Modals, Tabs, etc.) but with the nitro visual style (saturated `#0F5FFE` primary, different radii, dark-mode bound).

**Total `B:` components: ~94.**

Representative IDs: `B:bf6GF` (Button/Default), `B:tcMJ2` (Card), `B:k1Tgo` (Sidebar), `B:Kw3hB` (Dialog), `B:0IOYd` (Table), `B:vnlpI` (Alert/Info), `B:cvozN` (Checkbox/Checked).

### 2.4 Which variant family is for production?

**Neither `F:` nor `B:` is referenced by the production screens.** Inspection of the AI Chat screen (`CzlFI`) at depth 2 shows it is composed of ad-hoc frames + the bespoke `composer/default` (`eIDlV`) and bespoke chrome primitives — no `F:*` or `B:*` ref objects appear in the screen tree.

| Family | Refs in AI Chat (`CzlFI`) | Refs in Inline Editor (`LlZCw`) | Refs in Workflow (`B5cWd`) | Refs in Playbooks (`INkf5`) |
|---|---|---|---|---|
| Bespoke (`btn/`, `card/`, `composer/`, etc.) | yes (`eIDlV` composer; bespoke chrome inline) | yes | yes | yes |
| `F:*` (shadcn) | 0 | 0 | 0 | 0 |
| `B:*` (nitro) | 0 | 0 | 0 | 0 |

**Conclusion:** the bespoke kit is the production system. `F:` and `B:` are reference libraries placed in the file so the designer can show how the bespoke kit absorbs shadcn and nitro primitives.

**Implementation guidance:** the implementation agent should build the bespoke kit as React components on top of shadcn/ui primitives (because shadcn is the closest API match — note that `F:` IDs literally include shadcn naming like `F:shadcnDataTable`). The visual styling, padding, radii, and colors come from the bespoke (`--*`) tokens, not from `F:--*`.

---

## Section 3: Screen Layout Notes

All four production screens are **1440 × 900** desktop frames, with `clip: true` and `fill: $--bg` (white).

### 3.1 AI Chat — `CzlFI` (1440 × 900)

**Layout:** three-column horizontal (no explicit `layout` set → defaults to horizontal for a frame).

```
[ IconRail 64w ] [ ThreadsCol 220w ] [ Main fill ]
```

- **IconRail** (`H5mNDv`, 64px wide, `--bg`, right hairline border): vertical stack of 6 nav icon buttons (`ic1`–`ic6`) + spacer + avatar ellipse. Padding `[14,0]`, gap 4.
- **ThreadsCol** (`rmsXd`, 220px wide, `--bg`, right hairline border): vertical layout. Children include:
  - `thHd` — thread header row (with padding `[14,14,10,14]`)
  - `ncWrap` — "new chat" wrapper
  - `srWrap` — search wrapper
  - `tdyLbl` + `tdyList` — "Today" section
  - `MesJA` + `iekZ8` — "Yesterday" section
  - `Fn4aa` + `Ac4OO` — "Earlier" section
  - `thSpacer` — flex spacer
  - `thFoot` — footer row with top hairline border
- **Main** (`Wqylv`, fill, `--bg-canvas`): vertical layout. Children:
  - `J3cBku` — top header bar with bottom hairline border, padding `[12,24]`
  - `m93wxu` — `ConvScroll` conversation area, vertical, padding `[28,0,8,0]`, fills remaining height
  - `M62Ly2` — `compWrap` centers the composer (`eIDlV` composer/default, 680px wide)
  - `ELsu1` — `hint` row, bottom padding 14

**Key composite components used:** `eIDlV` (composer/default), bespoke chrome inline (icon rail items rendered as frames not refs).

### 3.2 Inline Document Editor — `LlZCw` (1440 × 900)

**Layout:** vertical (`layout: vertical`).

```
[ Topbar full-width 8/16 padding, bottom border ]
[ Body fill ]
[ floating sel-keybinding chip (absolute at 700,476, dark #0A0A0A pill) ]
[ floating selection-toolbar (absolute at 600,506, pill 999 radius, --bg-canvas, --border-strong) ]
```

- **Topbar** (`SpRaf`, `--bg-canvas`, padding `[8,16]`, gap 10, bottom hairline border): app chrome for the editor.
- **Body** (`vPM31`, fills remaining): document editing canvas.
- **sel-keybinding** (`StxGh`): a dark mini-chip showing a keyboard shortcut over a text selection — proves the design supports floating tooltips on selection.
- **selection-toolbar** (`xOTzk`): a pill-shaped floating toolbar (radius 999, `--border-strong`) — the inline rich-text formatting bar.

**Key composite components used:** no refs visible at depth 1; uses bespoke chrome primitives inline.

### 3.3 Workflow Builder — `B5cWd` (1440 × 900)

**Layout:** horizontal (frame default).

```
[ IconRail 60w, --surface ] [ SecondaryNav 200w, --surface ] [ Main fill, --bg-canvas ]
```

- **IconRail** (`MuZv2`, 60px, `--surface`, height 900, padding `[16,0]`, gap 4, right hairline border): vertical icon nav.
- **SecondaryNav** (`cYlim`, 200px, `--surface`, height 900, padding `[20,14]`, gap 18, right hairline border): vertical workflow categories.
- **Main** (`pgyNw`, fill, `--bg-canvas`, height 900, vertical): the React Flow workflow canvas surface.

**Key composite components used:** bespoke chrome; expect React Flow integration in Main.

### 3.4 Playbooks Library — `INkf5` (1440 × 900)

**Layout:** horizontal.

```
[ IconRail 56w, #FFFFFF ] [ SecondaryNav 208w, #FFFFFF ] [ Main fill ]
```

- **IconRail** (`p7MEa`, 56px, white, padding `[16,0]`, gap 4, right hairline border): vertical icon nav.
- **SecondaryNav** (`Uf5WW`, 208px, white, padding `[20,16]`, right hairline border): playbook categories.
- **Main** (`s47C0`, fill, vertical): playbook grid/list view.

Note: the IconRail and SecondaryNav widths vary slightly between screens (64/220 on Chat, 60/200 on Workflow, 56/208 on Playbooks). The implementation agent should pick **one** canonical width pair (recommend `64 / 224` to align with Tailwind's `w-16 / w-56`) and apply it uniformly unless the design clearly intends per-product chrome.

---

## Section 4: Tailwind v4 `@theme` mapping

Drop this into `frontend/src/app/globals.css` (or equivalent). Targets Tailwind CSS v4 syntax (`@theme` block with CSS custom properties). All values are taken directly from `mcp__pencil__get_variables` output.

```css
@import "tailwindcss";

@theme {
  /* ---------- Typography ---------- */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Inter", ui-serif, Georgia, serif; /* display slot — currently Inter, swap to a serif when ready */
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  /* ---------- Spacing scale (Mike 2.1 bespoke) ----------
     These compose with Tailwind's default spacing scale. Use as `p-(--space-3)` etc.
     For ergonomic Tailwind classes, the implementation agent should ALSO
     ensure the standard 4-px Tailwind scale (default) is enabled. */
  --space-1: 0.25rem;  /* 4px  */
  --space-2: 0.5rem;   /* 8px  */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.5rem;   /* 24px */
  --space-6: 2rem;     /* 32px */

  /* ---------- Corner radii ---------- */
  --radius-xs: 0.125rem; /*  2px (from B: system) */
  --radius-sm: 0.375rem; /*  6px */
  --radius-md: 0.5rem;   /*  8px */
  --radius-lg: 0.75rem;  /* 12px */
  --radius-xl: 1rem;     /* 16px */
  --radius-pill: 9999px; /* fully rounded */

  /* ---------- Colors: surfaces ---------- */
  --color-bg: #FFFFFF;
  --color-bg-canvas: #FFFFFF;
  --color-surface: #FFFFFF;
  --color-surface-2: #F5F6F8;
  --color-surface-3: #222233;
  --color-surface-hover: #F5F6F8;

  /* ---------- Colors: borders ---------- */
  --color-border: #E5E7EB;
  --color-border-strong: #D1D5DB;
  --color-border-active: #0A0A0A;

  /* ---------- Colors: text ---------- */
  --color-text: #0A0A0A;
  --color-text-secondary: #4B5563;
  --color-text-muted: #6B7280;
  --color-text-dim: #9CA3AF;

  /* ---------- Colors: accent (ink-purple slot — currently near-black) ---------- */
  --color-accent: #0A0A0A;
  --color-accent-hover: #1F2024;
  --color-accent-soft: #F5F6F8;
  --color-accent-text: #0A0A0A;
  --color-accent-glow: #0A0A0A1A;

  /* ---------- Colors: status ---------- */
  --color-green: #3E8E5D;
  --color-green-soft: #DDEEDF;
  --color-green-dim: #22C55E1F;

  --color-amber: #8B6A0F;
  --color-amber-soft: #F8EAB8;
  --color-amber-dim: #F59E0B1F;

  --color-rose: #A04E48;
  --color-rose-soft: #FBE0DD;
  --color-rose-dim: #F43F5E1F;

  --color-blue: #3B6BA6;
  --color-blue-soft: #E0E9F5;

  /* aliases (purpose unclear in source — preserved for compatibility) */
  --color-purple: #3B6BA6;
  --color-purple-dim: #E0E9F5;
  --color-cyan: #06B6D4;
  --color-cyan-dim: #06B6D41F;
  --color-gold: #D4A017;
}

/* ----------------------------------------------------------------
   Optional dark mode (derived from the B: reference system).
   Enable when the product opts into dark mode.
   ---------------------------------------------------------------- */
@media (prefers-color-scheme: dark) {
  @theme {
    --color-bg: #252629;
    --color-bg-canvas: #1F1F1F;
    --color-surface: #1F1F1F;
    --color-surface-2: #2E2E2E;
    --color-border: #2E2E2E;
    --color-border-strong: #414347;
    --color-text: #F5F5F5;
    --color-text-secondary: #A0A6B2;
    --color-text-muted: #A0A6B2;
    --color-accent: #F2F3F0;
    --color-accent-soft: #2A2A30;
  }
}

/* ----------------------------------------------------------------
   Semantic component tokens — map shadcn/ui slots to Mike 2.1.
   The implementation agent should wire shadcn components to these.
   ---------------------------------------------------------------- */
@theme {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-text);
  --color-card: var(--color-surface);
  --color-card-foreground: var(--color-text);
  --color-popover: var(--color-surface);
  --color-popover-foreground: var(--color-text);
  --color-primary: var(--color-accent);
  --color-primary-foreground: #FFFFFF;
  --color-secondary: var(--color-surface-2);
  --color-secondary-foreground: var(--color-text);
  --color-muted: var(--color-surface-2);
  --color-muted-foreground: var(--color-text-muted);
  --color-destructive: var(--color-rose);
  --color-destructive-foreground: #FFFFFF;
  --color-input: var(--color-border);
  --color-ring: var(--color-accent-glow);
}
```

### 4.1 Notes for the implementation agent

1. **Pill radius (999px).** The bespoke `btn/primary/*` components use `cornerRadius: 999` (fully rounded) — this is a deliberate signature shape. Apply `rounded-full` (= `--radius-pill`) to all primary buttons, status pills, the send button, and the selection toolbar. Cards and inputs use `--radius-lg` (12) and `--radius-sm` (6) respectively.

2. **No drop shadows.** The visual hierarchy is built on hairline 1px borders (`--color-border`, `--color-border-strong`) over near-white surfaces. Avoid `shadow-*` classes in favor of `ring-1 ring-border` or `border` styles.

3. **Accent is ink (near-black).** `--color-accent` is `#0A0A0A`, not a saturated brand color. Primary buttons render as black pills with white text — high contrast, low chroma. If a brand color is later introduced, it should be wired through `--color-accent` only.

4. **Font sizes are inline, not tokenized.** The Pencil file does not define `--text-*` size variables; sizes appear inline on text nodes. The implementation agent should adopt Tailwind's default text scale (`text-xs` = 12, `text-sm` = 14, `text-base` = 16) and override sizes per-component as needed. Common observed sizes: 10, 11, 12, 13, 14.

5. **`F:` and `B:` tokens are reference-only.** Do not implement them. They exist only to support the reference component libraries inside the Pencil file.

6. **Composer is 680px wide** (centered in `Main`). Width values for chat container, threads column, icon rails, and composer should be lifted directly from the screen frames (see Section 3) and codified as layout constants — e.g. `CHAT_THREADS_WIDTH = 220`, `CHAT_RAIL_WIDTH = 64`, `CHAT_COMPOSER_WIDTH = 680`.

7. **Component build order suggestion** for the implementation agent: tokens → primitives (Button, Input, Card, Avatar, Badge, Pill) → composite chrome (IconRail, Sidebar, Topbar) → product surfaces (Composer, ConversationStream, WorkflowCanvas, PlaybooksList).

---

## Appendix: Source IDs for re-lookup

| Topic | Pencil node ID |
|---|---|
| Component Library — Redesign (After) | `T7sIos` |
| Original Mike 2.0 — Reference | `T0xbi` |
| Mike 2.1 — Pages we missed | `S9ZQTA` |
| Mike 2.1 — Reusable Components | `PL14F` |
| Screen / AI Chat | `CzlFI` |
| Screen / Inline Document Editor | `LlZCw` |
| Screen / Workflow Builder | `B5cWd` |
| Screen / Playbooks Library | `INkf5` |
| User Flows | `wBn7m` |
| btn/primary/sm | `LXiYJ` |
| btn/primary/md | `VqS1c` |
| btn/primary/lg | `bVOd5` |
| btn/send | `SfFta` |
| card/standard | `Uke1z` |
| composer/default | `eIDlV` |
| composer/compact | `IWRSW` |
| F:Input Group/Default (shadcn ref) | `F:1415a` |
| F:Sidebar Item/Active (shadcn ref) | `F:qCCo8` |
| B:Sidebar (nitro ref) | `B:k1Tgo` |
| F:Data Table (shadcn ref) | `F:shadcnDataTable` |
| B:Data Table (nitro ref) | `B:nitroDataTable` |
