/**
 * A deliberately tiny sibling to `TiltController` (`../effects/pointerTilt.ts`) — NOT a reuse of
 * it. TiltController does per-card 3D rotation math or many independent cards; this drives two
 * shared CSS custom properties (`--hero-pointer-x/y`, each -1..1) on one container so the hero's
 * floating decorative icons can nudge with the pointer. No rotation, no per-element listeners.
 */
export function initHeroParallax(container: HTMLElement): () => void {
  let frame = 0;
  let latestX = 0;
  let latestY = 0;

  function scheduleWrite(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      container.style.setProperty("--hero-pointer-x", latestX.toFixed(3));
      container.style.setProperty("--hero-pointer-y", latestY.toFixed(3));
    });
  }

  function onPointerMove(event: PointerEvent): void {
    const rect = container.getBoundingClientRect();
    latestX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    latestY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    scheduleWrite();
  }

  function onPointerLeave(): void {
    latestX = 0;
    latestY = 0;
    scheduleWrite();
  }

  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerleave", onPointerLeave);

  return () => {
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerleave", onPointerLeave);
    if (frame) cancelAnimationFrame(frame);
    container.style.removeProperty("--hero-pointer-x");
    container.style.removeProperty("--hero-pointer-y");
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
