// Package 1 tests — the OpenAPI document generated from the zod schemas (for the report and for tools).
import { readFileSync } from "node:fs";
import { Validator } from "@seriousme/openapi-schema-validator";
import { describe, expect, it } from "vitest";
import { ENDPOINTS } from "./endpoints.js";
import { buildOpenApi } from "./openapi.js";

/** Every "$ref" string anywhere in the document. */
function refsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(refsIn);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([k, v]) => (k === "$ref" && typeof v === "string" ? [v] : refsIn(v)));
}

/** Follows a local "#/a/b/c" reference inside the document. */
function resolve(doc: unknown, ref: string): unknown {
  return ref
    .slice(2)
    .split("/")
    .reduce<unknown>(
      (node, key) => (typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined),
      doc,
    );
}

describe("OpenAPI document", () => {
  it("is a valid OpenAPI 3.1 document", async () => {
    const result = await new Validator().validate(buildOpenApi());
    expect(result.errors).toBeUndefined();
    expect(result.valid).toBe(true);
  });

  it("has every endpoint, each with its 200, 304 and 503 answers and the If-None-Match header", () => {
    const { paths } = buildOpenApi();
    for (const e of Object.values(ENDPOINTS)) {
      const get = paths[e.path]?.get;
      expect(get?.operationId).toBe(`get${e.name}`);
      expect(Object.keys(get?.responses ?? {})).toEqual(["200", "304", "503"]);
      expect(get?.parameters).toEqual([{ $ref: "#/components/parameters/IfNoneMatch" }]);
    }
  });

  it("only refers to things it defines", () => {
    const doc = buildOpenApi();
    const refs = refsIn(doc);
    expect(refs).toContain("#/components/schemas/TaxiStandDto");
    for (const ref of refs) expect(resolve(doc, ref), ref).toBeDefined();
  });

  it("matches the committed shared/openapi.json (after changing the contract, run: npm run openapi -w shared)", () => {
    const committed: unknown = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));
    expect(committed).toEqual(buildOpenApi());
  });
});
