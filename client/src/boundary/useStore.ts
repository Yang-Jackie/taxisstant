import { useSyncExternalStore } from "react";
import type { Store } from "../control/Store";

/** Re-renders the component whenever the store changes, and returns its current state. */
export function useStore<S>(store: Store<S>): S {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
