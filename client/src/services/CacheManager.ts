import type { ApiResponse } from "@taxisstant/shared";
import { z } from "zod";
import type { LocalStore } from "./LocalStore";

/**
 * What is saved per key: the server's response, and when we last saved (= checked) it. Anything else counts as
 * nothing saved. The response is checked loosely here (its other fields kept), then fully by get() with its schema.
 */
const CacheEntry = z.object({
  savedAt: z.number(),
  response: z.looseObject({ etag: z.string(), data: z.unknown() }),
});
type CacheEntry = z.infer<typeof CacheEntry>;

/** Server responses saved on the phone. The design model's «singleton»: one instance, made in startup.ts (D10). */
export class CacheManager {
  private readonly store: Pick<LocalStore, "read" | "write">;
  private readonly now: () => number;

  constructor(store: Pick<LocalStore, "read" | "write">, now: () => number = () => Date.now()) {
    this.store = store;
    this.now = now;
  }

  /** The saved response, if there is one and it still matches `response` (the endpoint's schema). */
  async get<T>(key: string, response: z.ZodType<ApiResponse<T>>): Promise<ApiResponse<T> | undefined> {
    const entry = await this.readEntry(key);
    const parsed = entry && response.safeParse(entry.response);
    return parsed?.success ? parsed.data : undefined;
  }

  async put<T>(key: string, r: ApiResponse<T>): Promise<void> {
    const entry: CacheEntry = { savedAt: this.now(), response: r };
    await this.store.write(`cache:${key}`, entry);
  }

  /** True when nothing is saved, or it was saved at least `ttlMs` ago. */
  async isStale(key: string, ttlMs: number): Promise<boolean> {
    const entry = await this.readEntry(key);
    return !entry || this.now() - entry.savedAt >= ttlMs;
  }

  private async readEntry(key: string): Promise<CacheEntry | undefined> {
    const parsed = CacheEntry.safeParse(await this.store.read(`cache:${key}`));
    return parsed.success ? parsed.data : undefined;
  }
}
