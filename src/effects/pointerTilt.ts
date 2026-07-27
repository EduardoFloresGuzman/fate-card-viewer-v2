export interface Rect {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface TiltValues {
  /** Degrees, tilts the card around the horizontal axis (nodding forward/back). */
  rotateX: number;
  /** Degrees, tilts the card around the vertical axis (turning left/right). */
  rotateY: number;
  /** Percent (0-100), pointer position within the card — drives the glare position. */
  pointerX: number;
  /** Percent (0-100), pointer position within the card — drives the glare position. */
  pointerY: number;
  /** 0 (centered) to 1 (at/past the edge) — drives glare/foil intensity. */
  pointerFromCenter: number;
}

/** Matches a resting, unrotated card facing the viewer. */
export const NEUTRAL_TILT: TiltValues = {
  rotateX: 0,
  rotateY: 0,
  pointerX: 50,
  pointerY: 50,
  pointerFromCenter: 0,
};

/** How many degrees of rotation per percentage-point the pointer sits from center. */
const ROTATE_DIVISOR = 3.5;
/** Distance (in the same 0-100 percent units) from center that reaches full glare intensity. */
const FULL_INTENSITY_DISTANCE = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pure pointer -> tilt math, decoupled from the DOM so it's trivially unit-testable.
 * `rect` only needs the four numeric fields of a DOMRect, so callers can pass a plain object.
 */
export function computeTilt(rect: Rect, clientX: number, clientY: number): TiltValues {
  const width = rect.width || 1;
  const height = rect.height || 1;

  const pointerX = clamp(((clientX - rect.left) / width) * 100, 0, 100);
  const pointerY = clamp(((clientY - rect.top) / height) * 100, 0, 100);

  const centerX = pointerX - 50;
  const centerY = pointerY - 50;

  const rotateX = -(centerY / ROTATE_DIVISOR);
  const rotateY = centerX / ROTATE_DIVISOR;
  const pointerFromCenter = clamp(
    Math.sqrt(centerX * centerX + centerY * centerY) / FULL_INTENSITY_DISTANCE,
    0,
    1,
  );

  return { rotateX, rotateY, pointerX, pointerY, pointerFromCenter };
}

function applyTilt(element: HTMLElement, tilt: TiltValues): void {
  const style = element.style;
  style.setProperty("--rotate-x", `${tilt.rotateX}deg`);
  style.setProperty("--rotate-y", `${tilt.rotateY}deg`);
  style.setProperty("--pointer-x", `${tilt.pointerX}%`);
  style.setProperty("--pointer-y", `${tilt.pointerY}%`);
  style.setProperty("--pointer-from-center", `${tilt.pointerFromCenter}`);
  // Precomputed here (not in CSS calc()) because CSS calc() cannot multiply a <percentage>
  // by an <angle> — the conic-gradient tiers need a real angle to rotate their `from` stop.
  style.setProperty("--pointer-angle", `${tilt.pointerX * 3.6}deg`);
}

/**
 * Wires pointer (and, opportunistically, device-orientation) input to the CSS custom properties
 * that drive the 3D tilt + holo sheen effect.
 *
 * Pointer events are read from `hitTestElement` — a *flat, never-transformed* wrapper — rather
 * than the card itself. Chromium's (and every other engine's) hit-testing follows the element's
 * rendered (post-transform) geometry, so a listener on the element being rotated in 3D chases its
 * own tail: as it tilts away from the pointer, the pointer appears to have "left" it, firing
 * `pointerleave`, snapping rotation back to neutral, un-tilting it, re-entering, and so on. Keeping
 * the hit-test target flat and applying the resulting transform to a separate `styleElement`
 * avoids that feedback loop entirely. All work is batched through one shared
 * `requestAnimationFrame` call so fast mouse movement never triggers more than one style write
 * per frame.
 */
export class TiltController {
  private readonly hitTestElement: HTMLElement;
  private readonly styleElement: HTMLElement;
  private rafHandle: number | null = null;
  private pendingPointer: { x: number; y: number } | null = null;
  private readonly hasDeviceOrientation: boolean;

  constructor(hitTestElement: HTMLElement, styleElement: HTMLElement = hitTestElement) {
    this.hitTestElement = hitTestElement;
    this.styleElement = styleElement;
    this.hasDeviceOrientation = typeof window !== "undefined" && "ondeviceorientation" in window;

    hitTestElement.addEventListener("pointermove", this.handlePointerMove);
    hitTestElement.addEventListener("pointerleave", this.handlePointerLeave);
    if (this.hasDeviceOrientation) {
      window.addEventListener("deviceorientation", this.handleDeviceOrientation);
    }
  }

  destroy(): void {
    this.hitTestElement.removeEventListener("pointermove", this.handlePointerMove);
    this.hitTestElement.removeEventListener("pointerleave", this.handlePointerLeave);
    if (this.hasDeviceOrientation) {
      window.removeEventListener("deviceorientation", this.handleDeviceOrientation);
    }
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.pendingPointer = { x: event.clientX, y: event.clientY };
    this.styleElement.classList.add("is-active");
    if (this.rafHandle === null) {
      this.rafHandle = requestAnimationFrame(this.flushPointer);
    }
  };

  private readonly flushPointer = (): void => {
    this.rafHandle = null;
    const pointer = this.pendingPointer;
    if (!pointer) return;
    const rect = this.hitTestElement.getBoundingClientRect();
    applyTilt(this.styleElement, computeTilt(rect, pointer.x, pointer.y));
  };

  private readonly handlePointerLeave = (): void => {
    this.pendingPointer = null;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.styleElement.classList.remove("is-active");
    applyTilt(this.styleElement, NEUTRAL_TILT);
  };

  /** Ambient tilt for handheld mobile devices. Yields to active pointer input. */
  private readonly handleDeviceOrientation = (event: DeviceOrientationEvent): void => {
    if (this.pendingPointer || event.beta === null || event.gamma === null) return;
    const rotateX = clamp(-(event.beta - 40) / ROTATE_DIVISOR, -18, 18);
    const rotateY = clamp(event.gamma / ROTATE_DIVISOR, -18, 18);
    applyTilt(this.styleElement, {
      rotateX,
      rotateY,
      pointerX: clamp(50 + rotateY, 0, 100),
      pointerY: clamp(50 + rotateX, 0, 100),
      pointerFromCenter: 0.4,
    });
  };
}
