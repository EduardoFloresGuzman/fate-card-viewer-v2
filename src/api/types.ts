/** Servant classes seen across the NA/JP playable roster (Atlas Academy `className`). */
export type ServantClass =
  | "saber"
  | "archer"
  | "lancer"
  | "rider"
  | "caster"
  | "assassin"
  | "berserker"
  | "shielder"
  | "ruler"
  | "avenger"
  | "alterEgo"
  | "moonCancer"
  | "foreigner"
  | "pretender"
  | "beast"
  | "beastEresh"
  | (string & {});

/** Lightweight, grid-ready projection of a "nice" servant. Trimmed at fetch time — see atlasAcademy.ts. */
export interface ServantSummary {
  id: number;
  collectionNo: number;
  name: string;
  className: ServantClass;
  rarity: number;
  atkMax: number;
  hpMax: number;
  /** Full illustration ("charaGraph"), falls back to the small face icon if absent. */
  cardArt: string;
  faceIcon: string | null;
  /**
   * Transparent full-body cutout ("charaFigure"), used by the "diorama" effect tier to float
   * the character in front of a separate background layer. Atlas Academy ships this as a sprite
   * atlas — the character fills the top 60% (768/1280px) of a standardized 1024x1280 canvas,
   * with a grid of face-expression icons packed below it — see styles/cards/diorama.css for the
   * crop. Null if the servant has no charaFigure (rare; falls back to the flat cardArt).
   */
  figureArt: string | null;
}

export interface ServantSkillDetail {
  name: string;
  icon: string;
}

export interface ServantNoblePhantasmDetail {
  name: string;
  rank: string;
  card: string;
}

/** On-demand detail fetched per-servant when a card is expanded. */
export interface ServantDetail {
  id: number;
  skills: ServantSkillDetail[];
  noblePhantasms: ServantNoblePhantasmDetail[];
}

export type Region = "NA" | "JP";

/** Narrow shape of the fields we read off the raw Atlas Academy "nice" servant JSON. */
export interface RawNiceServant {
  id: number;
  collectionNo: number;
  name: string;
  className: string;
  rarity: number;
  type: string;
  atkMax: number;
  hpMax: number;
  extraAssets: {
    charaGraph?: { ascension?: Record<string, string> };
    faces?: { ascension?: Record<string, string> };
    charaFigure?: { ascension?: Record<string, string> };
  };
  skills?: Array<{ name: string; icon: string }>;
  noblePhantasms?: Array<{ name: string; rank: string; card: string }>;
}
