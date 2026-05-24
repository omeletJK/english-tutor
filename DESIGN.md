# Omelet English Tutor Design System

## Product Direction

Omelet English Tutor is a private AI learning companion for Jiyool and Hayool.
The product should feel like a well-loved learning notebook — calm, warm, and a
little crafted. Not a worksheet app, not a candy-colored toy, not a generic
SaaS dashboard.

The visual language sits between an editorial reading app and a children's
hardcover book. Premium enough that a middle schooler is not embarrassed by it,
warm enough that a younger learner wants to come back to it.

Core tone:

- Paper-warm, calm, and trustworthy
- Refined enough for parents, friendly enough for a Grade 5 learner
- Editorial rather than gamified
- Rewarding through small earned moments, not constant noise
- Focused on speaking practice, writing revision, and visible growth

## Visual Principles

1. Treat every surface as a page in a notebook: cream paper, ink, thin lines.
2. One accent at a time. Color directs the eye, it does not decorate the page.
3. Spot illustration over mascot. Things, not faces.
4. Subtract before you add. If a card has more than three visual ideas it is
   too busy.
5. Reserve playful energy for moments that earned it — recording a take,
   crossing a score threshold, claiming a reward.
6. Children's product, not childish product. No crowns, fireworks, bokeh
   blobs, or sticker explosions.

## Color System

### Base
```
--bg            #FBF7F0   page (cream paper)
--surface       #FFFFFF   card (clean paper)
--sand          #F5EFE3   secondary surface, empty state
--ink           #1A1A1A   primary text (warmer than pure black)
--ink-soft      #6B6259   secondary text (warm grey)
--ink-faint     #A89E92   tertiary text, captions
--line          #E8DFCF   1px borders on cream
--line-soft     #F0E8D8   subtle dividers
```

### Accent
```
--accent        #C44536   warm coral — primary action, active state
--accent-wash   #FBE7E4   coral-tinted soft surface
--gold          #C49A6C   reward gold — only on reward surfaces
--gold-wash     #F4E8D8
--moss          #3F8A6B   success, progress (replaces neon green)
--moss-wash     #E6EFE8
--alert         #C44536   coral doubles as gentle warning
```

### Rules

- The accent is coral, full stop. The old `--blue/--sky/--mint/--pink/--peach/--lemon/--lilac` palette is retired.
- Gold appears **only** on reward-related surfaces (`reward-orbit`, `reward-badge`, milestone strips, prize progress).
- Pure black is forbidden. Use `--ink` for headings, `--ink-soft` for body, `--ink-faint` for captions.
- Pastel chips, gradient bars, and rainbow score bars are removed.

## Typography

### Stack
```
--font-display  "Fraunces", "Pretendard Variable", ui-serif, Georgia, serif
--font-body     "Inter", "Pretendard Variable", ui-sans-serif, system-ui, sans-serif
```

- Headings use `--font-display` with `font-variation-settings: "SOFT" 100, "opsz" 36;` for a slightly rounded, warm letterform.
- Body, labels, numerals, and UI controls use `--font-body`.
- Korean text falls back to `Pretendard Variable` automatically; both Fraunces and Inter handle Latin only.

### Scale
```
12px / 14px / 16px / 18px / 22px / 28px / 36px / 48px / 64px
```

### Weights
- 400 — body
- 500 — emphasized body, mid-weight labels
- 600 — headings, primary buttons
- 700 — display headings only (h1, hero numerals)

Weight 800 and above is **forbidden**. So is `text-transform: uppercase` combined with `letter-spacing` on body-sized text — both belong to the old "tiny-label" pattern that we are retiring.

### Tracking
- Display headings: `-0.02em`
- Body: `0`
- Numerals in score cards: `-0.01em`
- Small UPPERCASE eyebrow labels: `0.06em` (used sparingly, max one per screen)

## Shape, Border, Elevation

### Radius
```
--r-sm    8px    inputs, small chips, dense tokens
--r-md    14px   cards, tiles, message bubbles
--r-pill  999px  pills, mode pickers, status chips
```

22px+ radii are gone. Anything rounder reads as toy-like.

### Border
```
--border        1px solid var(--line)
--border-strong 1px solid #D9CFB9   focus or active card edge
```

Borders are always 1px. No 2px outlines, no double borders.

### Elevation
A single shadow token. Cards either sit flat on the page or use this one shadow — no in-between.
```
--shadow-paper  0 1px 2px rgba(20, 16, 8, 0.04),
                0 12px 24px -16px rgba(20, 16, 8, 0.10)
```

`backdrop-filter`, glassmorphism, and stacked gradient backgrounds are forbidden.

## Motion

A small vocabulary, CSS-only. Do not introduce `framer-motion`.

