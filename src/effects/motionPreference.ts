/** Checked once per call site (not cached) — cheap, and respects a mid-session OS setting change. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
