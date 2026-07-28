# Atlas Academy API Reference (for future feature planning)

This is a planning reference, not an integration guide for what's already built. It exists so a
future session can skim "what's possible" without re-discovering the API from scratch. Every claim
below traces back to a live `curl` request made by a research agent against `https://api.atlasacademy.io`
— items are marked **verified** or **not verified / uncertain** throughout; nothing here is smoothed
over into confident prose the findings didn't support.

## What this API is

[Atlas Academy](https://atlasacademy.io/) runs a free, no-auth, open-CORS JSON API
(`api.atlasacademy.io`) that exposes the entire relational game-data graph of Fate/Grand Order,
resolved and joined from the game's internal master tables. Full interactive docs (Swagger/OpenAPI
UI): **https://api.atlasacademy.io/docs**. The raw OpenAPI 3 spec is served at
**https://api.atlasacademy.io/openapi.json** (670,103 bytes, verified) — note it is at the site
root, _not_ at `/export/openapi.json` (that path 404s, verified).

**How this project uses it today** (from `src/api/atlasAcademy.ts` / `CLAUDE.md`, for orientation
only — not part of the research findings): the app fetches the bulk `nice` export
(`/export/{region}/nice_servant.json`, ~40MB raw / ~5MB gzipped) rather than the lighter `basic`
export, specifically because only `nice` carries `extraAssets.charaGraph` / `extraAssets.charaFigure`,
the two image layers the holo-card effect is built on. The response is trimmed down client-side to a
small `ServantSummary` shape. On fetch failure it falls back to a bundled fixture
(`src/api/fixtures/servants.sample.json`). `static.atlasacademy.io` asset requests are cached by a
service worker; no API key is needed and CORS is open.

Everything below is organized by _what you might want to build next_, since that's the more useful
lens when you come back to plan a feature — with the raw endpoint patterns included for when you get
to implementation.

---

## 1. Deeper servant data (beyond name/class/rarity/extraAssets)

The `nice` servant schema is far richer than what `ServantSummary` currently uses. Verified via
`GET /nice/NA/servant/100100?lore=true` (Altria Pendragon): **136,188 bytes, 62 top-level keys** (the
response byte size is exactly right; the key count was miscounted — a fresh `Object.keys()` count on
the identical byte-for-byte response returns 62, not 60).

### Schema tiers (all verified)

