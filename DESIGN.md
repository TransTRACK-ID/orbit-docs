---
name: Orbit Docs
description: A restrained, content-first design system for documentation and release management workflows.
colors:
  bg: "oklch(98% 0.004 250)"
  surface: "oklch(100% 0 0)"
  fg: "oklch(20% 0.02 250)"
  muted: "oklch(55% 0.015 250)"
  border: "oklch(90% 0.006 250)"
  accent: "oklch(55% 0.16 25)"
  accent-soft: "color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent)"
  fg-soft: "color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent)"
  success: "oklch(60% 0.18 145)"
  success-text: "oklch(50% 0.14 145)"
  warning: "oklch(75% 0.14 85)"
  info: "oklch(60% 0.16 255)"
  error: "oklch(55% 0.18 25)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "\"JetBrains Mono\", \"IBM Plex Mono\", ui-monospace, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.04em"
  mono:
    fontFamily: "\"JetBrains Mono\", \"IBM Plex Mono\", ui-monospace, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  lg: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "color-mix(in oklch, oklch(55% 0.16 25) 88%, black)"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  input-default:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Orbit Docs

## Overview

**Creative North Star: "The Version Ledger"**

Orbit Docs is built for software teams in focused work sessions: editing docs, reviewing versions, publishing releases. The interface should disappear into the task. Surfaces are calm, cool, and lightly tinted; a single warm accent marks primary actions and current selection. Density is practical (tables, sidebars, forms) without clutter.

This system rejects marketing spectacle. No hero metrics, no gradient text, no decorative glass, no nested card grids. Polish lives in predictable patterns, readable prose, and fast keyboard paths.

**Key Characteristics:**

- Content-first layout with minimal chrome
- Restrained palette: cool neutrals + warm coral accent used sparingly
- System sans (Inter / native stack) with mono for labels, slugs, and data
- Flat surfaces at rest; depth via borders, tonal fills, and focus rings
- Shared primitives (`.btn`, `.input`, `.ds-table`) across admin surfaces
- Dark mode via `.dark` class on the same OKLCH token family

## Colors

A cool blue-gray neutral field with one warm signal accent. Status colors are semantic and muted, never decorative.

### Primary

- **Warm Signal Coral** (`oklch(55% 0.16 25)`): Primary buttons, active nav, outline active dots, links in reader mode, focus rings. Rare on any single screen.

### Neutral

- **Cool Mist Canvas** (`oklch(98% 0.004 250)`): App background (`--bg`), input fill.
- **Clean Sheet** (`oklch(100% 0 0)`): Cards, modals, sidebars (`--surface`).
- **Ink Slate** (`oklch(20% 0.02 250)`): Primary text (`--fg`).
- **Quiet Graphite** (`oklch(55% 0.015 250)`): Secondary text, table headers, hints (`--muted`).
- **Soft Divider** (`oklch(90% 0.006 250)`): Borders and table rules (`--border`).
- **Whisper Tint** (`color-mix(in oklch, var(--fg) 6%, transparent)`): Hover rows, ghost button hover (`--fg-soft`).

### Tertiary (semantic status)

- **Verified Green** (`oklch(60% 0.18 145)`): Published pills, success states.
- **Notice Amber** (`oklch(75% 0.14 85)`): Warnings, draft-adjacent cues.
- **Signal Blue** (`oklch(60% 0.16 255)`): Informational pills, in-review states.
- **Alert Red** (`oklch(55% 0.18 25)`): Errors, danger actions, destructive confirm.

### Named Rules

**The One Accent Rule.** The warm coral accent appears on primary actions, selection, and focus only. It must not wallpaper backgrounds, headings, or decorative chrome. If more than ~10% of a viewport reads as accent, pull back.

**The Tinted Neutral Rule.** Never use pure `#000` or `#fff`. Neutrals carry a slight cool hue (chroma ~0.004–0.02, hue ~250).

## Typography

**Display Font:** Inter / system-ui (with native fallbacks)
**Body Font:** Inter / system-ui (same stack)
**Label/Mono Font:** JetBrains Mono / IBM Plex Mono

**Character:** Neutral, legible, tool-native. No display serif. Hierarchy comes from weight and size, not font switching.

### Hierarchy

- **Display** (600, 24–32px, 1.2): Page titles in topbars and reader article titles.
- **Headline** (600, 18–22px, 1.3): Section card titles (`card-title`), modal headings.
- **Title** (600, 15–16px, 1.35): Sidebar site names, list item emphasis.
- **Body** (400, 14px, 1.5): Default UI copy, form labels, table cells. Prose in docs caps at 65–75ch in reader layouts.
- **Label** (500, 11px mono, 0.04em tracking, uppercase): Table column headers, meta labels, version stamps.

