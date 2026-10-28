import type { Dataset } from "../cache/Dataset.js";
import type { Provider } from "../external/Provider.js";

/** One per dataset: where it comes from, how often, and how to turn raw data into ours. */
export interface DatasetAdapter<T> {
  getDataset(): Dataset;
  getSource(): Provider;
  /**
   * What to ask the provider for, one request each (D21): LTA resources, a data.gov.sg dataset id or real-time API,
   * or an Overpass query. Most adapters need one; hotspots need one per train line.
   */
  getPaths(): readonly string[];
  getRefreshInterval(): number; // milliseconds (the diagram's "Duration")
  /** Turns the providers' answers, one per path and in the same order, into our data. */
  prepare(responses: readonly unknown[]): T;
}
