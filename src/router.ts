export type Route = "home" | "gallery";

const ROUTES_BY_HASH: Record<string, Route> = {
  "": "home",
  "#": "home",
  "#/": "home",
  "#/gallery": "gallery",
};

function currentRoute(): Route {
  return ROUTES_BY_HASH[window.location.hash] ?? "home";
}

/** Registers `listener` for the current route and every subsequent hash change; returns an unsubscribe function. */
export function onRouteChange(listener: (route: Route) => void): () => void {
  const handler = () => listener(currentRoute());
  window.addEventListener("hashchange", handler);
  handler();
  return () => window.removeEventListener("hashchange", handler);
}

export function navigate(route: Route): void {
  window.location.hash = route === "home" ? "/" : `/${route}`;
}
