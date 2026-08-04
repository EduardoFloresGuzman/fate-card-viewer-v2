import "@fontsource/anton/latin-400.css";
import "./styles/index.css";
import { gsap } from "gsap";
import { renderGalleryPage } from "./pages/gallery.ts";
import { renderHomePage } from "./pages/home.ts";
import { registerServiceWorker } from "./registerServiceWorker.ts";
import { onRouteChange, navigate, type Route } from "./router.ts";
import { REGION, loadRosterOnce } from "./servantStore.ts";
import { prefersReducedMotion } from "./effects/motionPreference.ts";

registerServiceWorker();
loadRosterOnce(REGION);

const app = required(document.querySelector<HTMLDivElement>("#app"), "Missing #app root element");
app.replaceChildren(...buildShell());

const outlet = required(app.querySelector<HTMLElement>("#page-outlet"), "Shell failed to build");
const navLinks = app.querySelectorAll<HTMLAnchorElement>(".site-nav__link");

const PAGE_RENDERERS: Record<Route, (mount: HTMLElement) => () => void> = {
  home: renderHomePage,
  gallery: renderGalleryPage,
};

let teardownCurrentPage: (() => void) | null = null;
let isFirstRender = true;

onRouteChange((route) => {
  for (const link of navLinks) {
    link.classList.toggle("is-active", link.dataset["route"] === route);
  }

  // The swap itself is always synchronous — it must never be gated behind an animation promise.
  // A WAAPI-backed `.finished` promise can hang indefinitely on a backgrounded/non-compositing
  // tab (confirmed directly: 30s+ hang under that condition), so awaiting one before swapping
  // would risk the page getting stuck showing the previous route forever. GSAP's `gsap.to()` is
  // callback-based rather than promise-gated, but the same rule still applies: fire the fade
  // after the swap, fire-and-forget, never make the swap depend on it finishing.
  teardownCurrentPage?.();
  teardownCurrentPage = PAGE_RENDERERS[route](outlet);

  if (!isFirstRender && !prefersReducedMotion()) {
    gsap.fromTo(outlet, { opacity: 0 }, { opacity: 1, duration: 0.2 });
  }
  isFirstRender = false;
});

function buildShell(): Node[] {
  const nav = document.createElement("header");
  nav.className = "site-nav";

  const logo = document.createElement("a");
  logo.className = "site-nav__logo";
  logo.href = "#/";
  logo.addEventListener("click", (event) => {
    event.preventDefault();
    navigate("home");
  });

  const logoIcon = document.createElement("img");
  logoIcon.src = "/favicon.svg";
  logoIcon.alt = "";
  logoIcon.className = "site-nav__logo-icon";

  const logoText = document.createElement("span");
  logoText.textContent = "Fate Holo Codex";

  logo.append(logoIcon, logoText);

  const links = document.createElement("nav");
  links.className = "site-nav__links";

  const homeLink = makeNavLink("Home", "home");
  const galleryLink = makeNavLink("Gallery", "gallery");
  links.append(homeLink, galleryLink);

  nav.append(logo, links);

  const outlet = document.createElement("div");
  outlet.id = "page-outlet";

  return [nav, outlet];
}

function makeNavLink(label: string, route: Route): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "site-nav__link";
  link.dataset["route"] = route;
  link.href = route === "home" ? "#/" : `#/${route}`;
  link.textContent = label;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(route);
  });
  return link;
}

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}
