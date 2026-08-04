import type { EffectTier } from "../api/rarityEffects.ts";
import { classAccentColor, seedFromId } from "../api/rarityEffects.ts";
import type { ServantSummary } from "../api/types.ts";
import { TiltController } from "../effects/pointerTilt.ts";
import { classLabel, effectClassName, starString } from "./format.ts";

export interface CardHandle {
  element: HTMLElement;
  destroy(): void;
}

/** Builds one interactive holo card. The caller owns mounting/unmounting `element`. */
export function createCard(
  servant: ServantSummary,
  effectTier: EffectTier,
  onSelect: (servant: ServantSummary) => void,
  initialAscension = 1,
): CardHandle {
  const frame = document.createElement("div");
  frame.className = "card-frame";

  const card = document.createElement("div");
  card.className = "card";
  card.style.setProperty("--accent", classAccentColor(servant.className));
  // Deterministic per-card jitter so cosmos/galaxy-style texture gradients don't line up
  // identically on every card — cheap stand-in for the reference site's per-card random seed.
  card.style.setProperty("--seed-x", `${seedFromId(servant.id)}%`);
  card.style.setProperty("--seed-y", `${seedFromId(servant.id + 1)}%`);
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `${servant.name} — view details`);

  const artWrap = document.createElement("div");
  artWrap.className = "card__art-wrap";
  renderArt(artWrap, servant, effectTier, initialAscension);

  const shine = document.createElement("div");
  shine.className = `card__shine ${effectClassName(effectTier)}`;

  const glare = document.createElement("div");
  glare.className = "card__glare";

  const info = document.createElement("div");
  info.className = "card__info";

  const classDot = document.createElement("span");
  classDot.className = "card__class-dot";
  classDot.title = classLabel(servant.className);

  const name = document.createElement("span");
  name.className = "card__name";
  name.textContent = servant.name;

  const rarity = document.createElement("span");
  rarity.className = "card__rarity";
  rarity.textContent = starString(servant.rarity);

  info.append(classDot, name, rarity);
  card.append(artWrap, shine, glare, info);

  // Ascension stage picker — every servant has 4 charaGraph stages (charaFigure only ships 3;
  // renderArt() clamps to the last one available for the diorama tier). Overlaid on the card
  // itself (not the info footer) so it tilts along with everything else.
  const ascensionCount = servant.cardArtByAscension.length;
  if (ascensionCount > 1) {
    const ascensionBar = document.createElement("div");
    ascensionBar.className = "card__ascension-bar";
    const buttons: HTMLButtonElement[] = [];
    for (let stage = 1; stage <= ascensionCount; stage++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "card__ascension-btn";
      button.textContent = String(stage);
      button.setAttribute("aria-label", `Ascension ${stage} art`);
      button.classList.toggle("is-selected", stage === initialAscension);
      button.addEventListener("click", (event) => {
        // Ascension buttons sit on top of the card's own click-to-open-detail handler.
        event.stopPropagation();
        renderArt(artWrap, servant, effectTier, stage);
        for (const other of buttons) other.classList.toggle("is-selected", other === button);
      });
      buttons.push(button);
      ascensionBar.appendChild(button);
    }
    card.appendChild(ascensionBar);
  }

  frame.appendChild(card);

  // Listen on `frame` (never transformed) and style `card` (the element that tilts) — see
  // the TiltController doc comment for why these must be different elements.
  const tilt = new TiltController(frame, card);

  const select = () => onSelect(servant);
  card.addEventListener("click", select);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select();
    }
  });

  return {
    element: frame,
    destroy() {
      tilt.destroy();
    },
  };
}

/**
 * (Re)builds the art layer(s) inside `artWrap` for the given ascension stage. The "diorama" tier
 * splits the art into two independently parallaxed layers (see styles/cards/diorama.css) instead
 * of the usual single flat image — it falls back to the normal single-image layout if the
 * servant has no transparent cutout at all. Callable repeatedly (the ascension picker calls this
 * again on click) — always clears `artWrap` first.
 */
function renderArt(
  artWrap: HTMLElement,
  servant: ServantSummary,
  effectTier: EffectTier,
  ascension: number,
): void {
  artWrap.replaceChildren();

  const cardArt = servant.cardArtByAscension[ascension - 1] ?? servant.cardArtByAscension[0] ?? "";
  // charaFigure only ships 3 ascension stages (charaGraph ships 4) — clamp to the last one
  // available rather than showing nothing for ascension 4.
  const figureIndex = Math.min(ascension, servant.figureArtByAscension.length) - 1;
  const figureArt = figureIndex >= 0 ? servant.figureArtByAscension[figureIndex] : undefined;

  if (effectTier === "diorama" && figureArt) {
    const bg = document.createElement("img");
    bg.className = "card__art card__art--bg";
    bg.crossOrigin = "anonymous";
    bg.src = cardArt;
    bg.alt = servant.name;
    bg.loading = "lazy";
    bg.decoding = "async";

    // Sits between bg and fg: darkens/obscures the center of the background (where charaGraph's
    // own copy of the character sits — there's no background-only asset to use instead) while
    // leaving its edges — the actual scenery — visible. See diorama.css for why.
    const veil = document.createElement("div");
    veil.className = "card__art--veil";

    const fg = document.createElement("div");
    fg.className = "card__art--fg";
    fg.style.backgroundImage = `url(${JSON.stringify(figureArt)})`;
    fg.setAttribute("role", "img");
    fg.setAttribute("aria-label", servant.name);

    artWrap.append(bg, veil, fg);
    return;
  }

  const art = document.createElement("img");
  art.className = "card__art";
  art.crossOrigin = "anonymous";
  art.src = cardArt;
  art.alt = servant.name;
  art.loading = "lazy";
  art.decoding = "async";
  artWrap.appendChild(art);
}
