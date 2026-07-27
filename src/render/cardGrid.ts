import type { EffectTier } from "../api/rarityEffects.ts";
import type { ServantSummary } from "../api/types.ts";
import { createCard, type CardHandle } from "./card.ts";

/**
 * Renders `servants` into `container` as a grid of holo cards, replacing whatever was there
 * before (including tearing down the previous batch's tilt-controller listeners).
 */
export function renderCardGrid(
  container: HTMLElement,
  servants: ServantSummary[],
  getEffectTier: (servant: ServantSummary) => EffectTier,
  onSelect: (servant: ServantSummary) => void,
): void {
  const previousHandles = handlesByContainer.get(container);
  previousHandles?.forEach((handle) => handle.destroy());

  container.innerHTML = "";
  container.className = "card-grid";

  const handles: CardHandle[] = servants.map((servant) => {
    const handle = createCard(servant, getEffectTier(servant), onSelect);
    container.appendChild(handle.element);
    return handle;
  });

  handlesByContainer.set(container, handles);
}

const handlesByContainer = new WeakMap<HTMLElement, CardHandle[]>();
