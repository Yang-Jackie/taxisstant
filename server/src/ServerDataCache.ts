import { createHash } from "node:crypto";
import type { ApiResponse } from "./ApiResponse.js";
import type { Dataset } from "./Dataset.js";

export class ServerDataCache {
  private readonly entries = new Map<Dataset, ApiResponse<unknown>>();

  get(d: Dataset): ApiResponse<unknown> | undefined {
    return this.entries.get(d);
  }

  put(d: Dataset, data: unknown, now: Date = new Date()): void {
    const hash = createHash("sha1").update(JSON.stringify(data)).digest("base64url");
    this.entries.set(d, { asOf: now.toISOString(), etag: `"${hash}"`, data });
  }
}
