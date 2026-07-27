---
name: refresh-fixtures
description: Regenerate src/api/fixtures/servants.sample.json, the offline fallback servant dataset used when the live Atlas Academy API is unreachable. Use when the fixture looks stale, is missing a field ServantSummary now has, or needs a different/larger sample of servants.
---

# Regenerating the offline servant fixture

`src/api/fixtures/servants.sample.json` is the array `fetchServants()` in
`src/api/atlasAcademy.ts` falls back to when the live API request fails — it must always match
the current `ServantSummary` shape exactly (see `src/api/types.ts`), including every field
(`id`, `collectionNo`, `name`, `className`, `rarity`, `atkMax`, `hpMax`, `cardArt`, `faceIcon`,
`figureArt`).

## Steps

1. Fetch the live bulk export for the fixture source data (this is a large file, ~40MB — save it
   to a scratch/temp location, not into the repo):
   ```bash
   curl -s "https://api.atlasacademy.io/export/NA/nice_servant.json" -o /tmp/nice_servant_full.json
   ```
2. Filter to the playable roster: `collectionNo > 0 && (type === "normal" || type === "heroine")`
   — matches `isPlayable()` in `atlasAcademy.ts` exactly, keep them in sync.
3. Map each to the `ServantSummary` shape (mirrors `toSummary()` in `atlasAcademy.ts`):
   `cardArt` from `extraAssets.charaGraph.ascension["1"]` (fallback to the first available
   ascension key, then to `faceIcon` if charaGraph is entirely absent), `faceIcon` from
   `extraAssets.faces.ascension["1"]`, `figureArt` from
   `extraAssets.charaFigure.ascension["1"]` (or `null` if absent — confirmed present for all
   current playable servants, but don't assume that holds forever).
4. Pick a **diverse** subset (not just the first N) — spread across all five rarities and as
   many different classes as possible, similar counts weighted toward the more common 4★/5★
   tier. ~20-25 entries is plenty. Include a few recognizable names if practical (helps sanity-
   checking things visually later).
5. Write the trimmed, diverse array as pretty-printed JSON to
   `src/api/fixtures/servants.sample.json`, sorted by `collectionNo`.
6. Run `npm run typecheck` — the fixture is imported directly in `atlasAcademy.ts` and must
   satisfy `ServantSummary[]`.
7. Delete the temporary bulk export file — don't leave a 40MB file lying around in the repo or
   scratch space longer than needed.
