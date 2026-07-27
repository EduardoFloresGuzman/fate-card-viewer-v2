import type { EffectTier } from "../api/rarityEffects.ts";

const CLASS_LABEL_OVERRIDES: Record<string, string> = {
  alterEgo: "Alter Ego",
  moonCancer: "Moon Cancer",
  beastEresh: "Beast (Eresh)",
};

/** "alterEgo" -> "Alter Ego", "saber" -> "Saber", with a few named overrides for awkward cases. */
export function classLabel(className: string): string {
  if (CLASS_LABEL_OVERRIDES[className]) return CLASS_LABEL_OVERRIDES[className];
  const spaced = className.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Rarity 0 (a handful of joke/story servants) still renders as a single star rather than none. */
export function starString(rarity: number): string {
  const count = Math.min(5, Math.max(1, rarity));
  return "★".repeat(count);
}

export function effectClassName(tier: EffectTier): string {
  return `effect-${tier}`;
}
