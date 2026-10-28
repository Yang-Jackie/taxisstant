import type { ApiResponse } from "@taxisstant/shared";

/** What a GET can come back with (D4). Errors are thrown, not returned. */
export type ApiResult<T> = { status: "ok"; response: ApiResponse<T> } | { status: "not-modified" };

export interface DataApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class DataApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor({
    baseUrl = "/api",
    timeoutMs = 7_000,
    fetchFn = (input, init) => fetch(input, init),
  }: DataApiClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn;
  }

  async get<T>(endpoint: string, etag?: string): Promise<ApiResult<T>> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (etag) headers["If-None-Match"] = etag;
    const signal = AbortSignal.timeout(this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${endpoint}`, { headers, signal });
    } catch (err) {
      throw new Error(
        signal.aborted
          ? `GET ${endpoint} timed out after ${this.timeoutMs} ms`
          : `GET ${endpoint} failed: ${String(err)}`,
      );
    }

    if (res.status === 304) return { status: "not-modified" };
    if (!res.ok) throw new Error(`GET ${endpoint} answered ${res.status}`);
    return { status: "ok", response: (await res.json()) as ApiResponse<T> };
  }
}
