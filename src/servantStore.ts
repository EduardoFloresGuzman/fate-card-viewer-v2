import { fetchServants } from "./api/atlasAcademy.ts";
import type { Region, ServantSummary } from "./api/types.ts";

export const REGION: Region = "NA";

export type RosterState =
  | { status: "loading" }
  | { status: "ready"; servants: ServantSummary[] }
  | { status: "error"; error: unknown };

let state: RosterState = { status: "loading" };
let loadStarted = false;
const listeners = new Set<(state: RosterState) => void>();

function setState(next: RosterState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

/** Idempotent — safe to call from every page; the underlying fetch only ever runs once. */
export function loadRosterOnce(region: Region): void {
  if (loadStarted) return;
  loadStarted = true;
  runFetch(region);
}

/** For the error state's "try again" button — re-runs the fetch regardless of `loadRosterOnce`'s guard. */
export function retryRoster(region: Region): void {
  setState({ status: "loading" });
  runFetch(region);
}

function runFetch(region: Region): void {
  fetchServants(region)
    .then((servants) => setState({ status: "ready", servants }))
    .catch((error) => setState({ status: "error", error }));
}

export function getRosterState(): RosterState {
  return state;
}

/** Calls `listener` immediately with the current state, then again on every change. Returns an unsubscribe function. */
export function subscribeRoster(listener: (state: RosterState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}
