import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "./motionPreference.ts";

gsap.registerPlugin(ScrollTrigger);

/**
 * Animates every not-yet-bound `.section-divider` under `root` drawing itself in (scaleX 0→1,
 * left-anchored) as it scrolls into view — a small recurring transition motif marking the
 * boundary between home-page sections. `scrub: true` ties progress directly to scroll position
 * rather than a one-shot reveal, so it visibly "catches up" if the user scrolls fast.
 *
 * Returns a cleanup function that kills only the ScrollTrigger instances this call created — see
 * scrollReveal.ts's initScrollReveal() for why that matters (GSAP doesn't clean up triggers bound
 * to elements removed from the DOM on its own).
 */
export function initSectionDividers(root: ParentNode = document): () => void {
  const reduced = prefersReducedMotion();
  const createdTriggers: ScrollTrigger[] = [];

  const dividers = [...root.querySelectorAll<HTMLElement>(".section-divider")].filter(
    (el) => el.dataset["dividerBound"] !== "true",
  );
  for (const el of dividers) {
    el.dataset["dividerBound"] = "true";
    if (reduced) {
      gsap.set(el, { scaleX: 1 });
      continue;
    }
    gsap.set(el, { scaleX: 0, transformOrigin: "left center" });
    const tween = gsap.to(el, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top 92%", end: "top 55%", scrub: true },
    });
    if (tween.scrollTrigger) createdTriggers.push(tween.scrollTrigger);
  }

  return () => {
    for (const trigger of createdTriggers) trigger.kill();
  };
}
