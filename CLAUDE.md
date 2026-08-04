# Fate Holo Codex — AI Developer Guide

**Read this file in full before touching any code.**

---

## What This Project Is

A holographic trading-card viewer for Fate/Grand Order servants — a from-scratch clone of the
interactive tilt/foil effect from [poke-holo.simey.me](https://poke-holo.simey.me/)
([simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css)), but sourcing
"cards" from the free, no-auth [Atlas Academy API](https://api.atlasacademy.io/docs) instead of
Pokémon TCG data. It's a showcase project — visual polish and interaction quality are the point,
not just "does it render."

**No backend.** Everything runs client-side: Vite + vanilla TypeScript, no framework. The app
fetches servant data directly from the Atlas Academy API in the browser.

---

## Project Structure

```
fate-card-viewer-v2/
├── src/
│   ├── api/
│   │   ├── types.ts            # ServantSummary, ServantDetail, RawNiceServant shapes
│   │   ├── atlasAcademy.ts     # fetchServants() / fetchServantDetail() — see Data Layer below
│   │   ├── rarityEffects.ts    # EffectTier catalog, rarity→tier mapping, class accent colors,
│   │   │                       # pickRandomEffectTier() for the home page's randomizer
│   │   └── fixtures/
│   │       └── servants.sample.json   # ~24-servant offline fallback, ServantSummary-shaped
│   ├── effects/
│   │   ├── pointerTilt.ts      # Pure computeTilt() math + TiltController (pointer/gyro → CSS vars)
│   │   ├── heroParallax.ts     # Lightweight hero-section pointer nudge — NOT TiltController, see below
│   │   ├── motionPreference.ts # prefersReducedMotion() — the one place every animation checks this
│   │   └── scrollReveal.ts     # motion `inView` → toggles `.is-visible` on `.reveal` elements
│   ├── render/
│   │   ├── card.ts             # Builds one card's DOM (incl. the two-layer diorama variant)
│   │   ├── cardGrid.ts         # Renders/replaces a grid of cards, owns TiltController lifecycle
│   │   ├── detailModal.ts      # Click-to-expand skill/NP detail panel (live per-servant fetch)
│   │   └── format.ts           # classLabel/starString/effectClassName display helpers
│   ├── pages/
│   │   ├── home.ts             # Hero + randomizer ("Pull a Servant") — see Routing & Pages below
│   │   └── gallery.ts          # The filterable grid (search/rarity/class/effect)
│   ├── styles/
│   │   ├── base.css            # Tokens, reusable chrome utilities, card frame/tilt/glare plumbing
│   │   ├── nav.css              # Shared site nav bar
│   │   ├── home.css             # Hero layout + floating decorative icons
│   │   ├── index.css           # Aggregates base/nav/home.css + every cards/*.css
│   │   └── cards/
│   │       ├── holo.css, cosmos.css, radiant.css, rainbow.css, gold.css, galaxy.css
│   │       │                   # One file per color-foil effect tier (see Effect System below)
│   │       └── diorama.css     # The 3D parallax tier — structurally different, see below
│   ├── router.ts               # Hash-based two-route router (home/gallery) — see below
│   ├── servantStore.ts          # Shared, load-once roster fetch both pages subscribe to
│   ├── randomPull.ts             # Pure: pick a random servant + effect tier + ascension stage
│   ├── main.ts                 # Composition root: nav shell, font import, router wiring
│   └── registerServiceWorker.ts
├── public/
│   ├── favicon.svg
│   └── sw.js                   # Image-caching service worker (plain JS, not part of the TS build)
├── index.html
└── (config: vite via tsconfig.json/eslint.config.js/.prettierrc.json — no test tooling right now)
```

---

## Data Layer (`src/api/atlasAcademy.ts`)

- `fetchServants(region)` hits the **nice** bulk export
  (`/export/{region}/nice_servant.json` — ~40MB raw, ~5MB gzipped over the wire), not the
  lighter _basic_ export, because only _nice_ carries `extraAssets.charaGraph` /
  `extraAssets.charaFigure` (see Effect System). The response is immediately trimmed down to
  `ServantSummary` (~100KB for the whole roster) and **only the trimmed summary is cached** —
  the multi-MB raw payload never touches `localStorage`.
- Cache key: `fgo-card-viewer:servants:{region}:v{CACHE_VERSION}`. **Bump `CACHE_VERSION`** in
  `atlasAcademy.ts` any time `ServantSummary`'s shape changes, or existing users' stale cached
  JSON will silently miss new fields.
- On any fetch failure, falls back to the bundled `fixtures/servants.sample.json` — the app
  never hard-fails to load _something_.
- `cardArtByAscension`/`figureArtByAscension` are arrays (charaGraph ships 4 ascension stages,
  charaFigure only 3), not single URLs — see the per-ascension art selector note under Effect
  System below. Use the [refresh-fixtures](.claude/skills/refresh-fixtures/SKILL.md) skill to
  regenerate the offline fixture if this shape changes again.
- `fetchServantDetail(id, region)` is a separate, uncached, on-demand call (only fired when a
  card's detail modal is opened) — the bulk summary deliberately excludes skills/NP data to keep
  it small.
- Filtering: playable roster = `collectionNo > 0 && type in ("normal", "heroine")` — confirmed
  against the live API to exclude enemy-only and unreleased entries.

---

## Routing & Pages (`src/router.ts`, `src/servantStore.ts`, `src/pages/`)

Two routes, **hash-based** (`#/` home, `#/gallery` gallery) — deliberately not the History API.
A hash fragment never reaches the server, so `wrangler.toml`'s static-asset config needs zero
changes for deep links/hard refreshes to work, and back/forward/`hashchange` all work natively
with no click-interception code. `router.ts` maps `location.hash` → `Route`, defaulting unknown
hashes to `"home"`.

Both pages implement the same contract: `render(mount: HTMLElement): () => void` — build your DOM
into `mount`, return a teardown callback. `main.ts` (the composition root) owns exactly one active
page at a time: on every route change it calls the outgoing page's teardown, then the incoming
page's `render(outlet)`.

**`servantStore.ts`** is the single place the servant roster is fetched — `loadRosterOnce(region)`
is idempotent (safe to call from `main.ts` once at boot; the underlying `fetchServants()` call only
ever fires once), `subscribeRoster(listener)` calls back immediately with the current state and
again on every change, and `retryRoster(region)` re-runs the fetch for the error state's "try
again" button. Neither page calls `fetchServants()` directly — this is what lets Home and Gallery
share one fetch without either page needing to know about the other.

**`home.ts`** — the "Pull a Servant" randomizer. `randomPull.ts`'s `pickRandomPull(servants)` picks
a uniformly random servant, a random non-`"basic"` effect tier (`pickRandomEffectTier()` in
`rarityEffects.ts` — `"basic"` renders no shine at all, which would make some pulls feel like
nothing happened), and a random ascension stage. The result renders via the _same_
`renderCardGrid()` gallery uses, called with a one-element array and a `.card-grid--hero` CSS
modifier for the bigger centered presentation — this gets the exact same `TiltController`
create/destroy cleanup gallery relies on for free (its `WeakMap<container, CardHandle[]>` already
tears down the previous card before mounting the next one, so every "Pull Again" click is
automatically safe with zero new bookkeeping). `createCard()` takes an optional 4th
`initialAscension` param (default `1`, so gallery's call site is unaffected) so the hero card can
open on the randomly-picked stage instead of always ascension 1.

---

## Effect System (`src/api/rarityEffects.ts` + `styles/cards/*.css`)

Every card renders with one `EffectTier`: `basic | holo | cosmos | radiant | rainbow | gold |
galaxy | diorama`. `resolveEffectTier(selection, rarity)` picks the tier — `"auto"` (the default)
maps rarity → tier via `rarityToEffectTier`; picking a specific tier in the UI's "Holo style"
dropdown forces it on every card regardless of rarity. `radiant`, `gold`, and `diorama` are
**manual-selection only** — deliberately not used by `rarityToEffectTier` — so the picker always
has something the default grid view doesn't show.

### Adding or tuning a color-foil tier (holo/cosmos/radiant/rainbow/gold/galaxy)

Each is a `styles/cards/<tier>.css` file targeting `.card__shine.effect-<tier>` with up to three
layers:

- The **main rule** and its `::before` — pointer-tracked, opacity driven by
  `calc(<baseline> + var(--pointer-from-center) * <range>)`. Keep baseline low (~0.1–0.16) and
  the range large — a high baseline makes cards look permanently tinted at rest.
- `::after` — pure ambient shimmer (opacity animated by the shared `ambient-shimmer` keyframes in
  `base.css`), not pointer-tracked. This is what makes cards feel alive before you touch them.

**Hard-won lessons, don't repeat these:**

- **Blend mode choice matters more than opacity.** `color-dodge`/`hard-light` blow bright
  artwork out to solid white fast and barely tint near-black artwork at all (they degrade to
  screen/multiply-like behavior at the extremes). `screen` reliably shows on dark art without
  destroying light art; `hue` only shows where the backdrop already has saturation — use `color`
  instead for a blend that's visible on desaturated art too.
- **Always check both a very bright/light card AND a very dark card** before calling a tier done
  — an effect tuned against one look wrong on the other, in different ways.
- The **main element** needs an explicit `.card.is-active .card__shine.effect-<tier> { opacity:
... }` override matching its base rule — `base.css`'s generic `.card.is-active .card__shine {
opacity: 1; }` has higher specificity than a bare `.card__shine.effect-<tier>` and will
  override it otherwise. `::before`/`::after` don't need this (base.css has no active-state rule
  targeting pseudo-elements).
- `--rotate-x`, `--rotate-y`, `--pointer-x`, `--pointer-y`, `--pointer-from-center`,
  `--pointer-angle` are all registered `inherits: true` in `base.css` — they're set on `.card`
  by `TiltController` but read by `.card__shine`/`.card__glare` **children**, and a
  non-inheriting custom property is invisible to children (silently resolves to its
  `initial-value` instead of throwing, so this fails silently, not loudly).
- CSS `calc()` **cannot multiply a `<percentage>` by an `<angle>`** — conic-gradient tiers that
  need to rotate with `--pointer-x` use the precomputed `--pointer-angle` (set in
  `pointerTilt.ts`'s `applyTilt()`, `pointerX * 3.6` converted to `deg` in JS) instead of trying
  `calc(var(--pointer-x) * 1deg * 3.6)`, which is invalid and silently drops the _entire_
  `background-image` declaration (not just that one function) — this reads as "the effect does
  nothing" with no console error.

### The `diorama` tier (`styles/cards/diorama.css`) — different architecture

Not a color-foil overlay — a real two-layer 3D parallax. `card.ts`'s `renderArt()` special-cases
this tier: instead of one `<img class="card__art">`, it builds
`bg (<img>, charaGraph) → veil (div) → fg (div, charaFigure background-image)`, each moving
independently with the pointer (fg shifts more than bg — the depth cue).

- **charaFigure is a sprite atlas, not a clean cutout.** Atlas Academy packs it as a
  standardized 1024×1280 canvas: the full-body transparent character fills the **top 768px**,
  with a grid of face-expression icons below. Confirmed across 4+ very different servants/poses
  — this ratio is fixed by the asset pipeline, not content-dependent. The crop is pure CSS: give
  `.card__art--fg` `aspect-ratio: 1024/768` and `background-size: 100% auto` — the image scales
  to the container's width, and since both scale off the same width, the natural (taller) height
  overflows the container and gets clipped, showing exactly the top 60%. No per-servant tuning.
- **There is no background-only asset.** `charaGraph` is the character _and_ the scene painted
  as one image — using it as the background layer means it contains its own copy of the
  character. A heavy blur alone either still shows a recognizable "ghost" duplicate (too light)
  or hides the real scenery along with it (too heavy). `.card__art--veil` — a radial gradient,
  opaque in the center fading to transparent at the edges — sits between bg and fg and darkens
  specifically the middle of the frame (where the duplicate stands) while leaving the edges
  (architecture, sky) legible.
- **The fg layer is intentionally oversized** (`width: 180%`, recentered via `left: -40%`) so the
  character reads as filling the card rather than floating small in the middle of it. Because of
  that size, even a modest parallax `translate()` is a large absolute pixel shift — the
  `transform` factors are deliberately small (`0.08`/`0.035`) and `top` has real buffer (`3%`).
  **If you touch these numbers, re-verify all four extreme corners of the pointer range** (not
  just center-ish hover) — this is exactly where a too-large shift or too-small buffer pushes the
  character's head past the card's `overflow: hidden` top edge. It won't show at rest or at
  gentle angles, only at the extremes.
- Falls back to the normal single-image layout automatically if the servant has no
  `figureArtByAscension` entries at all (charaFigure is confirmed present for all 412 current
  playable servants, but treat it as optional — don't assume future roster additions will have it).

### Per-ascension art selector

Every card that has more than one `cardArtByAscension` entry gets a small `1`/`2`/`3`/`4`
picker (`.card__ascension-bar`) overlaid top-right, built in `createCard()`. Clicking a stage
button calls `renderArt(artWrap, servant, effectTier, stage)` again — it's a fully re-callable
function that clears and rebuilds whatever's inside `artWrap`, so it works identically for the
single-image and diorama layouts. **charaGraph reliably has 4 ascension stages; charaFigure only
ships 3** — `renderArt()` clamps the figure index with
`Math.min(ascension, figureArtByAscension.length) - 1` so picking ascension 4 in the diorama tier
reuses ascension 3's cutout rather than erroring or going blank. Ascension buttons call
`event.stopPropagation()` since they sit on top of the card's own click-to-open-detail handler.

---

## Pointer Tilt (`src/effects/pointerTilt.ts`)

`computeTilt(rect, clientX, clientY)` is a pure function (rect only needs 4 numeric fields, not a
real `DOMRect`) — keep it that way, it's what makes the tilt math trivially testable if/when tests
come back.

`TiltController` takes **two elements**: `hitTestElement` (listens for pointer events) and
`styleElement` (gets the CSS custom properties + `is-active` class). These must be different —
`card.ts` passes `frame` (the never-transformed `.card-frame` wrapper) and `card` (the element
that actually rotates in 3D). If you ever wire a new tilting element, do NOT listen on the element
being transformed: hit-testing follows the element's _rendered_ (post-transform) geometry, so a
listener on the rotating element chases its own tail — as it tilts away from the pointer it
appears to "leave" itself, firing `pointerleave`, snapping back to neutral, re-entering, forever.
This is a real bug that was shipped and caught, not a hypothetical.

---

## Design System (`styles/base.css` tokens/utilities, `styles/nav.css`, `styles/home.css`)

The page chrome (nav, hero, buttons, eyebrow labels) is a separate visual layer from the holo-card
effect system above — inspired by [inkgames.com](https://inkgames.com/)'s bold black/white
marketing-site look, not by poke-holo.simey.me. Stays **monochrome outside the cards**: the
existing brand gradient (`--accent-gold`/`--accent-pink`/`--accent-blue`, tokenized in `base.css`)
is the one accent, used sparingly (CTA fills, active-nav-link underline, the eyebrow bullet) — the
holo cards themselves are still the only place color explodes.

- **`--font-display: "Anton", ...`** — a free (SIL OFL), self-hosted (`@fontsource/anton`) heavy
  condensed grotesk, used **only** for the hero H1/section headings, never eyebrows/nav/body text
  (it reads clunky at small sizes). Imported as a side-effect import in `main.ts`
  (`@fontsource/anton/latin-400.css`), not a Google Fonts `<link>` — keeps the project's existing
  no-external-runtime-deps posture (image cache SW, no calls beyond the Atlas Academy API).
  inkgames' own display face, `RuderPlakatLL`, is a **paid Lineto license — never use or embed it**.
- **`.eyebrow`**, **`.btn`/`.btn--primary`/`.btn--secondary`**, **`.reveal`/`.reveal.is-visible`** —
  reusable utilities in `base.css`. `.reveal` is wired up by `scrollReveal.ts` (`motion`'s `inView`,
  not a hand-rolled `IntersectionObserver` — unlike the tilt math, this is a generic solved problem
  and `motion` was already an installed, unused dependency).
- **Home hero's floating decorations** (`home.css`, `home.ts`) are this app's own `faceIcon`
  thumbnails (real servant data, randomly sampled each load) — **not** copies of inkgames' actual
  icon art (their proprietary game assets). Placement is fixed/hand-authored CSS
  (`.hero__float:nth-of-type(n)`); only _which_ servants appear is randomized in JS. Idle motion is
  a CSS keyframe; the pointer-follow nudge is `heroParallax.ts` — a deliberately tiny, separate
  sibling to `TiltController`, not a reuse of it (one pair of shared `--hero-pointer-x/y` custom
  properties on the hero container, no rotation, no per-card math).

**Hard-won lesson — never gate a functional step behind an animation's promise.** The Home⇄Gallery
route crossfade originally did `animate(outlet, {opacity:[1,0]}).then(() => { swap(); animate(...) })`
— i.e. the actual page swap waited for the fade-out animation to finish. This hung _forever_ in one
real test environment: `motion`'s `animate()` resolves via the Web Animations API, and a WAAPI
`.finished` promise does not resolve while its tab/pane isn't visible/compositing (confirmed
directly — a bare `el.animate(...).finished` call hung 30+ seconds under that condition). The same
class of freeze can happen in a real browser too (a user alt-tabbing away mid-click), not just in a
test sandbox. Fixed by making the swap **always synchronous** — `teardownCurrentPage?.(); render()`
runs immediately on every route change — and demoting the crossfade to a fire-and-forget
`animate()` call _after_ the swap that nothing else depends on. Apply this rule to any future
animation: if code after an `animate()`/`inView()` call needs to run for the app to keep working,
don't put it in a `.then()` — run it first, animate second.

---

## Image Cache (`public/sw.js`)

A cache-first service worker for `static.atlasacademy.io` requests only — the app-shell/API JSON
calls pass through untouched. Registered from `src/registerServiceWorker.ts`, called once at the
top of `main.ts`.

**Don't gate caching on `response.ok`.** Most image requests here are `<img>`/`background-image`
loads with no `crossorigin` attribute, so the browser fetches them in `no-cors` mode — the
service worker sees an **opaque** response (`status` always `0`, `ok` always `false`, body
unreadable) even on a successful load. Gating `cache.put()` on `response.ok` silently caches
nothing, ever, with no error. Opaque responses are fully cacheable and replayable — just cache
unconditionally and only skip on a thrown (network) error. `card.ts`/`detailModal.ts` still set
`crossOrigin = "anonymous"` on the `<img>` elements where possible (not possible for the
`diorama` tier's `background-image`-based fg layer) so those specific responses are genuine,
introspectable `cors` responses rather than opaque ones.

Cache name is versioned (`fgo-image-cache-v1`); `activate` deletes any other
`fgo-image-cache-*` cache, so bumping the version number is how you'd force a clean slate if the
CDN ever reorganizes URLs.

---

## Testing

**There is currently no test suite.** One was built (Vitest unit tests + Playwright E2E) and then
deliberately removed to keep the codebase lean while the visual effects were still being
iterated on rapidly — tests will be reintroduced once the effect system stabilizes. Don't add
test files back in without checking with the user first; when tests do come back, re-add
`vitest`/`@playwright/test`/`jsdom` as devDependencies, restore `test`/`test:e2e` scripts, and
put the CI test steps back in `.github/workflows/ci.yml`.

---

## Running Locally

```bash
npm install
npm run dev        # http://localhost:5173 (or next free port)
npm run typecheck
npm run lint
npm run format      # prettier --write .
npm run build       # tsc && vite build → dist/
npm run preview     # serve the production build locally
```

No `.env` needed — the Atlas Academy API requires no key and has open CORS.

---

## Verifying Visual Changes — Don't Trust a Single Screenshot

This app's whole value is the interaction quality, and the CDN (`static.atlasacademy.io`) has
been observed to be slow/flaky under heavy repeated testing in some environments — a screenshot
taken mid-load can look "broken" (partial image, wrong size, apparent ghosting) when the code is
actually fine and the image just hadn't finished loading yet. Before concluding an effect is
buggy:

1. Check `img.complete` / `img.naturalWidth` (or wait a few seconds and re-screenshot) before
   trusting a "broken-looking" render.
2. If the CDN seems unreliable in-session, build a small standalone HTML file referencing
   already-downloaded local images (bypassing the CDN and the app entirely) to isolate whether
   an issue is in the CSS/JS or in network conditions. This has been the fastest way to get a
   reliable answer when the live app is misbehaving for unclear reasons.
3. Test effects against both a very bright/light card and a very dark card — several bugs here
   only showed up on one or the other.
4. For anything involving `TiltController`/parallax, explicitly test pointer positions near all
   four corners of a card, not just a gentle hover near center — clipping and edge-case math
   errors mostly show up only at the extremes.
5. If something that should have finished animating/transitioning appears "stuck" (a CSS
   transition sitting at its start value, an `animate()` call whose `.then()` never fires), check
   whether the pane is actually visible/compositing before assuming it's a code bug — confirmed
   directly in this project that CSS transitions and WAAPI-backed `animate()` calls both stall
   indefinitely on a non-compositing tab. Test with a raw `el.animate(...).finished` promise (or
   just read the _synchronous_ state your code produced — e.g. did the DOM actually swap, ignoring
   whether the fade looks right) rather than concluding the feature is broken.

## Deployment

Static build (`npm run build` → `dist/`), no server/secrets required. Deployed to **Cloudflare
Workers static assets** (not Pages) — `wrangler.toml` sets `[assets] directory = "./dist"`. No Git
integration/auto-deploy is configured; redeploying after a change is a manual
`npx wrangler deploy` (or the equivalent manual trigger in the Cloudflare dashboard's Deployments
tab) — requires Node.js v22+ locally for the Wrangler CLI.

## Git Workflow

Solo project — no `develop`/`main` split needed. Commit directly to `main` with conventional
commit messages (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`), one concise imperative subject
line. Ask before pushing to a remote or creating a GitHub repo.
