import type { ServantClass } from "./types.ts";

/**
 * Every selectable holo finish. Each has its own stylesheet under styles/cards/ — see
 * styles/index.css for the full set. "basic" renders no shine layer at all (just the shared
 * pointer-glare from base.css), matching how the reference site's lowest rarity has no foil.
 */
export const EFFECT_TIERS = [
  "basic",
  "holo",
  "cosmos",
  "radiant",
  "rainbow",
  "gold",
  "galaxy",
  "diorama",
] as const;

export type EffectTier = (typeof EFFECT_TIERS)[number];

/** "auto" defers to `rarityToEffectTier`; anything else forces that finish on every card. */
export type EffectSelection = "auto" | EffectTier;

const EFFECT_TIER_LABELS: Record<EffectTier, string> = {
  basic: "Basic",
  holo: "Holo",
  cosmos: "Cosmos",
  radiant: "Radiant",
  rainbow: "Rainbow",
  gold: "Gold Secret",
  galaxy: "Galaxy",
  diorama: "Diorama (3D)",
};

export const EFFECT_SELECTION_OPTIONS: Array<{ value: EffectSelection; label: string }> = [
  { value: "auto", label: "Auto (by rarity)" },
  ...EFFECT_TIERS.map((tier) => ({ value: tier, label: EFFECT_TIER_LABELS[tier] })),
];

/**
 * Default rarity -> finish mapping used when the user leaves the style picker on "auto". A
 * handful of joke/story-only servants ship with rarity 0 — treat them as the basic tier rather
 * than crashing. "radiant", "gold", and "diorama" are intentionally reserved for manual
 * selection only, so the style picker always has something distinct to show that the default
 * grid doesn't.
 */
export function rarityToEffectTier(rarity: number): EffectTier {
  if (rarity >= 5) return "rainbow";
  if (rarity === 4) return "cosmos";
  if (rarity === 3) return "holo";
  return "basic";
}

export function resolveEffectTier(selection: EffectSelection, rarity: number): EffectTier {
  return selection === "auto" ? rarityToEffectTier(rarity) : selection;
}

const CLASS_ACCENT_COLORS: Record<string, string> = {
  saber: "#2b6cb0",
  archer: "#2f855a",
  lancer: "#0e7c86",
  rider: "#b83280",
  caster: "#6b46c1",
  assassin: "#4a5568",
  berserker: "#c53030",
  shielder: "#3182ce",
  ruler: "#d69e2e",
  avenger: "#3c1361",
  alterEgo: "#d53f8c",
  moonCancer: "#805ad5",
  foreigner: "#1a202c",
  pretender: "#718096",
  beast: "#742a2a",
  beastEresh: "#97266d",
};

const DEFAULT_ACCENT_COLOR = "#718096";

export function classAccentColor(className: ServantClass): string {
  return CLASS_ACCENT_COLORS[className] ?? DEFAULT_ACCENT_COLOR;
}

/** Small deterministic hash (servant id -> 0-100) used to jitter per-card texture positioning
 * so cosmos/galaxy-style cards don't all show the exact same static pattern. */
export function seedFromId(id: number): number {
  return ((id * 2654435761) >>> 0) % 100;
}
