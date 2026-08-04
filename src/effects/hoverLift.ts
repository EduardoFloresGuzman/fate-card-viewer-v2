import { gsap } from "gsap";
import { prefersReducedMotion } from "./motionPreference.ts";

/**
 * Attaches a GSAP-driven "lift" hover (translateY + scale + shadow) to `el`. Used for content
 * cards (fact tiles, highlight cards, class tiles, holo swatches) — a mouse-triggered, on-demand
 * transform, not an ambient/looping one, so it's a much smaller reduced-motion concern than
 * autoplaying motion; still gated for consistency with the rest of the app's animations, which
 * are all centrally checked via `prefersReducedMotion()` rather than left as ad hoc exceptions.
 * Returns a cleanup function that removes the listeners.
 */
export function attachHoverLift(el: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};

  function onEnter(): void {
    gsap.to(el, { y: -6, scale: 1.03, duration: 0.25, ease: "power2.out" });
  }
  function onLeave(): void {
    gsap.to(el, { y: 0, scale: 1, duration: 0.35, ease: "power2.out" });
  }

  el.addEventListener("pointerenter", onEnter);
  el.addEventListener("pointerleave", onLeave);

  return () => {
    el.removeEventListener("pointerenter", onEnter);
    el.removeEventListener("pointerleave", onLeave);
  };
}
