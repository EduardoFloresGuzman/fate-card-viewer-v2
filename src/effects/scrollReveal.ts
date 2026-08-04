import { inView } from "motion";
import { prefersReducedMotion } from "./motionPreference.ts";

/**
 * Wires every `.reveal` element under `root` to add `.is-visible` once it scrolls into view.
 * Under reduced motion, skips straight to visible — content must never depend on JS timing as
 * its only path to being shown.
 */
export function initScrollReveal(root: ParentNode = document): void {
  const elements = root.querySelectorAll<HTMLElement>(".reveal");
  if (elements.length === 0) return;

  if (prefersReducedMotion()) {
    for (const el of elements) el.classList.add("is-visible");
    return;
  }

  for (const el of elements) {
    inView(el, () => {
      el.classList.add("is-visible");
    });
  }
}
