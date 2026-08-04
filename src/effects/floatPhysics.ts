import { prefersReducedMotion } from "./motionPreference.ts";

interface Body {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const MIN_SPEED = 12;
const MAX_SPEED = 28;

/**
 * Drives continuous random drift + circle-circle elastic collision ("rebound") for the hero's
 * floating decorative icons. Hand-rolled rather than reaching for a physics library (matching why
 * `pointerTilt.ts`'s tilt math is hand-rolled instead of using an animation library) — this is a
 * small, bounded-N (a couple dozen circles), narrowly-scoped simulation; a general physics engine
 * would be a lot of API surface and bundle weight for exactly one decorative effect.
 *
 * Each `icons[i]` element must already have its rendered size set (width/height) — its `offsetWidth`
 * is read once at startup to size its collision radius. Position is written every frame as
 * `transform: translate3d(...)`, never `top`/`left`, to stay compositor-friendly.
 *
 * Under reduced motion, positions the icons once (a plain scattered layout, no motion) and returns
 * a no-op cleanup — no RAF loop is started at all.
 */
export function initFloatPhysics(container: HTMLElement, icons: HTMLElement[]): () => void {
  if (icons.length === 0) return () => {};

  const containerRect = container.getBoundingClientRect();
  const bodies: Body[] = icons.map((el) => {
    const radius = el.offsetWidth / 2;
    const x = Math.random() * Math.max(1, containerRect.width - radius * 2) + radius;
    const y = Math.random() * Math.max(1, containerRect.height - radius * 2) + radius;
    const angle = Math.random() * Math.PI * 2;
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    return { el, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius };
  });

  for (const body of bodies) {
    body.el.style.transform = `translate3d(${body.x - body.radius}px, ${body.y - body.radius}px, 0)`;
  }

  if (prefersReducedMotion()) return () => {};

  let frameHandle = 0;
  let lastTime = performance.now();

  function tick(now: number): void {
    // Clamped so a backgrounded/throttled tab resuming doesn't apply one giant catch-up jump.
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    const bounds = container.getBoundingClientRect();

    for (const body of bodies) {
      body.x += body.vx * dt;
      body.y += body.vy * dt;

      if (body.x - body.radius < 0) {
        body.x = body.radius;
        body.vx = Math.abs(body.vx);
      } else if (body.x + body.radius > bounds.width) {
        body.x = bounds.width - body.radius;
        body.vx = -Math.abs(body.vx);
      }
      if (body.y - body.radius < 0) {
        body.y = body.radius;
        body.vy = Math.abs(body.vy);
      } else if (body.y + body.radius > bounds.height) {
        body.y = bounds.height - body.radius;
        body.vy = -Math.abs(body.vy);
      }
    }

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        resolveCollision(bodies[i]!, bodies[j]!);
      }
    }

    for (const body of bodies) {
      body.el.style.transform = `translate3d(${body.x - body.radius}px, ${body.y - body.radius}px, 0)`;
    }

    frameHandle = requestAnimationFrame(tick);
  }

  frameHandle = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(frameHandle);
}

/** Equal-mass elastic collision: separate overlapping circles, then swap their velocity components along the collision normal. */
function resolveCollision(a: Body, b: Body): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const minDist = a.radius + b.radius;
  if (dist >= minDist) return;

  const nx = dx / dist;
  const ny = dy / dist;

  const overlap = minDist - dist;
  a.x -= (nx * overlap) / 2;
  a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2;
  b.y += (ny * overlap) / 2;

  const closingSpeed = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (closingSpeed <= 0) return; // already moving apart

  a.vx -= closingSpeed * nx;
  a.vy -= closingSpeed * ny;
  b.vx += closingSpeed * nx;
  b.vy += closingSpeed * ny;
}
