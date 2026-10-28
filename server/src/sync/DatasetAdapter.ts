import type { Dataset } from "../cache/Dataset.js";
import type { Provider } from "../external/Provider.js";

/** One per dataset: where it comes from, how often, and how to turn raw data into ours. */
export interface DatasetAdapter<T> {
  getDataset(): Dataset;
  getSource(): Provider;
  /** What to ask the provider for: an LTA resource, a data.gov.sg dataset id, or an Overpass query. */
  getPath(): string;
  getRefreshInterval(): number; // milliseconds (the diagram's "Duration")
  prepare(raw: unknown): T;
}
