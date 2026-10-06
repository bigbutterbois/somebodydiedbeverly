# Design

Decisions Mike made on 2026-10-02 (light mode added 2026-10-03) for the v2 site. Every page, public or admin, follows them.

## Look

"Gallery wall": quiet and minimal so the art carries the page. It is **dark by default** and switches to a **light version when the visitor's device is in light mode** (`prefers-color-scheme`). There is no on-site toggle.

## Colors

Defined once as CSS variables in `src/app/globals.css` and exposed as Tailwind colors. Use these names instead of raw Tailwind palettes like `zinc-500`.

| Token | Tailwind class | Dark | Light | Use |
| --- | --- | --- | --- | --- |
| background | `bg-background` | `#121315` | `#fafaf8` | Page ground |
| surface | `bg-surface` | `#1a1c1f` | `#efefec` | Inputs, cards, image placeholders |
| foreground | `text-foreground` | `#e9e7e3` | `#1b1c1f` | Body text and headings |
| muted | `text-muted` | `#8e9196` | `#63666c` | Secondary text, labels, inactive nav |
| line | `border-line` | `#2a2d31` | `#dddcd8` | Dividers and borders |
| accent | `text-accent`, `bg-accent` | `#3fbfb2` | `#0f7c73` | Teal: links, the active nav item, primary buttons, focus rings |
| danger | `text-danger` | `#f07a6e` | `#c0392b` | Form errors |

Always use the tokens: they flip automatically between the two modes. A raw color or a `dark:` variant will look wrong in one of them.

Use the accent sparingly: links and one primary action per screen. Forecast charts use their own party colors, not the accent.

## Type

All sans: **Work Sans** (via `next/font/google`) for everything. Large headings use a light or regular weight with tight tracking; small uppercase labels get wide tracking (`tracking-[0.12em]`). Use `tabular-nums` wherever numbers line up.

## Logo

The **WM weave**: a teal W and a W turned upside down (the M, in the text color) drawn in the same square, so their strokes cross into a row of diamonds (`src/components/Monogram.tsx`). It is the home link in the public nav and the heading on the password page. The browser tab icon (`src/app/icon.svg`) is the same mark on a dark tile, and the link preview image (`public/og.png`) shows it above the domain. The other options (2026-10-06): https://claude.ai/artifact/XTz58PKuaVtvcUaicGm3L9

## Homepage

After the password, visitors land on a homepage that previews every public module: recent gallery pieces, latest blog posts, and the forecast. Each module renders its own block with `HomeSection` (`src/components/HomeSection.tsx`) and swaps its empty state for real items once it has data.

## Mockups

The options Mike picked from: https://claude.ai/artifact/Bpt3UYwxmjtk1wuSdSbCRU
