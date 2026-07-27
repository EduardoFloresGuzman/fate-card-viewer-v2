# Fate Holo Codex

An interactive holographic trading-card viewer for **Fate/Grand Order** servants — a from-scratch
recreation of the tilt/foil effect from [poke-holo.simey.me](https://poke-holo.simey.me/)
([simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css)), rebuilt around
the free, no-auth [Atlas Academy API](https://api.atlasacademy.io/docs) instead of Pokémon TCG
data.

Hover, drag, or tilt your device over a card to see its foil shift. No backend, no build-time
data — everything is fetched live from the API in the browser.

## Features

- **335+ servants**, pulled live from the Atlas Academy API, with real illustrations and stats.
- **8 selectable holo finishes** — pick "Auto (by rarity)" for a sensible default, or force any
  style from the dropdown to preview it on the whole grid:
  | Tier             | Look                                                                                                                                 |
  | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
  | Basic            | Just a soft glare — the lowest rarities                                                                                              |
  | Holo             | Classic diagonal rainbow bars                                                                                                        |
  | Cosmos           | A rotating starfield swirl                                                                                                           |
  | Radiant          | A pointer-centered light-ray burst                                                                                                   |
  | Rainbow          | Full-spectrum foil — the top rarity                                                                                                  |
  | Gold Secret      | A warm rotating gold sheen                                                                                                           |
  | Galaxy           | A hue-shifting rainbow wash                                                                                                          |
  | **Diorama (3D)** | Not a foil — splits the art into a blurred background and a floating, parallaxed character cutout for a real layered-3D pop-out look |
- **Search, class, and rarity filters.**
- **Click any card** to fetch and show its Noble Phantasm and skills live.
- **Offline-friendly**: falls back to a small bundled sample if the API is unreachable, and images
  are cached by a service worker so repeat visits don't re-download the whole roster.

## Tech stack

Vite + vanilla TypeScript — no UI framework. All the tilt/parallax/foil logic is hand-rolled CSS
custom properties driven by a `pointermove` handler (see `src/effects/pointerTilt.ts`); no
animation library runs the actual effect. Data comes straight from the Atlas Academy API with no
server in between.

## Getting started

Requires Node 20+.

```bash
git clone https://github.com/EduardoFloresGuzman/fate-card-viewer-v2.git
cd fate-card-viewer-v2
npm install
npm run dev
```

Open the printed `localhost` URL and start hovering over cards.

### Scripts

| Command             | Does                                             |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Start the dev server with hot reload             |
| `npm run build`     | Type-check and build for production into `dist/` |
| `npm run preview`   | Serve the production build locally               |
| `npm run typecheck` | `tsc --noEmit`                                   |
| `npm run lint`      | ESLint                                           |
| `npm run format`    | Prettier, writes in place                        |

## Project structure

See [`CLAUDE.md`](./CLAUDE.md) for a full architecture walkthrough, including the data layer, the
holo effect system (and the exact CSS/browser gotchas that shaped it), and the image cache. Short
version:

```
src/
├── api/          # Atlas Academy fetch/cache + the effect-tier catalog
├── effects/      # Pure pointer → tilt math + the DOM controller
├── render/       # Card/grid/detail-modal DOM construction
└── styles/       # Card frame plumbing + one CSS file per holo tier
public/sw.js      # Image-caching service worker
```

## Deployment

Static build, no server or secrets required. Deployed via
[Cloudflare Workers (static assets)](https://developers.cloudflare.com/workers/static-assets/) —
build command `npm run build`, deploy command `npx wrangler deploy` (see `wrangler.toml`).

## Status

Proof-of-concept / showcase project — fast iteration over polish-everywhere. There is currently no
automated test suite (one existed and was intentionally removed while the visual effects were
still changing rapidly; see `CLAUDE.md`).

## Credits

- Effect concept and technique: [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) / [poke-holo.simey.me](https://poke-holo.simey.me/)
- Game data and art: [Atlas Academy](https://atlasacademy.io/)
- Fate/Grand Order is a trademark of TYPE-MOON / Aniplex. This is an unofficial fan project, not
  affiliated with either.
