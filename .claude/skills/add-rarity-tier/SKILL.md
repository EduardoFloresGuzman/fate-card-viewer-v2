---
name: add-rarity-tier
description: Add a new selectable holo/foil effect tier to the card viewer, or fix/tune how an existing one looks (wrong colors, invisible on dark/light art, ghosting, blown-out white). Use when asked to add a new card finish or improve a holo effect's visual quality.
---

# Adding or tuning a holo effect tier

This project's whole point is that the card effects look genuinely good — see the "Effect
System" section of `CLAUDE.md` first for the architecture and the specific mistakes already made
and fixed (blend-mode choice, `inherits: true` on the pointer custom properties, why
`calc(var(--pointer-x) * 1deg)` is invalid CSS). Read that before starting; don't repeat those
bugs.

## Adding a brand new tier

1. Add the tier's id to `EFFECT_TIERS` in `src/api/rarityEffects.ts`, and a display label to
   `EFFECT_TIER_LABELS` in the same file. Decide: should `rarityToEffectTier()` use it for some
   rarity by default, or is it manual-selection-only (like `radiant`/`gold`/`diorama`)? Default
   to manual-only unless the user asks for it to replace an existing rarity's look — the style
   picker is more useful with tiers the default grid doesn't already show.
2. Create `src/styles/cards/<tier>.css` and add its `@import` to `src/styles/index.css`.
3. Build the tier following the existing three-layer pattern (see any of `holo.css`/`cosmos.css`
   for reference): a main `.card__shine.effect-<tier>` rule + `::before` (both pointer-tracked,
   `opacity: calc(<baseline ~0.1-0.16> + var(--pointer-from-center) * <range>)`), and `::after`
   for ambient shimmer (no opacity needed — `base.css`'s shared `ambient-shimmer` keyframes
   handle that).
4. Add the matching `.card.is-active .card__shine.effect-<tier> { opacity: ...; }` override for
   the **main** rule only (not `::before`/`::after` — see CLAUDE.md for why).
5. **Verify on both a very bright/light card and a very dark card** before considering it done —
   pick two very different servants, force the tier via the "Holo style" dropdown, and check
   both at rest and with the pointer near a corner (drives `--pointer-from-center` toward 1, the
   effect's peak intensity).

## Fixing a tier that "looks wrong"

Diagnose by symptom:
- **Invisible / no visible change from basic**: almost always a blend-mode problem. `hue` only
  shows where the backdrop has saturation — switch to `color`. Also check the browser console
  and computed `background-image` isn't `"none"` — a `calc()` type error (e.g. percentage ×
  angle) silently drops the entire property, not just the offending term.
- **Washes out to a flat/solid color on bright art**: `color-dodge`/`hard-light` at high opacity
  with near-white gradient stops. Darken the gradient's lightest stops, lower the peak opacity
  ceiling, and/or switch to `screen` or `overlay`.
- **Barely visible on dark art**: same blend modes behave like multiply on near-black backdrops.
  `screen` is the reliable choice for "must show up regardless of backdrop."
- **Looks like a duplicated/ghosted image** (diorama tier specifically): see CLAUDE.md's note on
  `.card__art--veil` — there's no true background-only asset, so the background needs the veil
  gradient to hide its own copy of the character, not just blur.

After any change: reload, force the tier via the dropdown, check both a light and dark card, at
rest and near a corner.
