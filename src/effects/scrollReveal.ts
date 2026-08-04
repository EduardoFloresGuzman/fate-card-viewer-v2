import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "./motionPreference.ts";

gsap.registerPlugin(ScrollTrigger);

const REVEAL_FROM = { opacity: 0, y: 60, scale: 0.94, filter: "blur(6px)" };
const REVEAL_TO = {
  opacity: 1,
  y: 0,
  scale: 1,
  filter: "blur(0px)",
  duration: 0.9,
  ease: "power3.out",
};

/**
 * Wires every not-yet-bound `.reveal` element under `root` to animate in once it scrolls into
 * view (GSAP ScrollTrigger — much larger travel/scale/blur than a plain CSS fade, matching the
 * "cool scroll transition" reference site rather than the original, too-subtle CSS-only version).
 * Elements inside a `[data-reveal-group]` container stagger together as one cascading wave (e.g.
 * a grid of stat tiles); standalone `.reveal` elements animate individually.
 *
 * Safe to call repeatedly on the same root — each element is bound at most once (tracked via a
 * `data-reveal-bound` marker), so this can be called again after async content (e.g. a fact grid
 * populated once the servant roster loads) adds new `.reveal` elements. Returns a cleanup
 * function that kills only the ScrollTrigger instances *this call* created — callers must invoke
 * it on teardown, since a killed page's now-detached elements would otherwise leave dead
 * ScrollTrigger instances listening to scroll/resize forever.
 */
export function initScrollReveal(root: ParentNode = document): () => void {
  const reduced = prefersReducedMotion();
  const createdTriggers: ScrollTrigger[] = [];
  const handled = new Set<Element>();

  function isBound(el: HTMLElement): boolean {
    return el.dataset["revealBound"] === "true";
  }
  function markBound(el: HTMLElement): void {
    el.dataset["revealBound"] = "true";
  }

  for (const group of root.querySelectorAll<HTMLElement>("[data-reveal-group]")) {
    const items = [...group.querySelectorAll<HTMLElement>(".reveal")].filter((el) => !isBound(el));
    if (items.length === 0) continue;
    items.forEach((el) => {
      markBound(el);
      handled.add(el);
    });

    if (reduced) {
      gsap.set(items, { opacity: 1, y: 0, scale: 1, filter: "none" });
      continue;
    }
    const tween = gsap.fromTo(items, REVEAL_FROM, {
      ...REVEAL_TO,
      stagger: 0.12,
      scrollTrigger: { trigger: group, start: "top 82%", once: true },
    });
    if (tween.scrollTrigger) createdTriggers.push(tween.scrollTrigger);
  }

  const singles = [...root.querySelectorAll<HTMLElement>(".reveal")].filter(
    (el) => !handled.has(el) && !isBound(el),
  );
  for (const el of singles) {
    markBound(el);
    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0, scale: 1, filter: "none" });
      continue;
    }
    const tween = gsap.fromTo(el, REVEAL_FROM, {
      ...REVEAL_TO,
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
    if (tween.scrollTrigger) createdTriggers.push(tween.scrollTrigger);
  }

  return () => {
    for (const trigger of createdTriggers) trigger.kill();
  };
}

/** Call after adding content that changes document height (e.g. populating a deferred section) so ScrollTrigger recalculates trigger positions. */
export function refreshScrollReveal(): void {
  ScrollTrigger.refresh();
}