### Named Rules

**The Mono-For-Data Rule.** Slugs, timestamps, version numbers, and table headers use `--font-mono` with tabular nums. Body copy stays in the sans stack.

## Elevation

Orbit Docs is flat by default. Depth is conveyed through surface color steps (`--bg` vs `--surface`), 1px borders, and selective `color-mix` hovers. Shadows are rare and functional.

### Shadow Vocabulary

- **Focus ring** (`box-shadow: 0 0 0 3px var(--accent-soft)`): Inputs and search fields on focus.
- **Modal backdrop** (`backdrop-filter: blur(4px)` + 25% foreground scrim): Dialog overlays only.
- **Code block lift** (`0 1px 3px color-mix(in oklch, var(--fg) 8%, transparent)`): Copy buttons in reader, not general cards.

### Named Rules

**The Flat-By-Default Rule.** Cards and panels do not cast shadows at rest. Elevation appears only for modals, floating FABs, and explicit overlay layers.

## Components

### Buttons

- **Shape:** Gently rounded (8px / `--radius`).
- **Primary:** Accent fill, surface text, 8px 16px padding, 14px / 500 weight. Hover darkens accent via `color-mix(..., 88%, black)`.
- **Secondary:** Transparent fill, border `--border`, hover border shifts to `--fg`.
- **Ghost:** No border; muted text; hover uses `--fg-soft` background.
- **Danger:** `oklch(55% 0.16 25)` fill for destructive confirms.
- **Small:** 5px 11px padding, 12.5px type (`.btn-sm`).
- **Focus:** 2px accent outline, 2px offset. Disabled: 55% opacity.

### Chips / Pills

- **Style:** Inline-flex, 4px 10px padding, 11–12px semibold, full pill radius on status tags.
- **State:** Semantic soft backgrounds via `color-mix` (green published, blue draft, amber warning). Never full-saturation fills for status.

### Cards / Containers

- **Corner Style:** 12px (`--radius-lg`) for section cards and modals.
- **Background:** `--surface` on `--bg`.
- **Border:** 1px `--border`. No nested cards.
- **Internal Padding:** 18–24px for cards; 32px for main content area.

### Inputs / Fields

- **Style:** 1px border, `--bg` fill, 8px radius, 14px type.
- **Focus:** Border `--accent` + 3px `--accent-soft` ring. No default browser outline.
- **Error:** Border `oklch(55% 0.18 25)` (`.input-error`).

### Navigation

- **App sidebar:** Collapsible left rail; active item uses accent tint background. Mobile drawer below 768px with backdrop.
- **Doc reader sidebar:** 272px width, section labels at 11px muted uppercase, links 13px with 8px radius hover/active states.
- **Outline rail:** Right column "On this page" with dot active indicator in accent.

### Data Tables (`.ds-table`)

- **Panel:** Surface card with `overflow: hidden`, no outer shadow.
- **Headers:** Mono uppercase 11px, muted color.
- **Rows:** 12px 16px cell padding; hover `--fg-soft`; selected row `--accent-soft`.
- **Density:** Tuned for scan-first lists (docs, releases, feedback).

### Modals

- **Overlay:** Fixed full-screen scrim, centered dialog max-width 520–600px.
- **Dialog:** Surface fill, 24px padding, 12px radius, actions right-aligned with 8px gap.

## Do's and Don'ts

### Do:

- **Do** use semantic tokens (`--bg`, `--surface`, `--fg`, `--accent`) so light and dark modes stay aligned.
- **Do** keep primary actions as `.btn-primary` with the warm accent; secondary paths as ghost or secondary.
- **Do** use borders and tonal hovers before reaching for shadows.
- **Do** respect `prefers-reduced-motion` for app transitions (already scoped to `#__nuxt`).
- **Do** cap reader prose at comfortable line lengths and let markdown content dominate the viewport.

### Don't:

- **Don't** use marketing-heavy landing patterns with hero metrics and gradient text (per PRODUCT.md anti-references).
- **Don't** build cluttered dashboards with nested cards and excessive chrome.
- **Don't** default to generic SaaS cream-and-blue aesthetics or "AI slop" template layouts.
- **Don't** over-animate interfaces; motion must convey state, not decoration.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards or list items.
- **Don't** use `background-clip: text` gradient headings.
- **Don't** use glassmorphism or backdrop blur except on modal overlays.
- **Don't** nest cards inside cards; use spacing and dividers for inner hierarchy.