| Schema           | Size (servant 100100) | What it is                                                                                                                                                                                                                                                                                     |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basic`          | 1,232 bytes           | Lightweight projection: id, collectionNo, name, type, flags, classId/className, attribute, full `traits[]`, rarity, atkMax, hpMax, `face` icon URL, owned `costume` list. Good for roster/list views.                                                                                          |
| `nice` (no lore) | 108,300 bytes         | Everything except `profile.comments`, `profile.voices`, and the four material dicts.                                                                                                                                                                                                           |
| `nice?lore=true` | 136,188 bytes         | Adds bond-gated lore text, full voice-line lists (real MP3 URLs + subtitles), and `ascensionMaterials`/`costumeMaterials`/`skillMaterials`/`appendSkillMaterials`.                                                                                                                             |
| `raw`            | 62,024 bytes          | Unresolved internal `mst*` master tables (mstSvt, mstSkill, mstSvtCard, mstSvtChange, mstSvtLimit, mstFriendship, mstGift, mstItem, ~30 tables total). IDs are **not** joined into names the way `nice` does — smaller than `nice`+lore despite being "rawer". Not a practical UI data source. |

### Endpoints

| Pattern                                    | Verified | Notes                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/nice/{region}/servant/{id}?lore=true`    | ✅       | Full record, 62 top-level keys.                                                                                                                                                                                                                                                                                                                                                                                     |
| `/nice/{region}/servant/{id}`              | ✅       | Same minus lore-gated fields.                                                                                                                                                                                                                                                                                                                                                                                       |
| `/basic/{region}/servant/{id}`             | ✅       | Lightweight projection.                                                                                                                                                                                                                                                                                                                                                                                             |
| `/raw/{region}/servant/{id}`               | ✅       | Unresolved master tables.                                                                                                                                                                                                                                                                                                                                                                                           |
| `/nice/{region}/servant/search?{filters}`  | ✅       | 15+ filters: `name`, `illustrator`, `cv`, `rarity[]`, `className[]`, `gender[]`, `attribute[]`, `trait[]`/`notTrait[]`, `profileContains` (free-text lore search), `lang`, `voiceCondSvt[]`, `excludeCollectionNo[]` (defaults `[0]`), `type[]`, `flag[]`. Confirmed live: `?className=saber&rarity=5&gender=female` → 11 servants; `?cv=Ayako%20Kawasumi` → 16 servants (all of Altria's alter-egos share her VA). |
| `/basic/{region}/servant/search?{filters}` | ✅       | Same filters, lightweight records. Good for a fast filtered grid that drills into `nice` on click.                                                                                                                                                                                                                                                                                                                  |
| `/raw/{region}/servant/search?{filters}`   | ✅       | **Hard-capped at 100 results** — unfiltered `?rarity=5` returns HTTP 403 `"More than 100 items found. Please narrow down the query."`                                                                                                                                                                                                                                                                               |
| `/export/{region}/nice_servant.json`       | ✅       | Bulk, no-lore export of all servants (~44,334,039 bytes / 423 entries for NA). Build-time/fixture use only — this is exactly what `refresh-fixtures` already targets. **Does not include lore data** (voices/comments) at all.                                                                                                                                                                                      |

### Notable fields (all verified on servant 100100 unless noted)

- **`atkGrowth` / `hpGrowth`** — exact ATK/HP at every level (120-entry arrays incl. grail levels). No formula needed.
- **`expGrowth` / `expFeed`** — cumulative XP to reach each level / XP granted when fed as a leveling material.
- **`cost`** (party deploy cost) / **`growthCurve`** — `growthCurve` is an opaque internal integer id with **no decode endpoint anywhere in the spec**; treat as a grouping key only, use the growth arrays directly instead.
- **`traits[]`** (full array, available even on `basic`) — every gameplay trait tag, e.g. `dragon`, `riding`, `weakToEnumaElish`, `king`. Drives NP-vs-trait and skill-targeting interactions game-wide.
- **`traitAdd`** — time-boxed extra traits with `startedAt`/`endedAt` (unix seconds), tied to specific events — traits are not always static.
- **`cards` + `cardDetails`** — 5-slot command-card deck + per-card-type hit-count breakdown and `attackIndividuality` (physical vs magical).
- **`classPassive` / `extraPassive` / `appendPassive`** — innate class skills, event-scoped bonus passives, and the 5-slot Append Skill system (with `unlockMaterials`).
- **`skills[].functions[].buffs` / `svals`** — the entire numeric buff engine, level-indexed. See §2 below for the full mechanics model.
- **`skills[].skillSvts`** — every other servant sharing this exact skill object, revealing skill-sharing across alt-classes/costumes.
- **`noblePhantasms[]`** — `rank`, `type` (free-text category), `card`, `npGain` (per-card-type charge %), `npDistribution`, `individuality`, and `npSvts` (per-ascension damage multipliers).
- **`releaseConditions`** — gates hiding an NP/skill variant until a story quest is cleared. Confirmed example: Tomoe Gozen NP gated on `questClear` id 91202101.
- **`svtChange`** — alternate "true name" battle forms for spoiler-sensitive characters. Confirmed present on **11 of 423 NA servants** (Tomoe Gozen → "Archer of Inferno", James Moriarty, Christopher Columbus [2-stage], Scheherazade, Circe).
- **`ascensionAdd`** — per-ascension/costume overwrite table (name, stats, traits, etc.). Universal case: `lvMax.ascension` rises per stage. Rarer case: Barghest's first ascension displays as "Tam Lin Gawain" — a genuine identity-hiding overwrite.
- **`ascensionMaterials` / `costumeMaterials` / `skillMaterials` / `appendSkillMaterials`** — full resolved cost tables (items + QP) for every upgrade path.
- **`bondGrowth` / `bondEquip(s)` / `bondGifts` / `coin`** — bond XP thresholds, bond-locked Craft Essences, per-level reward items, and the servant's unique "Coin" item used to unlock Append Skills.
- **`valentineEquip` / `valentineScript`** — Valentine-event CE id(s) and a pointer to the actual story script text for that scene.
- **`profile.cv` / `profile.illustrator` / `profile.stats`** — voice actor, artist, and the game's own letter-grade stat sheet (Strength/Endurance/Agility/Magic/Luck/NP, alignment, deity).
- **`profile.comments`** — full lore text, each entry gated by `condType` (usually `svtFriendship` + a bond-level `condValues`). **The API returns all of it regardless of the in-game bond gate** — no spoiler protection server-side.
- **`profile.voices`** — full voice-line browser data (24 `NiceSvtVoiceType` categories total). Real subtitle text + working MP3 `audioAssets`. See §3 for details.
- **`instantDeathChance` / `starAbsorb` / `starGen`** — fixed combat stats.
- **`script`** (top-level) — rare per-servant AI/battle flags. Confirmed non-empty on only **2 of 423** NA servants.
- **`battlePoints`** — rare special gauge mechanic. Confirmed on only **1 of 423** (Ereshkigal's "Devotion Gauge").
- **`flag` / `flags` / `relateQuestIds` / `trialQuestIds`** — record classification + linked Interlude/Rank-Up/Trial quest ids.
- **`limits[]`** — per-ascension-stage flattened stat snapshot (rarity/lvMax/hp/atk/criticalWeight + stat letter grades).
- Live OpenAPI enums confirmed: `SvtClass` (70+ values incl. story-only classes), `Attribute` (`none/default/human/sky/earth/star/beast/void`) — 8 values; the live `Attribute` enum in the OpenAPI spec includes `beast`, which this list omitted, `NiceGender` (`male/female/unknown`).

### Feature ideas

- Exact "servant at level N" stat calculator straight from `atkGrowth`/`hpGrowth`/`expGrowth` — no formula.
- Skill/NP damage-and-buff simulator from `functions[].svals` and `noblePhantasms[].npGain`/`npSvts`.
- In-app voice-line browser/soundboard from `profile.voices`.
- Ascension/skill-up material planner aggregating the four material dicts into a shopping list with real item icons and QP totals.
- Advanced roster search UI backed by `/servant/search` (class, attribute, gender, rarity, trait/notTrait, illustrator, VA, free-text lore search).
- Trait-based team-planning tool (e.g. "show all Dragon-trait servants").
- Bond-progression tracker (`bondGrowth`, `bondGifts`, `bondEquip`).
- Optional "story spoiler mode" toggle gating `profile.comments` by their own `condValues`, and hiding `svtChange`/identity-hiding `ascensionAdd` overwrites unless explicitly enabled — since the API exposes all of it unconditionally.
- Costume gallery surfacing `ascensionAdd` overwrite data (e.g. Barghest's alternate battle name) alongside existing `charaGraph`/`charaFigure` art.
- Lightweight roster grid on `basic` (1.2KB/servant), drilling into `nice?lore=true` only on selection.

### Caveats

- `growthCurve` cannot be decoded — no lookup endpoint exists in the spec.
- `svtChange`, `releaseConditions`, and identity-hiding `ascensionAdd` overwrites are real but rare (11/423, 2/423, 1/423 respectively) — build a generic renderer that no-ops on empty data rather than dedicated UI for a handful of characters.
- `raw` is not a superset of `nice` — it's unjoined master tables, and its `/search` hard-caps at 100 results (403 confirmed). Keep using `nice` as the data source.
- `profile.comments` has no server-side bond-level spoiler gating — client-side gating is on you if that matters.
- No rate-limit response headers observed on any verified call; `nice` responses send `Cache-Control: no-cache` — no server caching contract, which reinforces relying on this app's existing client-side cache.
- `lore=true` roughly doubles single-servant payload size (108KB → 136KB) and is **absent from the bulk export entirely** — a lore-dependent feature (voices, comments, materials) needs one request per servant, not one bulk fetch.

---

## 2. Skill / Noble Phantasm effect-mechanics model

Every skill and NP is exposed as an ordered list of `functions` — effectively FGO's internal
battle-engine data, not prose. This is deep enough to build a real damage calculator, and it's all
independently queryable (not just embedded in servant records).

### Endpoints

| Pattern                                                                                            | Verified | Notes                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/nice/{region}/servant/{id}`                                                                      | ✅       | Already contains full `skills[]`/`classPassive[]`/`extraPassive[]`/`appendPassive[]`/`noblePhantasms[]` inline. Servant 100100: 5 skills, 2 classPassives, 14 extraPassives, 5 appendPassives, 2 NPs (ids 100101/100102). |
| `/nice/{region}/skill/{skill_id}`                                                                  | ✅       | Standalone skill object, same shape as a servant's `skills[]` entry.                                                                                                                                                      |
| `/nice/{region}/skill/search`                                                                      | ✅       | Filters: `name`, `type`, `num`, `priority`, `strengthStatus`, `lvl1coolDown`, `numFunctions`, `svalsContain` (substring match inside raw svals!), `triggerSkillId`, `reverse`/`reverseData`.                              |
| `/nice/{region}/NP/{np_id}`                                                                        | ✅       | Standalone NP object. **NP ids are not servant ids** — a guessed id (1000100) returned `{"detail":"NP not found"}`; must read the real id off `servant.noblePhantasms[].id` first.                                        |
| `/nice/{region}/NP/search`                                                                         | ✅       | Filters: `name`, `card`, `individuality`, `hits`, `strengthStatus`, `numFunctions`, `minNpNpGain`/`maxNpNpGain`, `svalsContain`, `triggerSkillId`.                                                                        |
| `/nice/{region}/function/{func_id}`                                                                | ✅       | Standalone function object.                                                                                                                                                                                               |
| `/nice/{region}/function/search?...`                                                               | ✅       | Filters incl. `tvals` (trait, by name or id). Confirmed: `?tvals=divine` → 12 real functions incl. an `instantDeath` "Divine-only Death" effect and two "ATK Up: Divine" functions.                                       |
| `/nice/{region}/buff/{buff_id}`                                                                    | ✅       | Standalone buff object.                                                                                                                                                                                                   |
| `/nice/{region}/buff/search?...`                                                                   | ✅       | Filters: `name`, `type`, `buffGroup`, `vals`, `tvals`, `ckSelfIndv`, `ckOpIndv`.                                                                                                                                          |
| `/nice/{region}/{skill\|NP\|function}/{id}?reverse=true&reverseDepth={function\|skillNp\|servant}` | ✅       | Reverse lookup chain: buff → function → skill/NP → servant. Confirmed on `/function/152?reverse=true&reverseDepth=servant`: 140 skills + 14 NPs, nested down to real servants (Gaius Julius Caesar first).                |
| `/basic/{region}/skill/{id}` and `/basic/{region}/NP/{id}`                                         | ✅       | No functions/buffs — just id/name/ruby/icon (+rank/type for NP).                                                                                                                                                          |
| `/raw/{region}/skill/{skill_id}`                                                                   | ✅       | Undecoded master tables; `mstSkillLv.svals` is the literal packed string (e.g. `"[1000,3,-1,90]"`) that `nice` decodes into `{Rate:1000, Turn:3, Count:-1, Value:90}` — an escape hatch if a `nice` decode is ever wrong. |

### The mechanics model

- **`funcType`** — 129 enum values (confirmed count) covering damage (`damage`, `damageNp`, `damageNpPierce`...), resource gain/loss (`gainNp`, `gainHp`, `gainStar`, `lossNp`...), buff application (`addState`, `addStateShort`, `subState`), cooldown manipulation, and dozens of niche mechanics (`instantDeath`, `resurrection`, `transformServant`...).
- **`funcTargetType`** — 36 values (who is hit: `self`, `ptAll`, `enemyAll`, `ptOneHpLowestValue`, `fieldAll`...). **`funcTargetTeam`** is a separate 3-value axis (`player`/`enemy`/`playerAndEnemy`) — both must be read together.
- **`functvals`/`tvals`** — trait gates from a **375-value `Trait` enum**, driving anti-trait damage/effects (confirmed real via `tvals=divine`).
- **`buffs[]`** — full `NiceBuff` objects: `type` (**235-value `NiceBuffType`** enum), `buffGroup` (stacking group), `maxRate` (stacking cap, e.g. 5000 = 500%).
- **`svals` / `svals2..svals5`** — per-level scaling arrays (skill levels 1-10, or NP levels 1-5 × Overcharge 1-5 for NPs). Each entry is a `Vals` object (282 possible keys; only a handful populated per `funcType` — commonly `Rate`, `Turn`, `Count`, `Value`, `Value2`, `UseRate`, `Target`, `Correction`).
  - `Rate` = activation chance in permille (1000 = 100%).
  - `Value`/`Value2` = primary magnitude, semantics defined by `funcType` (permille: 90 = +9.0% ATK for a buff; 3000 = 300% for `damageNp`).
  - `Turn`/`Count` = buff duration in turns / activation-limit (-1 = unlimited).
  - Confirmed example: Excalibur's `damageNp` `svals[0..4].Value` = `[3000,4000,4500,4750,5000]` (NP levels 1-5); its `gainNp` scales via `svals`→`svals5` (Overcharge 1-5) instead, `2000`→`5000`.
- **`noblePhantasms[].npGain`** — % NP gauge charged per hit, by card type (`buster`/`arts`/`quick`/`extra`/`defence`/`np`), per NP level.
- **`noblePhantasms[].npDistribution`** — per-hit damage split (sums to 100).
- **`noblePhantasms[].individuality`** / **`.effectFlags`** — NP's own trait tags (`attackMagical`, `cardBuster`, `aoeNP`...) and short semantic flags (`attackEnemyAll`).
- **`skills[].coolDown`** — 10-entry array, cooldown at skill level 1-10.
- **`skills[].detail` / `.unmodifiedDetail`** — pre-rendered description text; `unmodifiedDetail` uses `{0}`/`{{index:Field:format}}` placeholders resolvable against `svals` — a basic description renderer doesn't require hand-decoding every `funcType`.
- **`skills[].type`** — `active` | `passive`; passives (class/extra/append) reuse the identical functions/svals schema, distinguished only by `type` and an all-zero `coolDown`.
- **`skills[].strengthStatus`** / **`skillAdd`** — flags whether a skill has been power-adjusted since release (varies per `skillSvts` entry, i.e. per servant sharing the skill id).
- **`@atlasacademy/api-connector`** (npm, confirmed live at v6.0.0) — official maintained TypeScript client with typed interfaces/enums for the whole surface above. Worth adopting instead of hand-transcribing 129+235+36+375 enum strings.

### Feature ideas

- Full damage/NP calculator combining ATK growth + card multipliers + buff `svals` + NP `svals`/`svals2-5` (by NP level _and_ live Overcharge) + trait-based bonuses.
- Skill/NP/function/buff search & browse pages independent of which servant owns the effect (e.g. "every `gainNp` skill in the game").
- "Which servants have this buff" reverse-lookup view via `reverse=true&reverseDepth=servant` (verified working).
- Interactive skill-level (1-10) / NP-level(1-5) / Overcharge(1-5) sliders reading straight off `svals`/`svals2-5` — no server computation needed.
- Auto-generated tooltip text from `unmodifiedDetail` placeholders, covering most skills without a per-`funcType` formatter.
- Trait/class-effectiveness badges (e.g. "Anti-Divine") from scanning `functvals`/`tvals`.
- Adopt `@atlasacademy/api-connector` as the typed data layer.

### Caveats

- This is a near-literal transcription of the internal battle engine — most of the 129 `funcType` / 235 `buffType` / 375 `Trait` / 282 `Vals`-key values have **no description beyond an auto-generated field-name title** in the OpenAPI spec. Correctly interpreting exotic ones needs outside FGO game knowledge, not the docs alone.
- Deep reverse lookups are expensive: `/function/152?reverse=true&reverseDepth=servant` returned a **16.6MB** payload. Fine for offline/build-time indexing, not a live per-page-load call.
- The svals-index-to-display-level mapping (index 0-9 = level 1-10; index 0-4 within svals/svals2-5 = NP level × Overcharge) is an empirically confirmed convention, not documented in any field description.
- No rate-limit headers observed anywhere; the project's GitHub README only documents a configurable quest/war cache TTL (default 3600s) server-side, nothing about client throttling. Cache defensively regardless.
- NP ids are never derivable from servant ids — always read them off the servant record first.

---

## 3. Animation & audio assets

Voice-line audio and music are real, playable, and usable today. The 3D "animation" asset is a
dead end for a web app — it's a Unity AssetBundle, not Spine/Live2D/glTF.

### Endpoints

| Pattern                                                                                                                              | Verified | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/nice/{region}/servant/{id}?lore=true` → `profile.voices[]`                                                                         | ✅       | Voice groups (`home`, `groeth`/growth, `firstGet`, `battle`, `treasureDevice`, etc. — **24 `NiceSvtVoiceType` values total**). Each line has `condType`/`condValue` (unlock condition), `audioAssets[]` (ready-to-stream MP3 URLs), `delay[]`/`face[]`/`form[]` (multi-clip timing), and `subtitle` (translated dialogue). Confirmed on servant 100100 (5 groups / 59 lines / 74 MP3s) and 200100/Merlin (7 groups, incl. a duplicate home/growth set for an alt voice prefix). **Only available with `lore=true` on the per-servant endpoint** — absent from the bulk export entirely, so a many-servant voice feature is one request per servant (423 for NA). |
| `extraAssets.spriteModel.ascension.{n}` / `.costume.{id}` → `https://static.atlasacademy.io/{region}/Servants/{svtId}/manifest.json` | ✅       | Tiny manifest listing two asset types only: `Modified Unity3D` (the compressed bundle, ~5-11MB) and `Texture2D` (loose PNG textures). Header-byte inspection confirmed the bundle is genuine **UnityFS** format, built with **Unity 2022.3.62f2** — the actual in-battle 3D combat model. **266 of 423 NA servants (63%) ship a separate bundle per ascension stage.**                                                                                                                                                                                                                                                                                           |
| `/nice/{region}/bgm/{bgm_id}`                                                                                                        | ✅       | Full-track metadata: `name`, `fileName`, `audioAsset` (single MP3 URL), `priority`, `logo`, optional `shop` unlock cost. Confirmed `bgm/1` (~1.6MB, `audio/mpeg`, full loop-ready battle theme — not a short bark).                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/export/{region}/nice_bgm.json`                                                                                                     | ✅       | Bulk export of all BGM entries (731KB) — a jukebox feature needs one request total.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Notable fields

- **`profile.voices[].voiceLines[].audioAssets[]`** — use verbatim from the JSON; **do not construct the URL yourself**. The static-path folder prefix is inconsistent (`ChrVoice_{id}` for home/growth/firstGet, `Servants_{id}` for battle barks, `NoblePhantasm_{id}` for NP lines) — a guessed `ChrVoice_100100/0_B010.mp3` 404'd while the real `Servants_100100/0_B010.mp3` returned 200.
- **`profile.voices[].voiceLines[].subtitle`** — ready-to-display captions, multi-part lines newline-joined in parallel with `id[]`/`audioAssets[]`/`delay[]`.
- **`extraAssets.spriteModel` manifest → bundle file** — genuine Unity AssetBundle, confirmed via magic bytes (`55 6e 69 74 79 46 53` = `"UnityFS"`). Not usable in three.js/WebGL without a version-matched Unity WebGL runtime or an offline extraction pipeline (UnityPy/AssetStudio/AssetRipper) — a large, legally murky project, not a drop-in asset.
- **`extraAssets.spriteModel` manifest → texture PNGs** — directly loadable images, but raw UV-mapped texture atlases, not composited art like `charaGraph`/`charaFigure` — lower practical value for this app's purposes.
- **`nice_bgm.json` / `bgm/{id}.audioAsset`** — full battle/event/story music tracks, independent of any servant.

### Feature ideas

- Servant "voice room" panel: play home/battle/NP lines with subtitle captions from one `lore=true` fetch per servant.
- Random ambient battle-bark sampler on card interaction (tiny 2-5KB clips).
- NP quote overlay: auto-play the `treasureDevice` line + subtitle when a card is selected.
- BGM toggle using `nice_bgm.json` for ambient music while browsing.
- Voice-actor/illustrator credits strip from `profile.cv`/`profile.illustrator` — already in the `lore=true` payload, zero extra requests.
- 3D model viewer — **not recommended near-term**: flagged explicitly as high-effort/low-certainty pending either a maintained JS UnityFS parser or acceptance of the legal ambiguity of extracting these assets.
- Costume-specific voice-set switching (some servants like Merlin have duplicate voice groups per alt voice prefix/costume).

### Caveats

- `spriteModel` is **not** Spine/Live2D/glTF — confirmed genuine Unity AssetBundle (UnityFS, Unity 2022.3.62f2). Effectively out of scope for a lightweight vanilla-TS client.
- The manifest never lists animation clip names, skeleton/atlas data, or audio references — everything is locked inside the opaque bundle.
- Voice data requires the per-servant `lore=true` endpoint — absent from the bulk export.
- Never pattern-guess audio URLs; use `audioAssets[]` verbatim (confirmed prefix mismatch above).
- No rate-limit headers observed and none documented publicly — cache client-side regardless, same as this app already does for images.
- Multi-part voice lines have several sequential clips with per-clip `delay[]` timings meant to play back-to-back — playing only `audioAssets[0]` will cut off mid-quote.
- `condType` values reference quest ids for unlock conditions but are not joined to human-readable quest/story text in this response.
- Bundle sizes compound fast: 63% of servants have a separate ~5-11MB model bundle per ascension stage — a serious bandwidth/storage cost even before solving rendering.

---

## 4. Non-servant entities (Craft Essences, Command Codes, Mystic Codes, Items, Enemies/NPCs, Wars, Quests, Events, bulk exports)

Beyond servants, the API exposes the full relational game-data graph via the same
`basic`/`nice`/`raw` + `search` pattern, with a thinner asset set per entity type.

### Endpoints

| Pattern                                                                                                                            | Verified  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/nice/{region}/equip/{id}` (+basic/raw, +search, `?lore=true`)                                                                    | ✅        | Craft Essence by collectionNo. Assets: `charaGraph`, `faces`, `equipFace` — **never `charaFigure`** (no cutout figure exists for CEs, confirmed empty on two checked CEs). `lore=true` adds `profile.comments`/`.stats`/`.voices` same shape as servants. `search?rarity=5` unfiltered correctly 403s (100-result cap).                                                                                                                                                                                                                                                                             |
| `/nice/{region}/CC/{id}` (+basic/raw)                                                                                              | ✅        | Command Code. Assets: `charaGraph.cc` + `faces.cc` only. Has exactly 1 passive skill + `illustrator`/`comment`. Bulk `nice_command_code.json`: 176 entries.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/nice/{region}/MC/{id}` (+basic/raw)                                                                                              | ✅        | Mystic Code (player's own outfit). Gender-split assets: `item.male/female`, `masterFace.male/female`, **`masterFigure.male/female`** (full-body cutout — same role as servant `charaFigure`). 3 active skills. Bulk `nice_mystic_code.json`: only 23 entries, non-contiguous ids.                                                                                                                                                                                                                                                                                                                   |
| `/nice/{region}/item/{id}` (+basic/raw, `search?type=`)                                                                            | ✅        | Materials/currencies. `type` enum (`qp`, `skillLvUp`, `eventItem`, `svtCoin`, `tdLvUp`, `gachaTicket`, `apRecover`...), `uses[]` (which upgrade paths consume it), `background` (rarity frame: bronze/silver/gold/zero). Bulk `nice_item.json`: 1,630 items; `search?type=svtCoin` returned exactly 412.                                                                                                                                                                                                                                                                                            |
| `/nice/{region}/svt/{svt_id}` (+basic/raw, +search)                                                                                | ✅        | Generic non-servant "svt" entity by raw id (not collectionNo). Types seen: `enemy` (683 plain mooks, face-only), `enemyCollection` (137 raid/boss reskins of playable servants, face-per-ascension only), **`enemyCollectionDetail`** (9 unique story bosses e.g. Solomon id 1700100 — gets full `charaGraph`+`faces`+`charaFigure` like a playable servant), `servantEquip` (2,122 — CEs are svt-typed internally too), `statusUp`/`combineMaterial`/`svtMaterialTd` (fodder-only).                                                                                                                |
| `/nice/{region}/enemy-master/{id}` (+basic/raw)                                                                                    | ✅        | Rival human Master NPCs (e.g. Kadoc Zemlupus). `face`, `figure` (full-body cutout), `commandSpellIcon`. Bulk `nice_enemy_master.json`: 26 entries — **ids are not small/guessable, source from the bulk export.**                                                                                                                                                                                                                                                                                                                                                                                   |
| `/nice/{region}/war/{id}` (+basic/raw)                                                                                             | ✅        | Story chapter/arc: map coordinates, `banner`/`headerImage`, linked `eventId`, `maps[]` (`mapImage` + dimensions + bgm), `spots[]` (map nodes with routing). Bulk `basic_war.json`: 195 wars.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/nice/{region}/quest/{id}` and `/quest/{id}/{phase}` (+basic/raw, +search, `/quest/phase/search`, `/quest/phase/latestEnemyData`) | ✅        | Quest metadata + `phaseScripts` (raw dialogue script text files) at the base path; full per-phase battle data (`stages[]` → `enemies[]` with complete stat blocks: HP/ATK/skills/NP/AI id/drops/traits) at `/quest/{id}/{phase}`. Raw scenario script confirmed real at `static.atlasacademy.io/.../Script/.../....txt` (custom markup: `[charaSet]`, `[bgm]`, `＠speaker` lines).                                                                                                                                                                                                                  |
| `/nice/{region}/event/{id}` (+basic/raw, +search)                                                                                  | ✅        | Very rich: `shop[]`, `missions`/`randomMissions`, `towers`, `lotteries`, `treasureBoxes`, `recipes`, `campaigns`, **`voicePlays`** (event-exclusive voice lines with real playable `audioAssets[]` + subtitle + speaker face/form). Bulk `basic_event.json`: 1,013 events (152 have linked `warIds`, i.e. real story maps).                                                                                                                                                                                                                                                                         |
| `/nice/{region}/mm/{id}` (Master Mission)                                                                                          | ✅        | Long-running mission boards. Bulk `nice_master_mission.json`: 38 boards. **Ids not small/guessable — source from bulk export.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/nice/{region}/event-mission/{id}`                                                                                                | ✅        | Single mission detail outside the parent event/mm wrapper.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/nice/{region}/shop/{id}` (+basic/raw, +search)                                                                                   | ✅        | Single purchasable-slot record (also embedded inside events). Bulk `nice_shop.json`: 3.96MB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/nice/{region}/bgm/{id}` (+basic/raw)                                                                                             | ✅        | See §3. Bulk `nice_bgm.json`: 731KB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/nice/{region}/script/{id}` (+raw, +search) + static `.../Script/{prefix}/{scriptId}.txt`                                         | ✅        | Raw scenario/dialogue text, confirmed real playable story content, unparsed custom markup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Gacha data (bulk export only — no confirmed single-id `nice` endpoint)                                                             | ✅ (bulk) | `nice_gacha.json`: 2,392 banners. Each has `featuredSvtIds[]`, `openedAt`/`closedAt`, `detailUrl`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/export/{region}/asset_storage.json`                                                                                              | ✅        | Low-level native-client bundle manifest (29,035 entries) — not individually-fetchable web assets, not useful for a web viewer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `nice_class_board.json` (bulk only)                                                                                                | ✅        | Per-class "Da Vinci's Workshop" skill board (9 boards).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Reference/lookup bulk exports                                                                                                      | ✅        | `NiceClassRelation.json` (class-vs-class damage multiplier matrix), `NiceClass.json` (54 classes), `NiceCard.json` (Buster/Arts/Quick multiplier table), `NiceAttributeRelation.json`, `NiceClassAttackRate.json`, `nice_trait.json` (360 trait id→name — the decoder for every `traits`/`individuality` array in the whole API), `nice_illustrator.json` (551 artists), `nice_cv.json` (235 voice actors), `NiceConstant.json`/`NiceConstantStr.json`, `NiceSvtGrailCost.json`, `NiceUserLevel.json`, `NiceAiConditionInformation.json`, `timer_data.json` (2MB). All confirmed 200 via `curl -I`. |

### Notable fields

- **CE `extraAssets.charaFigure`** — confirmed **absent on every checked CE**; the diorama/parallax card effect cannot be reused as-is for CEs.
- **MC `extraAssets.masterFigure`** — full-body gender-split cutout, same role as servant `charaFigure` — usable for a Mystic Code diorama viewer.
- **`enemyCollectionDetail` `charaFigure`** — the 9 unique true-final-boss records (e.g. Solomon) get the identical `charaGraph`+`charaFigure` combo as playable servants — a ready-made "boss gallery" diorama with zero new asset-handling code.
- **`spriteModel` manifest (all svt types incl. servants)** — points to the Unity bundle described in §3, not a directly renderable asset.
- **`voicePlays[].audioAssets`** (events) — directly playable MP3 + subtitle + speaker face/timing, confirmed HTTP 200 `audio/mpeg` on a real 2026 event.
- **`bgm.audioAsset`** / **`war.maps[].bgm`** — every track individually addressable.
- **`war.maps[].mapImage`** / **`.banner`** / **`.headerImage`** — full story-map art with explicit pixel dimensions for correct scaling.
- **`enemy-master.figure`** / **`.commandSpellIcon`** — rival-NPC full-body art + unique Command Spell icon.
- **`item.background`** — built-in rarity-frame enum, directly reusable without inventing a new mapping.
- **`gacha.featuredSvtIds[]` + `openedAt`/`closedAt` + `detailUrl`** — enough to build a chronological summon-banner history.

### Feature ideas

- Craft Essence viewer reusing the existing flat-foil tiers, explicitly skipping the diorama tier (no `charaFigure` exists for CEs).
- Mystic Code viewer/gallery using `masterFigure` for the same parallax-cutout treatment already built for servants (with a male/female toggle).
- Command Code card viewer (`charaGraph`+`faces`, flat foil, illustrator credit from `nice_illustrator.json`).
- "True Boss Gallery" diorama viewer for just the 9 `enemyCollectionDetail` unique bosses.
- Item/material encyclopedia grid using `item.icon`+`item.background` as the built-in rarity frame, filterable via `item/search`.
- Story map explorer: render `war.maps[].mapImage` at native dimensions, plot `spots[]`, route via `joinSpotIds`.
- Battle-BGM jukebox from `nice_bgm.json`.
- Event voice-line player pairing `voicePlays[]` audio with subtitle/face/form.
- Quest/enemy-deck "scouting report" viewer rendering a quest+phase's `enemies[]` roster as a pre-battle intel card (pure display, no game logic).
- Summon-banner history timeline from `nice_gacha.json` cross-referenced against servant data.
- Rogues-gallery viewer for Enemy-Master NPCs.
- Class-matchup reference chart rendered directly from `NiceClassRelation.json` + `NiceClass.json` icons.

### Caveats

- No rate-limit headers observed anywhere, and the API's README documents none explicitly — silence, not a guarantee. Cache aggressively regardless.
- Only the **NA** region was queried for this task; JP/KR/CN/TW branches exist per the project's README but were out of scope here.
- `search` endpoints on this whole entity family enforce the same hidden 100-result cap (403 `"More than 100 items found"`) — narrow with filters, don't try to paginate.
- **`/nice/{region}/mm/{id}`** and **`/nice/{region}/enemy-master/{id}`** ids are _not_ small/guessable integers — always source real ids from the corresponding bulk export first.
- `/nice/{region}/battle-master-image/{id}` exists in the spec but returned a 500 on a guessed id — correct id-space not identified, needs a real example id from elsewhere before it's usable.
- `nice_grand_graph.json` returned an **empty array on NA** (JP-only mechanic, no NA content) — don't build against it expecting data.
- `raw/{region}/eventAlloutBattle` returned empty at query time — may only populate during an active event.
- On Windows, default stdout encoding (cp1252) chokes on non-ASCII characters (★, unicode dashes, Japanese punctuation) common in name/text fields — force UTF-8 in any tooling that prints/logs raw API text.

---

## 5. Illustration & visual asset catalog

This section exists because it's the most directly relevant one to this project (a card viewer)
and the original research pass for it failed to return usable output — everything below was
re-verified directly against the live API afterward, servant-by-servant, rather than taken from a
single example. **All 18 `extraAssets` keys below are present on every servant record** (verified
across 5 unrelated servants: Altria Pendragon, Mash Kyrielight, Okita Souji (Alter), Abigail
Williams, Leonardo da Vinci) — but several are **empty objects on all of them**, so "the key
exists" and "the key has real art" are different claims; both are marked separately below.

### Always-populated keys (verified non-empty on all 5 sampled servants)

| Key                                 | Real example URL                                  | Confirmed size                         | What it visually is                                                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charaGraph.ascension.{1-4}`        | `.../CharaGraph/100100/100100a@1.png`             | 496,632 bytes                          | The big full illustration, background included — this project's `cardArt` / the `card__art--bg` diorama layer. One per ascension stage (and per costume, under `.costume`).                                                  |
| `faces.ascension.{1-4}`             | `.../Faces/f_1001000.png`                         | small (icon)                           | Small square face/portrait icon — this project's `faceIcon`.                                                                                                                                                                 |
| `narrowFigure.ascension.{0-3}`      | `.../NarrowFigure/100100/100100@0.png`            | 95,829 bytes                           | A tall, narrow **crop of `charaGraph`** — same background, just cropped to a portrait strip. Not transparent. Not currently used by this project; a cheaper alternative to `charaGraph` for a narrower card layout.          |
| `charaFigure.ascension.{1-3}`       | `.../CharaFigure/1001000/1001000_merged.png`      | 752,920 bytes                          | The transparent full-body cutout **sprite atlas** this project's `diorama` tier already uses (see `CLAUDE.md`): a fixed 1024×1280 canvas, character in the top 768px (60%), a grid of face-expression icons packed below it. |
| `commands.ascension.{1-4}`          | `.../Servants/Commands/100100/card_servant_1.png` | 256×256, 56,912 bytes                  | The in-battle command-card face art — a tight bust crop, square.                                                                                                                                                             |
| `status.ascension.{1-4}`            | `.../Servants/Status/100100/status_servant_1.png` | 256×256, 70,574 bytes                  | Stat-screen portrait icon — visually similar crop to `commands` but a distinct file/asset.                                                                                                                                   |
| `image.story.{n}`                   | `.../Image/cut171_token_101/cut171_token_101.png` | varies, e.g. 1024×1024 / 198,876 bytes | Standalone story/cutscene CG art. **Not present on every servant** (Okita Souji (Alter) had `image.story: {}` — empty — in this sample; treat as optional, count varies 0-3+ per servant).                                   |
| `spriteModel.ascension/costume.{n}` | `.../Servants/100100/manifest.json`               | manifest, small                        | Points to the in-battle 3D model — see §3, not a directly usable image.                                                                                                                                                      |

### Keys present in the schema but empty on every servant sampled

`charaGraphEx`, `charaGraphName`, `charaFigureMulti`, `charaFigureMultiCombine`,
`charaFigureMultiLimitUp`, `equipFace`, `charaGraphChange`, `narrowFigureChange`, `facesChange` were
all `{}` on **every one of the 5 general servants above, plus two additional checks specifically
targeting James Moriarty** (id 202300/901300, a servant confirmed via §1 to have a `svtChange`
alternate identity — the theory being these "Change" keys might hold the alternate-identity art).
They were still empty there too. Inspecting `svtChange` directly shows it carries no image URLs of
its own (only `battleSvtId`/`svtVoiceId`/NP-id overrides and a name/ruby/battleName override) — so
whatever triggers these nine keys to populate is a rarer case not identified in this pass. Treat
their presence in the schema as real but **don't build a feature around them without finding a
servant that actually populates one first.**

- **`charaFigureForm`** is a partial exception — empty on 4 of 5 sampled servants, but **populated
  on Mash Kyrielight**: `{"1": {"costume": {"800150": ".../CharaFigure/Form/1/8001500/8001500_merged.png", ...}}}` — an alternate-form costume variant of the charaFigure cutout, keyed by form number then costume id. Rare/costume-specific, not universal.
- **`equipFace`** is empty on every _servant_ checked, but **is populated on Craft Essences**
  (verified on CE id 9400010 "Tenacity": `equipFace.equip["9400010"] = ".../EquipFaces/f_94000100.png"`, 150×68 pixels, 20,446 bytes) — it's a CE-specific face-icon variant, not a servant field in practice. See §4 for the rest of the CE asset set (`charaGraph.equip`, `faces.equip` — same nesting-under-`equip` pattern).

### Costume & alternate-ascension assets

- Costumes reuse the **same key structure**, just nested under `.costume.{costumeId}` instead of
  `.ascension.{n}` (confirmed on `charaGraph`, `charaFigure`, `commands`, `status`, `spriteModel`
  for Altria's and Mash's owned costumes).
- `ascensionAdd` (see §1) can override _stats/name/traits_ per ascension without touching
  `extraAssets` at all — art and identity overrides are tracked completely separately in this API.

### Feature ideas

- A **card-back/thumbnail mode** using `narrowFigure` instead of `charaGraph` for a denser grid
  view (same background art, ~5x smaller file than `charaGraph`, ~80% the byte size of the
  `charaFigure` atlas this project already fetches).
- A **stat-screen-style detail panel** using `status` art instead of (or alongside) the existing
  `detailModal` layout.
- A **story-CG gallery** per servant from `image.story`, for servants that have it — needs an
  empty-state, it's genuinely absent on some servants (confirmed: Okita Souji (Alter)).
- **Costume gallery** re-using the exact same `card.ts`/`diorama.css` rendering code, just pointed
  at `.costume.{id}` instead of `.ascension.{n}` — no new asset-handling logic needed, only a
  costume picker UI.

### Caveats

- Don't assume a key being present in the schema means it has real content — 9 of the 18 keys were
  empty on every sample in this pass. Always check `Object.keys(value).length > 0` (exactly what
  this project's `pickAscension()` fallback-chain already implicitly handles for `charaGraph`).
- `image.story` count and presence is inconsistent per servant (0 on some, 1-3+ on others) — must
  be handled as a variable-length, possibly-empty list, not a fixed slot.
- `charaFigureForm` and costume-nested assets are genuinely rare/character-specific (confirmed
  only on Mash of the 5 sampled) — don't build primary UI around them, but do build the fallback
  path so they degrade gracefully when absent (same principle as the existing `figureArt: string |
null` field in `ServantSummary`).

---

## Quick reference

### Endpoint cheat sheet

| Need                                                        | Endpoint pattern                                                                                                                                                                            | Verified                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Full servant detail (all mechanics + lore/voices/materials) | `/nice/{region}/servant/{id}?lore=true`                                                                                                                                                     | ✅                                     |
| Full servant detail (no lore)                               | `/nice/{region}/servant/{id}`                                                                                                                                                               | ✅                                     |
| Lightweight servant for list views                          | `/basic/{region}/servant/{id}`                                                                                                                                                              | ✅                                     |
| Filtered servant search                                     | `/nice/{region}/servant/search?{filters}` (or `/basic/...`)                                                                                                                                 | ✅                                     |
| Bulk servant fixture/offline data                           | `/export/{region}/nice_servant.json` (~44MB, no lore)                                                                                                                                       | ✅                                     |
| Standalone skill / NP / function / buff                     | `/nice/{region}/{skill\|NP\|function\|buff}/{id}`                                                                                                                                           | ✅                                     |
| Skill/NP/function/buff search                               | `/nice/{region}/{skill\|NP\|function\|buff}/search?{filters}`                                                                                                                               | ✅                                     |
| "Which servants use this buff/function"                     | `.../{id}?reverse=true&reverseDepth=servant`                                                                                                                                                | ✅ (large payload, cache/offline only) |
| Craft Essence                                               | `/nice/{region}/equip/{id}` (+search)                                                                                                                                                       | ✅                                     |
| Command Code                                                | `/nice/{region}/CC/{id}`                                                                                                                                                                    | ✅                                     |
| Mystic Code                                                 | `/nice/{region}/MC/{id}`                                                                                                                                                                    | ✅                                     |
| Item/material                                               | `/nice/{region}/item/{id}` (+`search?type=`)                                                                                                                                                | ✅                                     |
| Any non-servant "svt" (enemy, boss, NPC-as-svt)             | `/nice/{region}/svt/{svt_id}`                                                                                                                                                               | ✅                                     |
| True final-boss with full art (charaFigure)                 | `/nice/{region}/svt/{id}` where type=`enemyCollectionDetail` (e.g. 1700100 Solomon)                                                                                                         | ✅                                     |
| Rival human NPC (Master)                                    | `/nice/{region}/enemy-master/{id}` (id from bulk export)                                                                                                                                    | ✅                                     |
| Story chapter (map art, spots)                              | `/nice/{region}/war/{id}` (+`basic_war.json` bulk)                                                                                                                                          | ✅                                     |
| Quest battle data (enemy deck)                              | `/nice/{region}/quest/{id}/{phase}`                                                                                                                                                         | ✅                                     |
| Event (shops, missions, voice lines)                        | `/nice/{region}/event/{id}` (+`basic_event.json` bulk)                                                                                                                                      | ✅                                     |
| Single BGM track                                            | `/nice/{region}/bgm/{id}` / bulk `nice_bgm.json`                                                                                                                                            | ✅                                     |
| Voice-line audio + subtitle                                 | `servant.profile.voices[]` / `event.voicePlays[]` (URLs used verbatim, never guessed)                                                                                                       | ✅                                     |
| Trait id → name decoder                                     | bulk `nice_trait.json`                                                                                                                                                                      | ✅                                     |
| Full OpenAPI spec / enum source of truth                    | `https://api.atlasacademy.io/openapi.json` (site root, not `/export/...`) — **107 endpoints across 3 tags (`basic`/`nice`/`raw`)**, verified by counting `spec.paths`                       | ✅                                     |
| Interactive docs                                            | `https://api.atlasacademy.io/docs`                                                                                                                                                          | —                                      |
| Typed TS client                                             | `@atlasacademy/api-connector` (npm, v6.0.0 confirmed live)                                                                                                                                  | ✅                                     |
| Detect when game data has updated (per region)              | `GET /info` → `{"NA":{"hash":"...","timestamp":...}, "JP":{...}, "CN":{...}, "KR":{...}, "TW":{...}}` — one hash+unix-timestamp pair per region, changes when that region's data is rebuilt | ✅                                     |

### Hard limitations & gotchas (all in one place)

- **No documented rate limit, and no rate-limit headers observed** on any verified call across every research pass. Not a guarantee of no limit — just undisclosed. Keep caching client-side aggressively (this app already does this for images/data).
- **`search` endpoints hard-cap at 100 results** and return HTTP 403 (`"More than 100 items found. Please narrow down the query."`) instead of paginating — confirmed on **`nice`** servant search directly (`/nice/NA/servant/search?rarity=5` 403s, not just `raw`), and appears to apply across the entity family (CE search behaves the same). This is the practical reason this project fetches the bulk `/export/.../nice_servant.json` rather than paginating `search` — always filter enough to stay under the cap if you do use `search`.
- **CORS is open, no API key required** (per this project's existing `CLAUDE.md`) — consistent with everything above being fetchable directly from the browser.
- **Region**: most content research in this pass targeted **NA** specifically, but all **5 regions are confirmed live** via `GET /info` — `{"NA":..., "JP":..., "CN":..., "KR":..., "TW":...}`, each with its own hash+timestamp — so `region` is a real, fully-supported path parameter across the board, not just NA/JP as this project's `Region` type (`"NA" | "JP"`) currently assumes.
- **`raw` is not a richer version of `nice`** — it's the unresolved internal `mst*` master tables, smaller in practice and not name-joined. Keep using `nice` as the client data source.
- **Lore-gated data (`profile.comments`, `profile.voices`, all four material dicts) requires `?lore=true` on the per-servant endpoint** and is **absent from the bulk `/export/.../nice_servant.json`** — any feature touching lore/voices/materials for many servants means one request per servant, not one bulk fetch.
- **Never construct `static.atlasacademy.io` audio URLs from a guessed pattern** — the folder prefix varies by voice type and a wrong guess silently 404s. Always use the `audioAssets[]` value returned by the API.
- **NP ids ≠ servant ids** and aren't derivable from them — always read the real id off `servant.noblePhantasms[].id`.
- **`enemy-master` and `mm` (Master Mission) ids are not small/guessable integers** — source real ids from their bulk exports (`nice_enemy_master.json`, `nice_master_mission.json`) first.
- **3D battle models (`extraAssets.spriteModel`) are genuine Unity AssetBundles (UnityFS)**, not Spine/Live2D/glTF — out of scope for a plain web app without a Unity WebGL runtime or an offline extraction pipeline (UnityPy/AssetStudio/AssetRipper), which also carries unclear redistribution rights. 63% of servants ship a separate 5-11MB bundle per ascension stage, so this is also a real bandwidth cost, not just a rendering problem.
- **`growthCurve` is an opaque, undecodable internal id** — no lookup endpoint exists anywhere in the spec; use the `atkGrowth`/`hpGrowth` arrays directly instead.
- **`profile.comments` has no server-side bond-level spoiler gating** — the API returns all lore text regardless of the in-game unlock condition; add client-side gating yourself if that matters for a lore feature.
- **Some bulk exports are empty on NA**: `nice_grand_graph.json` (JP-only mechanic) and `raw/{region}/eventAlloutBattle` (may only populate during an active event) both returned `[]` — don't build against them expecting NA data.
- **Windows stdout encoding (cp1252)** chokes on non-ASCII text (★, JP punctuation, unicode dashes) common in name/lore fields — force UTF-8 in any tooling/scripts that print raw API text, not just in the browser client.
- The OpenAPI spec is at the **site root** (`https://api.atlasacademy.io/openapi.json`), **not** `/export/openapi.json` (confirmed 404).
