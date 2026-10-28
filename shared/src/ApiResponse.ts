import { z } from "zod";

/** The fields every response has, whatever its data. */
const Envelope = z.object({
  asOf: z.iso.datetime().describe("When the server got this data from its source (ISO 8601, UTC)."),
  etag: z.string().describe("A fingerprint of the data. Send it back as If-None-Match to get 304 if nothing changed."),
});

/** The schema of an endpoint's JSON body: its data plus when it was fetched and its fingerprint. */
export function apiResponse<T>(data: z.ZodType<T>) {
  return Envelope.extend({ data });
}

/** Every endpoint's JSON body. */
export type ApiResponse<T> = z.infer<typeof Envelope> & { data: T };

/** The JSON body of every error response (404, 503). */
export const ApiError = z
  .object({ error: z.string().describe("What went wrong, in plain English.") })
  .meta({ id: "ApiError" });
export type ApiError = z.infer<typeof ApiError>;
