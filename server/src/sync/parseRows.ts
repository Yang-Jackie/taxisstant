import { z } from "zod";

export interface RowRules {
  /** Fewer valid rows than this means the download was cut short or emptied: reject it. */
  readonly minRows: number;
  /** A larger share of rows that don't fit means the provider changed its format: reject it. Default 5%. */
  readonly maxInvalidShare?: number;
}

/**
 * Keeps the rows that fit `schema` and skips the rest, so one odd row from a provider can't freeze a whole layer.
 * Throws instead when the result looks wrong as a whole; SyncService then keeps serving the last good copy (D7).
 */
export function parseRows<S extends z.ZodType>(rows: unknown, schema: S, rules: RowRules): z.infer<S>[] {
  const all = z.array(z.unknown()).parse(rows);
  const valid: z.infer<S>[] = [];
  let firstIssue: z.core.$ZodIssue | undefined;
  for (const row of all) {
    const parsed = schema.safeParse(row);
    if (parsed.success) valid.push(parsed.data);
    else firstIssue ??= parsed.error.issues[0];
  }

  const invalid = all.length - valid.length;
  const issue = firstIssue && `${firstIssue.path.join(".") || "row"}: ${firstIssue.message}`;
  if (invalid > all.length * (rules.maxInvalidShare ?? 0.05)) {
    throw new Error(`${invalid} of ${all.length} rows don't fit the expected format (first: ${issue})`);
  }
  if (valid.length < rules.minRows) throw new Error(`only ${valid.length} rows; expected at least ${rules.minRows}`);
  if (invalid > 0) console.warn(`Skipped ${invalid} of ${all.length} rows that don't fit (first: ${issue})`);
  return valid;
}

/** The first item for each key, in order; later duplicates are dropped. */
export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item);
  return [...seen.values()];
}
