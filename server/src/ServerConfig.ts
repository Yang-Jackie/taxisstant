import { z } from "zod";

/** An empty value ("PORT=") counts as not set, so the default applies. */
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema);

/** A comma-separated list of origins ("https://taxi.example,https://staging.taxi.example"); none by default. */
const Origins = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  )
  .refine((origins) => origins.every((o) => URL.canParse(o) && new URL(o).origin === o), {
    message: 'each entry must be an origin such as "https://taxi.example": scheme and host, no path',
  });

const Env = z.object({
  PORT: optional(z.coerce.number().int().min(1).max(65535).default(3000)),
  /** Browser origins allowed to call the API from another site. Empty: the app is served from the same origin. */
  CORS_ORIGINS: optional(Origins),
  /** How many proxies sit in front of the server (0: none), so the rate limit sees each client's own address. */
  TRUST_PROXY: optional(z.coerce.number().int().min(0).default(0)),
  /** Requests each client address may make per minute (D27). */
  RATE_LIMIT_PER_MINUTE: optional(z.coerce.number().int().min(1).default(300)),
});

export type ServerConfig = z.infer<typeof Env>;

/** The server's settings from environment variables (server/.env in development). Throws, naming the bad setting. */
export function readConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new Error(`Bad setting ${issue.path.join(".")}: ${issue.message}`);
  }
  return parsed.data;
}
