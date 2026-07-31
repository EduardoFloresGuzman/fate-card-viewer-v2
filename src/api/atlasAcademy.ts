import type { RawNiceServant, Region, ServantDetail, ServantSummary } from "./types.ts";
import fixtureServants from "./fixtures/servants.sample.json";

const CACHE_KEY_PREFIX = "fgo-card-viewer:servants:";
/** Bump when the trimmed ServantSummary shape changes, to invalidate stale caches. */
const CACHE_VERSION = 3;

function cacheKey(region: Region): string {
  return `${CACHE_KEY_PREFIX}${region}:v${CACHE_VERSION}`;
}

function pickAscension(ascension: Record<string, string> | undefined): string | undefined {
  if (!ascension) return undefined;
  if (ascension["1"]) return ascension["1"];
  const [first] = Object.values(ascension);
  return first;
}

/** Every ascension-keyed art URL, in ascension order (1, 2, 3, ...) — not just the first one. */
function collectAscensionUrls(ascension: Record<string, string> | undefined): string[] {
  if (!ascension) return [];
  return Object.keys(ascension)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
    .map((n) => ascension[String(n)])
    .filter((url): url is string => Boolean(url));
}

function toSummary(raw: RawNiceServant): ServantSummary {
  const cardArtByAscension = collectAscensionUrls(raw.extraAssets.charaGraph?.ascension);
  const faceIcon = pickAscension(raw.extraAssets.faces?.ascension) ?? null;
  const figureArtByAscension = collectAscensionUrls(raw.extraAssets.charaFigure?.ascension);
  return {
    id: raw.id,
    collectionNo: raw.collectionNo,
    name: raw.name,
    className: raw.className,
    rarity: raw.rarity,
    atkMax: raw.atkMax,
    hpMax: raw.hpMax,
    cardArtByAscension: cardArtByAscension.length > 0 ? cardArtByAscension : [faceIcon ?? ""],
    faceIcon,
    figureArtByAscension,
  };
}

function isPlayable(raw: RawNiceServant): boolean {
  return raw.collectionNo > 0 && (raw.type === "normal" || raw.type === "heroine");
}

function readCache(region: Region): ServantSummary[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(region));
    return raw ? (JSON.parse(raw) as ServantSummary[]) : null;
  } catch {
    return null;
  }
}

function writeCache(region: Region, summaries: ServantSummary[]): void {
  try {
    localStorage.setItem(cacheKey(region), JSON.stringify(summaries));
  } catch {
    // Storage full or unavailable (private browsing) — cache is a pure optimization, skip silently.
  }
}

/**
 * Fetches the full servant roster for `region`, trimmed down to `ServantSummary`.
 *
 * Deliberately fetches the *nice* bulk export (not *basic*) because only the nice
 * schema carries `extraAssets.charaGraph`/`charaFigure` — the full illustration used as card
 * art and the transparent cutout used by the "diorama" effect tier.
 * The raw payload is ~40MB (~5MB gzipped over the wire); it's mapped down to a ~100KB
 * summary array immediately and only the summary is cached, so the heavy payload
 * never touches localStorage.
 */
export async function fetchServants(region: Region = "NA"): Promise<ServantSummary[]> {
  const cached = readCache(region);
  if (cached) return cached;

  try {
    const res = await fetch(`https://api.atlasacademy.io/export/${region}/nice_servant.json`);
    if (!res.ok) throw new Error(`Atlas Academy export request failed: ${res.status}`);
    const raw = (await res.json()) as RawNiceServant[];
    const summaries = raw.filter(isPlayable).map(toSummary);
    writeCache(region, summaries);
    return summaries;
  } catch (err) {
    console.warn("Falling back to bundled servant fixtures:", err);
    return fixtureServants as ServantSummary[];
  }
}

/** On-demand skill/NP detail for the card's expanded view. Not cached — fetched fresh per click. */
export async function fetchServantDetail(
  id: number,
  region: Region = "NA",
): Promise<ServantDetail> {
  const res = await fetch(`https://api.atlasacademy.io/nice/${region}/servant/${id}?lore=false`);
  if (!res.ok) throw new Error(`Atlas Academy servant request failed: ${res.status}`);
  const raw = (await res.json()) as RawNiceServant;
  return {
    id: raw.id,
    skills: (raw.skills ?? []).map((s) => ({ name: s.name, icon: s.icon })),
    noblePhantasms: (raw.noblePhantasms ?? []).map((np) => ({
      name: np.name,
      rank: np.rank,
      card: np.card,
    })),
  };
}
