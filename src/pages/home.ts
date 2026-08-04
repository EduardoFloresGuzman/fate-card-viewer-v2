import { gsap } from "gsap";
import {
  classAccentColor,
  EFFECT_SELECTION_OPTIONS,
  type EffectTier,
} from "../api/rarityEffects.ts";
import type { ServantSummary } from "../api/types.ts";
import {
  getClassBreakdown,
  pickRandomRosterFacts,
  pickRandomServantHighlights,
  type ClassBreakdown,
  type RosterFact,
  type ServantHighlight,
} from "../factGenerators.ts";
import { attachHoverLift } from "../effects/hoverLift.ts";
import { initFloatPhysics } from "../effects/floatPhysics.ts";
import { prefersReducedMotion } from "../effects/motionPreference.ts";
import { initScrollReveal, refreshScrollReveal } from "../effects/scrollReveal.ts";
import { initSectionDividers } from "../effects/sectionDividers.ts";
import { pickRandomPull } from "../randomPull.ts";
import { renderCardGrid } from "../render/cardGrid.ts";
import { openDetailModal } from "../render/detailModal.ts";
import { classLabel, effectClassName } from "../render/format.ts";
import { navigate } from "../router.ts";
import { REGION, subscribeRoster, type RosterState } from "../servantStore.ts";

const FLOAT_ICON_COUNT = 24;
const FACT_COUNT = 6;
const HIGHLIGHT_COUNT = 3;
const MARQUEE_ICON_COUNT = 16;
/** The 6 color-foil shine tiers — "basic" has no shine to showcase, "diorama" is a wholly
 * different two-layer DOM structure that doesn't fit this flat-swatch format. */
const HOLO_SWATCH_TIERS: Array<{ value: EffectTier; label: string }> =
  EFFECT_SELECTION_OPTIONS.filter(
    (option): option is { value: EffectTier; label: string } =>
      option.value !== "auto" && option.value !== "basic" && option.value !== "diorama",
  );

