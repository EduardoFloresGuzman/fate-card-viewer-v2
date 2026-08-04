import { pickRandomEffectTier, type EffectTier } from "./api/rarityEffects.ts";
import type { ServantSummary } from "./api/types.ts";

export interface RandomPull {
  servant: ServantSummary;
  effectTier: EffectTier;
  /** 1-based, bounded to servant.cardArtByAscension.length. */
  ascension: number;
}

/** Pure — picks a servant, holo tier, and ascension stage uniformly at random. Caller must guarantee `servants` is non-empty. */
export function pickRandomPull(servants: ServantSummary[]): RandomPull {
  const servant = servants[Math.floor(Math.random() * servants.length)]!;
  const ascension = 1 + Math.floor(Math.random() * servant.cardArtByAscension.length);
  return { servant, effectTier: pickRandomEffectTier(), ascension };
}
