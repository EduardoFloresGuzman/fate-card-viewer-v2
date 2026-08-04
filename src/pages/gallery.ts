import {
  EFFECT_SELECTION_OPTIONS,
  resolveEffectTier,
  type EffectSelection,
} from "../api/rarityEffects.ts";
import type { ServantSummary } from "../api/types.ts";
import { renderCardGrid } from "../render/cardGrid.ts";
import { openDetailModal } from "../render/detailModal.ts";
import { classLabel } from "../render/format.ts";
import { REGION, retryRoster, subscribeRoster, type RosterState } from "../servantStore.ts";

interface FilterState {
  search: string;
  rarity: "featured" | "all";
  className: string | "all";
  effect: EffectSelection;
}

/** Renders the filterable servant grid into `mount`. Returns a teardown function. */
export function renderGalleryPage(mount: HTMLElement): () => void {
  const filterState: FilterState = {
    search: "",
    rarity: "featured",
    className: "all",
    effect: "auto",
  };

  let allServants: ServantSummary[] = [];
  let populatedClassOptions = false;

  mount.replaceChildren(...buildShell());

  const filterBar = required(
    mount.querySelector<HTMLElement>(".filter-bar"),
    "Gallery shell failed to build",
  );
  const content = required(
    mount.querySelector<HTMLElement>("#content"),
    "Gallery shell failed to build",
  );

  const unsubscribe = subscribeRoster((state) => handleRosterState(state));

  function handleRosterState(state: RosterState): void {
    if (state.status === "loading") {
      filterBar.hidden = true;
      content.replaceChildren(buildLoadingState());
      return;
    }
    if (state.status === "error") {
      filterBar.hidden = true;
      content.replaceChildren(buildErrorState(() => retryRoster(REGION)));
      return;
    }
    allServants = state.servants;
    filterBar.hidden = false;
    if (!populatedClassOptions) {
      populateClassOptions(allServants);
      populatedClassOptions = true;
    }
    renderFiltered();
  }

  function renderFiltered(): void {
    const filtered = applyFilters(allServants, filterState);
    content.replaceChildren();

    const countEl = document.createElement("p");
    countEl.className = "result-count";
    countEl.textContent = `${filtered.length} servant${filtered.length === 1 ? "" : "s"}`;
    content.appendChild(countEl);

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "result-count";
      empty.textContent = "No servants match those filters.";
      content.appendChild(empty);
      return;
    }

    const grid = document.createElement("div");
    content.appendChild(grid);
    renderCardGrid(
      grid,
      filtered,
      (servant) => resolveEffectTier(filterState.effect, servant.rarity),
      (servant) => openDetailModal(servant, REGION),
    );
  }

  function populateClassOptions(servants: ServantSummary[]): void {
    const select = filterBar.querySelector<HTMLSelectElement>("#class-filter");
    if (!select) return;
    const classes = Array.from(new Set(servants.map((s) => s.className))).sort();
    for (const className of classes) {
      const option = document.createElement("option");
      option.value = className;
      option.textContent = classLabel(className);
      select.appendChild(option);
    }
  }

  function buildShell(): Node[] {
    const header = document.createElement("header");
    header.className = "page-header";

    const titleWrap = document.createElement("div");
    const h1 = document.createElement("h1");
    h1.textContent = "Gallery";
    const tagline = document.createElement("p");
    tagline.textContent =
      "Hover or tilt a servant to reveal its foil. Data from the Atlas Academy API.";
    titleWrap.append(h1, tagline);
    header.appendChild(titleWrap);

    const filterBar = document.createElement("div");
    filterBar.className = "filter-bar";
    filterBar.hidden = true;

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search by name…";
    search.setAttribute("aria-label", "Search by name");
    search.addEventListener("input", () => {
      filterState.search = search.value;
      renderFiltered();
    });

    const classSelect = document.createElement("select");
    classSelect.id = "class-filter";
    classSelect.setAttribute("aria-label", "Filter by class");
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All classes";
    classSelect.appendChild(allOption);
    classSelect.addEventListener("change", () => {
      filterState.className = classSelect.value;
      renderFiltered();
    });

    const effectSelect = document.createElement("select");
    effectSelect.id = "effect-filter";
    effectSelect.setAttribute("aria-label", "Holo style");
    for (const option of EFFECT_SELECTION_OPTIONS) {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      effectSelect.appendChild(el);
    }
    effectSelect.addEventListener("change", () => {
      filterState.effect = effectSelect.value as EffectSelection;
      renderFiltered();
    });

    const rarityToggle = document.createElement("div");
    rarityToggle.className = "rarity-toggle";
    const featuredBtn = makeToggleButton("4★ & 5★", true, () => setRarity("featured"));
    const allBtn = makeToggleButton("All rarities", false, () => setRarity("all"));
    rarityToggle.append(featuredBtn, allBtn);

    function setRarity(value: "featured" | "all"): void {
      filterState.rarity = value;
      featuredBtn.classList.toggle("is-selected", value === "featured");
      allBtn.classList.toggle("is-selected", value === "all");
      renderFiltered();
    }

    filterBar.append(search, classSelect, effectSelect, rarityToggle);

    const content = document.createElement("div");
    content.id = "content";

    return [header, filterBar, content];
  }

  return () => {
    unsubscribe();
    renderCardGrid(
      content,
      [],
      () => "basic",
      () => {},
    );
  };
}

function makeToggleButton(
  label: string,
  selected: boolean,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.classList.toggle("is-selected", selected);
  button.addEventListener("click", onClick);
  return button;
}

function applyFilters(servants: ServantSummary[], state: FilterState): ServantSummary[] {
  const search = state.search.trim().toLowerCase();
  return servants.filter((servant) => {
    if (state.rarity === "featured" && servant.rarity < 4) return false;
    if (state.className !== "all" && servant.className !== state.className) return false;
    if (search && !servant.name.toLowerCase().includes(search)) return false;
    return true;
  });
}

function buildLoadingState(): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "status-panel";
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  const text = document.createElement("p");
  text.textContent = "Summoning the servant roster…";
  panel.append(spinner, text);
  return panel;
}

function buildErrorState(onRetry: () => void): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "status-panel";
  const text = document.createElement("p");
  text.textContent =
    "Couldn't reach the Atlas Academy API, and the offline sample also failed to load.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Try again";
  retry.addEventListener("click", onRetry);
  panel.append(text, retry);
  return panel;
}

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}