/** Renders the hero/randomizer landing page into `mount`. Returns a teardown function. */
export function renderHomePage(mount: HTMLElement): () => void {
  let servants: ServantSummary[] = [];
  let hasPulledOnce = false;
  let iconsPopulated = false;
  let factsPopulated = false;
  let highlightsPopulated = false;
  let classesPopulated = false;
  let marqueePopulated = false;
  const revealCleanups: Array<() => void> = [];
  const hoverCleanups: Array<() => void> = [];

  mount.replaceChildren(
    buildHero(),
    buildDivider(),
    buildAboutSection(),
    buildDivider(),
    buildFactsSection(),
    buildDivider(),
    buildHighlightsSection(),
    buildDivider(),
    buildClassRosterSection(),
    buildDivider(),
    buildMarqueeSection(),
    buildDivider(),
    buildHoloGallerySection(),
  );

  const pullButton = required(
    mount.querySelector<HTMLButtonElement>(".hero__pull-btn"),
    "Home shell failed to build",
  );
  const heroCardMount = required(
    mount.querySelector<HTMLElement>(".hero__card-mount"),
    "Home shell failed to build",
  );
  const floatLayer = required(
    mount.querySelector<HTMLElement>(".hero__floats"),
    "Home shell failed to build",
  );
  const galleryLink = mount.querySelector<HTMLAnchorElement>(".hero__gallery-link");

  galleryLink?.addEventListener("click", (event) => {
    event.preventDefault();
    navigate("gallery");
  });

  let stopFloatPhysics: (() => void) | null = null;

  const unsubscribe = subscribeRoster((state) => handleRosterState(state));
  revealCleanups.push(initScrollReveal(mount));
  revealCleanups.push(initSectionDividers(mount));
  animateHeroTitle(mount.querySelectorAll<HTMLElement>(".hero__heading-line"));

  // Static content — doesn't depend on the roster, so it's populated immediately rather than
  // deferred like the data-driven sections below.
  populateHoloGallery();

  function handleRosterState(state: RosterState): void {
    pullButton.disabled = state.status !== "ready";
    pullButton.textContent =
      state.status === "ready"
        ? hasPulledOnce
          ? "Pull Again"
          : "Pull a Servant"
        : state.status === "error"
          ? "Roster unavailable"
          : "Loading roster…";

    if (state.status === "ready") {
      servants = state.servants;
      populateFloatingIcons(servants);
      populateFactsSection(servants);
      populateHighlightsSection(servants);
      populateClassRosterSection(servants);
      populateMarquee(servants);
    }
  }

  function populateFloatingIcons(roster: ServantSummary[]): void {
    if (iconsPopulated) return;
    iconsPopulated = true;
    const withIcons = roster.filter((s) => s.faceIcon);
    const sample = sampleServants(withIcons, FLOAT_ICON_COUNT);
    const iconEls = sample.map(buildFloatIcon);
    floatLayer.replaceChildren(...iconEls);
    // Physics needs each icon's real rendered size (offsetWidth) to compute its collision
    // radius, so this only runs once the elements are actually in the DOM, not before.
    stopFloatPhysics = initFloatPhysics(floatLayer, iconEls);
  }

  function populateFactsSection(roster: ServantSummary[]): void {
    if (factsPopulated) return;
    factsPopulated = true;
    const grid = mount.querySelector<HTMLElement>(".facts__grid");
    if (!grid) return;
    const facts = pickRandomRosterFacts(roster, FACT_COUNT);
    grid.replaceChildren(...facts.map(buildFactTile));
    bindReveal();
    for (const tile of grid.querySelectorAll<HTMLElement>(".fact-tile")) {
      hoverCleanups.push(attachHoverLift(tile));
    }
  }

  function populateHighlightsSection(roster: ServantSummary[]): void {
    if (highlightsPopulated) return;
    highlightsPopulated = true;
    const grid = mount.querySelector<HTMLElement>(".highlights__grid");
    if (!grid) return;
    const highlights = pickRandomServantHighlights(roster, HIGHLIGHT_COUNT);
    grid.replaceChildren(...highlights.map(buildHighlightCard));
    bindReveal();
    for (const card of grid.querySelectorAll<HTMLElement>(".highlight-card")) {
      hoverCleanups.push(attachHoverLift(card));
    }
  }

  function populateClassRosterSection(roster: ServantSummary[]): void {
    if (classesPopulated) return;
    classesPopulated = true;
    const grid = mount.querySelector<HTMLElement>(".class-roster__grid");
    if (!grid) return;
    const breakdown = getClassBreakdown(roster);
    grid.replaceChildren(...breakdown.map(buildClassTile));
    bindReveal();
    for (const tile of grid.querySelectorAll<HTMLElement>(".class-tile")) {
      hoverCleanups.push(attachHoverLift(tile));
    }
  }

  function populateMarquee(roster: ServantSummary[]): void {
    if (marqueePopulated) return;
    marqueePopulated = true;
    const track = mount.querySelector<HTMLElement>(".marquee__track");
    if (!track) return;
    const withIcons = roster.filter((s) => s.faceIcon);
    const sample = sampleServants(withIcons, MARQUEE_ICON_COUNT);
    if (sample.length === 0) return;
    const icons = sample.map(buildMarqueeIcon);
    // Duplicated so a translateX(-50%) loop is seamless — at the halfway point the track shows
    // exactly the same icons it started with.
    track.replaceChildren(...icons, ...icons.map((el) => el.cloneNode(true) as HTMLElement));
  }

  function populateHoloGallery(): void {
    const grid = mount.querySelector<HTMLElement>(".holo-gallery__grid");
    if (!grid) return;
    grid.replaceChildren(
      ...HOLO_SWATCH_TIERS.map((tier) => buildHoloSwatch(tier.value, tier.label)),
    );
    for (const swatch of grid.querySelectorAll<HTMLElement>(".holo-swatch")) {
      hoverCleanups.push(attachHoverLift(swatch));
    }
  }

  /** Re-runs reveal binding + a ScrollTrigger refresh after content is added post-load — see scrollReveal.ts. */
  function bindReveal(): void {
    revealCleanups.push(initScrollReveal(mount));
    refreshScrollReveal();
  }

  function pull(): void {
    if (servants.length === 0) return;
    const result = pickRandomPull(servants);
    renderCardGrid(
      heroCardMount,
      [result.servant],
      () => result.effectTier,
      (s) => openDetailModal(s, REGION),
      () => result.ascension,
    );
    heroCardMount.classList.add("card-grid--hero");
    hasPulledOnce = true;
    pullButton.textContent = "Pull Again";
    revealHeroCard(heroCardMount.querySelector<HTMLElement>(".card-frame"));
  }

  pullButton.addEventListener("click", pull);

  return () => {
    unsubscribe();
    stopFloatPhysics?.();
    for (const stop of revealCleanups) stop();
    for (const stop of hoverCleanups) stop();
    renderCardGrid(
      heroCardMount,
      [],
      () => "basic",
      () => {},
    );
  };
}

function revealHeroCard(el: HTMLElement | null): void {
  if (!el) return;
  if (prefersReducedMotion()) {
    gsap.set(el, { opacity: 1, scale: 1, y: 0 });
    return;
  }
  gsap.fromTo(
    el,
    { opacity: 0, scale: 0.85, y: 16 },
    { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "power3.out" },
  );
}

function sampleServants(servants: ServantSummary[], count: number): ServantSummary[] {
  const pool = [...servants];
  const sample: ServantSummary[] = [];
  while (pool.length > 0 && sample.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    sample.push(pool.splice(index, 1)[0]!);
  }
  return sample;
}

