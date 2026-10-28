import type { ApiResponse } from "@taxisstant/shared";
import type { LocalStore } from "./LocalStore";

/** What is saved per key: the server's response, and when we last saved (= checked) it. */
interface CacheEntry {
  readonly savedAt: number;
  readonly response: ApiResponse<unknown>;
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (typeof value !== "object" || value === null) return false;
  if (!("savedAt" in value) || typeof value.savedAt !== "number") return false;
  if (!("response" in value) || typeof value.response !== "object" || value.response === null) return false;
  return "etag" in value.response && typeof value.response.etag === "string" && "data" in value.response;
}

/** Server responses saved on the phone. The design model's «singleton»: one instance, made in startup.ts (D10). */
export class CacheManager {
  private readonly store: Pick<LocalStore, "read" | "write">;
  private readonly now: () => number;

  constructor(store: Pick<LocalStore, "read" | "write">, now: () => number = () => Date.now()) {
    this.store = store;
    this.now = now;
  }

  async get<T>(key: string): Promise<ApiResponse<T> | undefined> {
    const entry = await this.readEntry(key);
    return entry?.response as ApiResponse<T> | undefined;
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
    const value = await this.store.read(`cache:${key}`);
    return isCacheEntry(value) ? value : undefined;
  }
}
