import type { EffectTier } from "./api/rarityEffects.ts";
import type { ServantSummary } from "./api/types.ts";

/** The pull always shows off the 3D diorama tier — it's the app's signature effect and the one
 * most worth spotlighting on a random reveal. Falls back to the normal single-image layout
 * automatically (in card.ts's renderArt) for the rare servant with no figureArtByAscension. */
const PULL_EFFECT_TIER: EffectTier = "diorama";

export interface RandomPull {
  servant: ServantSummary;
  effectTier: EffectTier;
  /** 1-based, bounded to servant.cardArtByAscension.length. */
  ascension: number;
}

/** Pure — picks a servant and ascension stage uniformly at random; effect tier is always "diorama". Caller must guarantee `servants` is non-empty. */
export function pickRandomPull(servants: ServantSummary[]): RandomPull {
  const servant = servants[Math.floor(Math.random() * servants.length)]!;
  const ascension = 1 + Math.floor(Math.random() * servant.cardArtByAscension.length);
  return { servant, effectTier: PULL_EFFECT_TIER, ascension };
}