/** Position comes entirely from floatPhysics.ts's per-frame drift/collision simulation — this
 * only needs to pick a random display size for variety before physics reads it via offsetWidth. */
function buildFloatIcon(servant: ServantSummary): HTMLElement {
  const el = document.createElement("div");
  el.className = "hero__float";
  const size = 1.5 + Math.random() * 2.1;
  el.style.width = `${size}rem`;
  el.style.height = `${size}rem`;

  const img = document.createElement("img");
  img.src = servant.faceIcon ?? "";
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";

  el.appendChild(img);
  return el;
}

/** Slides each hero__heading-line up from behind its overflow-clipped mask, staggered — a more
 * pronounced, dedicated entrance than the generic blur/scale `.reveal` treatment used elsewhere,
 * since the title is the single most important element on the page. Not scroll-triggered (the
 * hero is always above the fold on load), just a one-shot animation fired on mount. */
function animateHeroTitle(lines: NodeListOf<HTMLElement>): void {
  if (lines.length === 0) return;
  if (prefersReducedMotion()) {
    gsap.set(lines, { yPercent: 0 });
    return;
  }
  gsap.set(lines, { yPercent: 110 });
  gsap.to(lines, { yPercent: 0, duration: 0.9, ease: "power4.out", stagger: 0.12, delay: 0.15 });
}

function buildFactTile(fact: RosterFact): HTMLElement {
  const tile = document.createElement("div");
  tile.className = "fact-tile reveal";

  const value = document.createElement("strong");
  value.className = "fact-tile__value";
  value.textContent = fact.value;

  const label = document.createElement("span");
  label.className = "fact-tile__label";
  label.textContent = fact.label;

  tile.append(value, label);
  return tile;
}

function buildHighlightCard(highlight: ServantHighlight): HTMLElement {
  const card = document.createElement("div");
  card.className = "highlight-card reveal";

  const icon = document.createElement("img");
  icon.className = "highlight-card__icon";
  icon.src = highlight.servant.faceIcon ?? "";
  icon.alt = "";
  icon.loading = "lazy";
  icon.decoding = "async";

  const info = document.createElement("div");
  info.className = "highlight-card__info";

  const label = document.createElement("span");
  label.className = "highlight-card__label";
  label.textContent = highlight.label;

  const name = document.createElement("span");
  name.className = "highlight-card__name";
  name.textContent = highlight.servant.name;

  const stat = document.createElement("span");
  stat.className = "highlight-card__stat";
  stat.textContent = highlight.stat;

  info.append(label, name, stat);
  card.append(icon, info);
  return card;
}

function buildClassTile(entry: ClassBreakdown): HTMLElement {
  const tile = document.createElement("div");
  tile.className = "class-tile reveal";
  tile.style.setProperty("--class-color", classAccentColor(entry.className));

  const monogram = document.createElement("span");
  monogram.className = "class-tile__monogram";
  monogram.textContent = classLabel(entry.className).charAt(0);

  const name = document.createElement("span");
  name.className = "class-tile__name";
  name.textContent = classLabel(entry.className);

  const count = document.createElement("span");
  count.className = "class-tile__count";
  count.textContent = `${entry.count} servant${entry.count === 1 ? "" : "s"}`;

  tile.append(monogram, name, count);
  return tile;
}

function buildHoloSwatch(tier: EffectTier, label: string): HTMLElement {
  const swatch = document.createElement("div");
  swatch.className = "holo-swatch reveal";

  const shine = document.createElement("div");
  shine.className = `card__shine ${effectClassName(tier)}`;

  const swatchLabel = document.createElement("span");
  swatchLabel.className = "holo-swatch__label";
  swatchLabel.textContent = label;

  swatch.append(shine, swatchLabel);
  return swatch;
}

function buildMarqueeIcon(servant: ServantSummary): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "marquee__icon";

  const img = document.createElement("img");
  img.src = servant.faceIcon ?? "";
  img.alt = servant.name;
  img.loading = "lazy";
  img.decoding = "async";

  wrap.appendChild(img);
  return wrap;
}

function buildDivider(): HTMLElement {
  const divider = document.createElement("div");
  divider.className = "section-divider";
  return divider;
}

