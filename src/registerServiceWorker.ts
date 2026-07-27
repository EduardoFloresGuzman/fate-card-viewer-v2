/** Registers the image-caching service worker (public/sw.js). No-ops in unsupported browsers. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err: unknown) => {
      console.warn("Image cache service worker registration failed:", err);
    });
  });
}
