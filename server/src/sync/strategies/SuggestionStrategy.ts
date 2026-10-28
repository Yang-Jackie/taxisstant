import type { z } from "zod";
import type { Dataset } from "../../cache/Dataset.js";
import type { ServerDataCache } from "../../cache/ServerDataCache.js";

/** One kind of suggested site, scored from data the server already holds: the design model's Strategy pattern. */
export interface SuggestionStrategy<T> {
  /** Where its sites are kept and served from. */
  getDataset(): Dataset;
  /** The datasets it reads: a change to any of them rebuilds its sites. */
  getInputs(): readonly Dataset[];
  /** The design model's buildSites. Undefined when an input it can't do without isn't loaded yet. */
  buildSites(cache: ServerDataCache, now: Date): T | undefined;
}

/**
 * A dataset's data from the cache, checked against its shared schema (the cache itself is untyped). Undefined when it
 * isn't loaded, or is older than `maxAgeMs` at `now`.
 */
export function cached<S extends z.ZodType>(
  cache: ServerDataCache,
  dataset: Dataset,
  schema: S,
  freshness?: { maxAgeMs: number; now: Date },
): z.infer<S> | undefined {
  const entry = cache.get(dataset);
  if (!entry) return undefined;
  if (freshness && freshness.now.getTime() - Date.parse(entry.asOf) > freshness.maxAgeMs) return undefined;
  return schema.parse(entry.data);
}
