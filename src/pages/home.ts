import { gsap } from "gsap";
import type { ServantSummary } from "../api/types.ts";
import {
  pickRandomRosterFacts,
  pickRandomServantHighlights,
  type RosterFact,
  type ServantHighlight,
} from "../factGenerators.ts";
import { initHeroParallax } from "../effects/heroParallax.ts";
import { prefersReducedMotion } from "../effects/motionPreference.ts";
import { initScrollReveal, refreshScrollReveal } from "../effects/scrollReveal.ts";
import { pickRandomPull } from "../randomPull.ts";
import { renderCardGrid } from "../render/cardGrid.ts";
import { openDetailModal } from "../render/detailModal.ts";
import { navigate } from "../router.ts";
import { REGION, subscribeRoster, type RosterState } from "../servantStore.ts";

const FLOAT_ICON_COUNT = 24;
const FACT_COUNT = 6;
const HIGHLIGHT_COUNT = 3;

/** Renders the hero/randomizer landing page into `mount`. Returns a teardown function. */
export function renderHomePage(mount: HTMLElement): () => void {
  let servants: ServantSummary[] = [];
  let hasPulledOnce = false;
  let iconsPopulated = false;
  let factsPopulated = false;
  let highlightsPopulated = false;
  const revealCleanups: Array<() => void> = [];

  mount.replaceChildren(
    buildHero(),
    buildAboutSection(),
    buildFactsSection(),
    buildHighlightsSection(),
  );

  const heroSection = required(
    mount.querySelector<HTMLElement>(".hero"),
    "Home shell failed to build",
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

  const stopParallax = prefersReducedMotion() ? null : initHeroParallax(heroSection);

  const unsubscribe = subscribeRoster((state) => handleRosterState(state));
  revealCleanups.push(initScrollReveal(mount));

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
    }
  }

  function populateFloatingIcons(roster: ServantSummary[]): void {
    if (iconsPopulated) return;
    iconsPopulated = true;
    const withIcons = roster.filter((s) => s.faceIcon);
    const sample = sampleServants(withIcons, FLOAT_ICON_COUNT);
    const positions = generateFloatPositions(sample.length);
    floatLayer.replaceChildren(
      ...sample.map((servant, i) => buildFloatIcon(servant, positions[i]!)),
    );
  }

  function populateFactsSection(roster: ServantSummary[]): void {
    if (factsPopulated) return;
    factsPopulated = true;
    const grid = mount.querySelector<HTMLElement>(".facts__grid");
    if (!grid) return;
    const facts = pickRandomRosterFacts(roster, FACT_COUNT);
    grid.replaceChildren(...facts.map(buildFactTile));
    revealCleanups.push(initScrollReveal(mount));
    refreshScrollReveal();
  }

  function populateHighlightsSection(roster: ServantSummary[]): void {
    if (highlightsPopulated) return;
    highlightsPopulated = true;
    const grid = mount.querySelector<HTMLElement>(".highlights__grid");
    if (!grid) return;
    const highlights = pickRandomServantHighlights(roster, HIGHLIGHT_COUNT);
    grid.replaceChildren(...highlights.map(buildHighlightCard));
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
    stopParallax?.();
    for (const stop of revealCleanups) stop();
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

interface FloatPosition {
  top: number;
  left: number;
  size: number;
  rotate: number;
  delay: number;
  parallax: number;
}

/** Scatters `count` icons across the hero in a jittered grid — even coverage without hand-authoring one CSS rule per icon. */
function generateFloatPositions(count: number): FloatPosition[] {
  if (count === 0) return [];
  const cols = Math.max(1, Math.round(Math.sqrt(count * (16 / 9))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const positions: FloatPosition[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = (Math.random() - 0.5) * cellW * 0.7;
    const jitterY = (Math.random() - 0.5) * cellH * 0.7;
    positions.push({
      top: row * cellH + cellH / 2 + jitterY,
      left: col * cellW + cellW / 2 + jitterX,
      size: 1.5 + Math.random() * 2.1,
      rotate: (Math.random() - 0.5) * 20,
      delay: Math.random() * 5,
      parallax: 8 + Math.random() * 22,
    });
  }
  return positions;
}

function buildFloatIcon(servant: ServantSummary, pos: FloatPosition): HTMLElement {
  const outer = document.createElement("div");
  outer.className = "hero__float";
  outer.style.top = `${pos.top}%`;
  outer.style.left = `${pos.left}%`;
  outer.style.width = `${pos.size}rem`;
  outer.style.height = `${pos.size}rem`;
  outer.style.setProperty("--float-parallax", `${pos.parallax}px`);

  const inner = document.createElement("div");
  inner.className = "hero__float-inner";
  inner.style.setProperty("--float-delay", `${pos.delay}s`);
  inner.style.setProperty("--float-rotate", `${pos.rotate}deg`);

  const img = document.createElement("img");
  img.src = servant.faceIcon ?? "";
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";

  inner.appendChild(img);
  outer.appendChild(inner);
  return outer;
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

function buildHero(): HTMLElement {
  const section = document.createElement("section");
  section.className = "hero";

  const floats = document.createElement("div");
  floats.className = "hero__floats";
  section.appendChild(floats);

  const textZone = document.createElement("div");
  textZone.className = "hero__text reveal";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Fate Holo Codex";

  const heading = document.createElement("h1");
  heading.className = "hero__heading";
  heading.innerHTML = "Pull a<br>Servant<br>Card";

  const ctaRow = document.createElement("div");
  ctaRow.className = "hero__cta-row";

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
  section.className = "facts";

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

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}
