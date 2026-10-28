import type { ApiResponse, Endpoint } from "@taxisstant/shared";

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

  /** GETs one of our endpoints, and checks the body against its schema before anyone else sees it. */
  async get<T>(endpoint: Endpoint<T>, etag?: string): Promise<ApiResult<T>> {
    const { path } = endpoint;
    const headers: Record<string, string> = { accept: "application/json" };
    if (etag) headers["If-None-Match"] = etag;
    const signal = AbortSignal.timeout(this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, { headers, signal });
    } catch (err) {
      throw new Error(
        signal.aborted ? `GET ${path} timed out after ${this.timeoutMs} ms` : `GET ${path} failed: ${String(err)}`,
      );
    }

    if (res.status === 304) return { status: "not-modified" };
    if (!res.ok) throw new Error(`GET ${path} answered ${res.status}`);

    const parsed = endpoint.response.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(
        `GET ${path} sent data that breaks the contract (${issue?.path.join(".") || "body"}: ${issue?.message})`,
      );
    }
    return { status: "ok", response: parsed.data };
  }
}