```
--ease   cubic-bezier(0.2, 0.8, 0.2, 1)
```

| Name           | Duration | Use                                              |
| -------------- | -------- | ------------------------------------------------ |
| `enter`        | 240ms    | tab change, panel reveal: fade + 8px translateY  |
| `count-up`     | 600ms    | score number rising to its value                 |
| `breath`       | 1400ms   | recording state: scale 1 → 1.04 → 1, infinite    |
| `granted`      | 800ms    | reward earned: scale 0.94 → 1.02 → 1 + gold glow |
| `press`        | 120ms    | button active state: translateY(1px)             |

No constant bouncing, no spinning decoration, no parallax.

## Components

### Cards
- White or cream surface, 1px solid `--line`, radius 14px.
- Shadow only when a card needs to lift off a panel below it. Default is flat.
- Internal padding: 18px (compact) or 22px (standard).

### Buttons
- Primary: solid `--accent`, white text, weight 600, radius `--r-pill` for round CTAs or 14px for in-form buttons. No drop shadow, no glow.
- Secondary: 1px `--line` border on cream, ink text. Hover lifts to `--sand`.
- Active state: `translateY(1px)` only. No depth simulation.

### Inputs & textareas
- 1px `--line` border, radius 8–10px, white interior, 14px padding.
- Focus: border `--accent`, 3px `--accent-wash` ring.
- The writing pad keeps the ruled-line background but uses warm cream lines, not blue.

### Score & metric chips
- Pill shape, transparent background, 1px `--line` border, weight 500.
- No fill color until the value crosses a milestone — then the chip switches to `--moss-wash` background.

### Recording orb
- 96–120px circle, white surface, 1px coral-tinted border.
- Inactive: still.
- Recording: `breath` animation + small coral inner dot.
- Evaluating: same breath but slower and golden.

### Reward surfaces
- The only place gold appears. Envelope/seal metaphor for prize progress.
- Reward ledger reads like a journal: date · reason · `+N` in gold.

## Per-screen Direction

### Login
Single column, generous whitespace. Display heading "Who's reading today?" then three name cards. A single spot illustration (paper plane) sits beside the heading. No quick-login pastels.

### Play home
Mobile-first single column even on desktop, max-width ~720px centered.
1. Soft greeting line.
2. **Today's letter card** — the daily prompt presented as a personal note from the tutor, with a serif quote.
3. Two mode tiles side by side (Speak / Write), each with one spot illustration.
4. One-line "last lesson" summary at the bottom.

The history rail moves into a collapsible "Earlier lessons" disclosure beneath the main column on desktop, or behind a top-bar button on mobile. The current always-visible 248px rail is removed.

### Speaking
A focused "studio" view:
- Prompt at the top in serif display.
- Centered recording orb with `breath` motion.
- Transcript appears beneath in typewriter cadence.
- Score animates in via `count-up`.
- Reference sentences are stacked cards, each tapped to hear.

### Writing
- Paper-feeling textarea (cream ruled background, ink text, serif heading above).
- Reference sentences become "sticker" cards with a 0.5° rotation and the paper shadow — collected items, not form rows.
- Revision lift is a single inline strip: `78 → 84 +6`.

### Progress
- Single sparkline in ink (or moss for the gain line). No rainbow stacked bars.
- Skills as a vertical reading list with a thin 1px meter underneath each row.

### Reward
- A wax-sealed envelope as the goal container: fills with gold-wash as progress climbs.
- Ledger as a journal: date column, reason, gold `+N`.

### Parent
Switches to a more neutral white surface (`--surface`) and `--ink-soft` text — this is the only screen where the cream warmth steps back, because parents read it as a professional report. No gold or coral decoration; data first.

## Illustration

- Use a small set of 6–8 **inline SVG spot illustrations** of objects, not characters: paper plane, notebook, fountain pen, teapot, bookmark, envelope, plant, star.
- Each illustration uses two strokes: a 1.5px `--ink` outline plus a single `--accent-wash` or `--gold-wash` fill highlight.
- One illustration per surface, max. Never as background pattern.
- UI icons: Phosphor (regular weight, 20px default).

## Implementation Notes

- Variables live in `:root` in `app/globals.css`. Adding a color outside this set is a design bug.
- Font loading uses `next/font/google` for Fraunces and Inter; Pretendard Variable is loaded via CDN as a fallback for Korean glyphs.
- The component file `components/family-tutor-app.tsx` keeps its current class names for now. Rename pass happens after the visual layer is stable.
- Class names containing `quest-`, `level-up-`, `orbit`, `cloud`, `world`, and `tiny-label` will be renamed to semantic equivalents in a follow-up pass. The CSS keeps both for one cycle to avoid breaking the running app.
