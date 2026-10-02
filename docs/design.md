# Design

Decisions Mike made on 2026-10-02 for the v2 site. Every page, public or admin, follows them.

## Look

"Gallery wall, after dark": quiet and minimal so the art carries the page, rendered **dark only**. There is no light mode and no theme toggle.

## Colors

Defined once as CSS variables in `src/app/globals.css` and exposed as Tailwind colors. Use these names instead of raw Tailwind palettes like `zinc-500`.

| Token | Tailwind class | Value | Use |
| --- | --- | --- | --- |
| background | `bg-background` | `#121315` | Page ground |
| surface | `bg-surface` | `#1a1c1f` | Inputs, cards, image placeholders |
| foreground | `text-foreground` | `#e9e7e3` | Body text and headings |
| muted | `text-muted` | `#8e9196` | Secondary text, labels, inactive nav |
| line | `border-line` | `#2a2d31` | Dividers and borders |
| accent | `text-accent`, `bg-accent` | `#3fbfb2` (teal) | Links, the active nav item, primary buttons, focus rings |
| danger | `text-danger` | `#f07a6e` | Form errors |

Use the accent sparingly: links and one primary action per screen. Forecast charts use their own party colors, not the accent.

## Type

All sans: **Work Sans** (via `next/font/google`) for everything. Large headings use a light or regular weight with tight tracking; small uppercase labels get wide tracking (`tracking-[0.12em]`). Use `tabular-nums` wherever numbers line up.

## Logo

The **SDB monogram**: "SDB" in light-weight Work Sans inside a thin outlined box (`src/components/Monogram.tsx`). It is the home link in the public nav and the heading on the password page. The browser tab icon (`src/app/icon.svg`) is the same mark with a teal box.

## Homepage

After the password, visitors land on a homepage that previews every public module: recent gallery pieces, latest blog posts, and the forecast. Each module renders its own block with `HomeSection` (`src/components/HomeSection.tsx`) and swaps its empty state for real items once it has data.

## Mockups

The options Mike picked from: https://claude.ai/artifact/Bpt3UYwxmjtk1wuSdSbCRU