function buildHero(): HTMLElement {
  const section = document.createElement("section");
  section.className = "hero";

  const floats = document.createElement("div");
  floats.className = "hero__floats";
  section.appendChild(floats);

  const textZone = document.createElement("div");
  textZone.className = "hero__text";
  textZone.setAttribute("data-reveal-group", "");

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow reveal";
  eyebrow.textContent = "Fate Holo Codex";

  const heading = document.createElement("h1");
  heading.className = "hero__heading";
  for (const line of ["Pull a", "Servant", "Card"]) {
    const mask = document.createElement("span");
    mask.className = "hero__heading-mask";
    const lineEl = document.createElement("span");
    lineEl.className = "hero__heading-line";
    lineEl.textContent = line;
    mask.appendChild(lineEl);
    heading.appendChild(mask);
  }

  const ctaRow = document.createElement("div");
  ctaRow.className = "hero__cta-row reveal";

  const pullButton = document.createElement("button");
  pullButton.type = "button";
  pullButton.className = "btn btn--primary hero__pull-btn";
  pullButton.textContent = "Loading roster…";
  pullButton.disabled = true;

  const galleryLink = document.createElement("a");
  galleryLink.className = "btn btn--secondary hero__gallery-link";
  galleryLink.href = "#/gallery";
  galleryLink.textContent = "Browse Gallery";

  ctaRow.append(pullButton, galleryLink);
  textZone.append(eyebrow, heading, ctaRow);

  const cardZone = document.createElement("div");
  cardZone.className = "hero__card-zone reveal";
  const cardMount = document.createElement("div");
  cardMount.className = "hero__card-mount";
  cardZone.appendChild(cardMount);

  section.append(textZone, cardZone);
  return section;
}

function buildAboutSection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "about";

  const inner = document.createElement("div");
  inner.className = "about__inner reveal";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "The Project";

  const heading = document.createElement("h2");
  heading.className = "section-heading";
  heading.innerHTML = "A Trading Card,<br>Reimagined";

  const body = document.createElement("p");
  body.className = "about__body";
  body.textContent =
    "Fate Holo Codex is an interactive holographic trading-card viewer for Fate/Grand Order " +
    "servants, inspired by the tilt-and-foil effect of poke-holo.simey.me. Every card is real " +
    "Atlas Academy game data — full illustrations, ascension art, stats, skills, and Noble " +
    "Phantasms — rendered with original holo finishes and a 3D parallax mode, built from " +
    "scratch with pointer-tracked CSS, no animation library and no copied textures.";

  const stats = document.createElement("ul");
  stats.className = "about__stats";
  const statEntries = [
    { value: "400+", label: "servants" },
    { value: "8", label: "holo finishes" },
    { value: "4", label: "ascension arts each" },
  ];
  for (const { value, label } of statEntries) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(strong, ` ${label}`);
    stats.appendChild(item);
  }

  inner.append(eyebrow, heading, body, stats);
  section.appendChild(inner);
  return section;
}

function buildFactsSection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "facts section--tinted";

  const inner = document.createElement("div");
  inner.className = "facts__inner";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow reveal";
  eyebrow.textContent = "By The Numbers";

  const heading = document.createElement("h2");
  heading.className = "section-heading reveal";
  heading.textContent = "Roster Stats";

  const grid = document.createElement("div");
  grid.className = "facts__grid";
  grid.setAttribute("data-reveal-group", "");

  inner.append(eyebrow, heading, grid);
  section.appendChild(inner);
  return section;
}

function buildHighlightsSection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "highlights";

  const inner = document.createElement("div");
  inner.className = "highlights__inner";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow reveal";
  eyebrow.textContent = "Roster Highlights";

  const heading = document.createElement("h2");
  heading.className = "section-heading reveal";
  heading.textContent = "Spotlight Picks";

  const grid = document.createElement("div");
  grid.className = "highlights__grid";
  grid.setAttribute("data-reveal-group", "");

  inner.append(eyebrow, heading, grid);
  section.appendChild(inner);
  return section;
}

function buildClassRosterSection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "class-roster section--tinted";

  const inner = document.createElement("div");
  inner.className = "class-roster__inner";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow reveal";
  eyebrow.textContent = "Explore By Class";

  const heading = document.createElement("h2");
  heading.className = "section-heading reveal";
  heading.textContent = "The Class Roster";

  const grid = document.createElement("div");
  grid.className = "class-roster__grid";
  grid.setAttribute("data-reveal-group", "");

  inner.append(eyebrow, heading, grid);
  section.appendChild(inner);
  return section;
}

function buildMarqueeSection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "marquee-section";

  const track = document.createElement("div");
  track.className = "marquee__track";
  section.appendChild(track);
  return section;
}

function buildHoloGallerySection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "holo-gallery section--tinted";

  const inner = document.createElement("div");
  inner.className = "holo-gallery__inner";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow reveal";
  eyebrow.textContent = "Every Finish";

  const heading = document.createElement("h2");
  heading.className = "section-heading reveal";
  heading.textContent = "Holo Finish Gallery";

  const grid = document.createElement("div");
  grid.className = "holo-gallery__grid";
  grid.setAttribute("data-reveal-group", "");

  inner.append(eyebrow, heading, grid);
  section.appendChild(inner);
  return section;
}

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}
