import type { ServantSummary } from "./api/types.ts";
import { classLabel } from "./render/format.ts";

/** All facts are computed live from the loaded roster — never fabricated/hallucinated trivia. */
export interface RosterFact {
  label: string;
  value: string;
}

export interface ServantHighlight {
  servant: ServantSummary;
  label: string;
  stat: string;
}

function maxBy<T>(items: T[], key: (item: T) => number): T | null {
  if (items.length === 0) return null;
  return items.reduce((best, item) => (key(item) > key(best) ? item : best));
}

function countBy(
  items: ServantSummary[],
  key: (item: ServantSummary) => string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

function sampleGenerators<T>(
  generators: Array<(servants: ServantSummary[]) => T | null>,
  servants: ServantSummary[],
  count: number,
): T[] {
  const pool = [...generators];
  const results: T[] = [];
  while (pool.length > 0 && results.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    const generator = pool.splice(index, 1)[0]!;
    const result = generator(servants);
    if (result) results.push(result);
  }
  return results;
}

const ROSTER_FACT_GENERATORS: Array<(servants: ServantSummary[]) => RosterFact | null> = [
  (servants) => {
    const top = maxBy(servants, (s) => s.atkMax);
    return top && { label: "Highest ATK", value: `${top.name} — ${top.atkMax.toLocaleString()}` };
  },
  (servants) => {
    const top = maxBy(servants, (s) => s.hpMax);
    return top && { label: "Highest HP", value: `${top.name} — ${top.hpMax.toLocaleString()}` };
  },
  (servants) => {
    const counts = countBy(servants, (s) => s.className);
    let best: [string, number] | null = null;
    for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
    return (
      best && { label: "Most Common Class", value: `${classLabel(best[0])} — ${best[1]} servants` }
    );
  },
  (servants) => {
    const counts = countBy(servants, (s) => s.className);
    let rarest: [string, number] | null = null;
    for (const entry of counts) if (!rarest || entry[1] < rarest[1]) rarest = entry;
    return (
      rarest && {
        label: "Rarest Class",
        value: `${classLabel(rarest[0])} — ${rarest[1]} servant${rarest[1] === 1 ? "" : "s"}`,
      }
    );
  },
  (servants) => ({
    label: "5★ Servants",
    value: `${servants.filter((s) => s.rarity === 5).length}`,
  }),
  (servants) => ({
    label: "1★ Servants",
    value: `${servants.filter((s) => s.rarity === 1).length}`,
  }),
  (servants) => {
    if (servants.length === 0) return null;
    const avg = servants.reduce((sum, s) => sum + s.atkMax, 0) / servants.length;
    return { label: "Average ATK", value: Math.round(avg).toLocaleString() };
  },
  (servants) => {
    const total = servants.reduce((sum, s) => sum + s.cardArtByAscension.length, 0);
    return { label: "Illustrations Cataloged", value: total.toLocaleString() };
  },
  (servants) => ({
    label: "Diorama-Ready Servants",
    value: `${servants.filter((s) => s.figureArtByAscension.length > 0).length}`,
  }),
  (servants) => ({
    label: "Classes Represented",
    value: `${new Set(servants.map((s) => s.className)).size}`,
  }),
];

/** Randomly samples `count` distinct roster-wide facts — different on every page load. */
export function pickRandomRosterFacts(servants: ServantSummary[], count: number): RosterFact[] {
  return sampleGenerators(ROSTER_FACT_GENERATORS, servants, count);
}

const HIGHLIGHT_GENERATORS: Array<(servants: ServantSummary[]) => ServantHighlight | null> = [
  (servants) => {
    const top = maxBy(servants, (s) => s.atkMax);
    return top && { servant: top, label: "Highest ATK", stat: top.atkMax.toLocaleString() };
  },
  (servants) => {
    const top = maxBy(servants, (s) => s.hpMax);
    return top && { servant: top, label: "Highest HP", stat: top.hpMax.toLocaleString() };
  },
  (servants) => {
    const fiveStars = servants.filter((s) => s.rarity === 5);
    if (fiveStars.length === 0) return null;
    const pick = fiveStars[Math.floor(Math.random() * fiveStars.length)]!;
    return { servant: pick, label: "5★ Spotlight", stat: classLabel(pick.className) };
  },
  (servants) => {
    if (servants.length === 0) return null;
    const pick = servants[Math.floor(Math.random() * servants.length)]!;
    return {
      servant: pick,
      label: "Wildcard Pick",
      stat: `${pick.rarity}★ ${classLabel(pick.className)}`,
    };
  },
];

/** Randomly samples `count` distinct servant "superlative" spotlights — different on every page load. */
export function pickRandomServantHighlights(
  servants: ServantSummary[],
  count: number,
): ServantHighlight[] {
  return sampleGenerators(HIGHLIGHT_GENERATORS, servants, count);
}
