import { animate } from "motion";
import type { ServantSummary } from "../api/types.ts";
import { CREATOR, FEATURED_REPOS } from "../creatorInfo.ts";
import { initHeroParallax } from "../effects/heroParallax.ts";
import { prefersReducedMotion } from "../effects/motionPreference.ts";
import { initScrollReveal } from "../effects/scrollReveal.ts";
import { pickRandomPull } from "../randomPull.ts";
import { renderCardGrid } from "../render/cardGrid.ts";
import { openDetailModal } from "../render/detailModal.ts";
import { navigate } from "../router.ts";
import { REGION, subscribeRoster, type RosterState } from "../servantStore.ts";

const FLOAT_ICON_COUNT = 7;
const REVEAL_EASE = [0.22, 1, 0.36, 1] as const;

/** Renders the hero/randomizer landing page into `mount`. Returns a teardown function. */
export function renderHomePage(mount: HTMLElement): () => void {
  let servants: ServantSummary[] = [];
  let hasPulledOnce = false;
  let iconsPopulated = false;

  mount.replaceChildren(buildHero(), buildAboutSection(), buildCreatorSection());

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
  initScrollReveal(mount);

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
    }
  }

  function populateFloatingIcons(roster: ServantSummary[]): void {
    if (iconsPopulated) return;
    iconsPopulated = true;
    const withIcons = roster.filter((s) => s.faceIcon);
    const sample = sampleServants(withIcons, FLOAT_ICON_COUNT);
    floatLayer.replaceChildren(...sample.map(buildFloatIcon));
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
    renderCardGrid(
      heroCardMount,
      [],
      () => "basic",
      () => {},
    );
  };
}

function revealHeroCard(el: HTMLElement | null): void {
  if (!el || prefersReducedMotion()) return;
  animate(
    el,
    { opacity: [0, 1], scale: [0.85, 1], y: [16, 0] },
    { duration: 0.45, ease: REVEAL_EASE },
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

function buildFloatIcon(servant: ServantSummary): HTMLElement {
  const outer = document.createElement("div");
  outer.className = "hero__float";

  const inner = document.createElement("div");
  inner.className = "hero__float-inner";

  const img = document.createElement("img");
  img.src = servant.faceIcon ?? "";
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";

  inner.appendChild(img);
  outer.appendChild(inner);
  return outer;
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

function buildCreatorSection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "creator";

  const card = document.createElement("div");
  card.className = "creator__card reveal";

  const avatar = document.createElement("img");
  avatar.className = "creator__avatar";
  avatar.src = CREATOR.avatarUrl;
  avatar.alt = CREATOR.name;
  avatar.loading = "lazy";
  avatar.decoding = "async";

  const info = document.createElement("div");
  info.className = "creator__info";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Who Built This";

  const heading = document.createElement("h2");
  heading.className = "section-heading";
  heading.textContent = CREATOR.name;

  const bio = document.createElement("p");
  bio.className = "creator__bio";
  bio.textContent = CREATOR.bio;

  const meta = document.createElement("p");
  meta.className = "creator__meta";
  meta.textContent = `${CREATOR.company} · ${CREATOR.location}`;

  const githubLink = document.createElement("a");
  githubLink.className = "btn btn--secondary";
  githubLink.href = CREATOR.githubUrl;
  githubLink.target = "_blank";
  githubLink.rel = "noopener noreferrer";
  githubLink.textContent = "View GitHub Profile";

  info.append(eyebrow, heading, bio, meta, githubLink);
  card.append(avatar, info);

  const reposHeading = document.createElement("p");
  reposHeading.className = "eyebrow creator__repos-heading reveal";
  reposHeading.textContent = "Other Projects";

  const repoGrid = document.createElement("div");
  repoGrid.className = "creator__repo-grid";
  for (const repo of FEATURED_REPOS) {
    const repoCard = document.createElement("a");
    repoCard.className = "repo-card reveal";
    repoCard.href = repo.url;
    repoCard.target = "_blank";
    repoCard.rel = "noopener noreferrer";

    const name = document.createElement("span");
    name.className = "repo-card__name";
    name.textContent = repo.name;

    const desc = document.createElement("span");
    desc.className = "repo-card__desc";
    desc.textContent = repo.description;

    const lang = document.createElement("span");
    lang.className = "repo-card__lang";
    lang.textContent = repo.language;

    repoCard.append(name, desc, lang);
    repoGrid.appendChild(repoCard);
  }

  section.append(card, reposHeading, repoGrid);
  return section;
}

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}
