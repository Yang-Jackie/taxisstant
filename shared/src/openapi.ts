import { z } from "zod";
import { ENDPOINTS } from "./endpoints.js";

const schemaRef = (id: string) => ({ $ref: `#/components/schemas/${id}` });

/**
 * The OpenAPI 3.1 description of our API, built from the same zod schemas the code uses, so it can't
 * drift from the code. Written to shared/openapi.json by `npm run openapi -w shared`.
 */
export function buildOpenApi() {
  // Every schema with an id (TaxiStandDto, ApiError, each <name>Response) becomes a component.
  const { schemas } = z.toJSONSchema(z.globalRegistry, {
    uri: (id) => `#/components/schemas/${id}`,
    override: ({ jsonSchema }) => {
      if (jsonSchema.format === "date-time") delete jsonSchema.pattern; // the format already says it; the regex is noise
    },
  });
  for (const schema of Object.values(schemas)) {
    delete schema.$schema;
    delete schema.$id;
  }

  const paths = Object.fromEntries(
    Object.values(ENDPOINTS).map((e) => [
      e.path,
      {
        get: {
          operationId: `get${e.name}`,
          summary: e.summary,
          description: e.description,
          parameters: [{ $ref: "#/components/parameters/IfNoneMatch" }],
          responses: {
            "200": {
              description: "The data.",
              headers: { ETag: { $ref: "#/components/headers/ETag" } },
              content: { "application/json": { schema: schemaRef(`${e.name}Response`) } },
            },
            "304": {
              description: "Not Modified: the client's copy (its If-None-Match) is still current. No body.",
              headers: { ETag: { $ref: "#/components/headers/ETag" } },
            },
            "503": { $ref: "#/components/responses/NotLoadedYet" },
          },
        },
      },
    ]),
  );

  return {
    openapi: "3.1.0",
    info: {
      title: "Taxi Assistant data API",
      version: "1.0.0",
      description:
        "Read-only data for the Taxi Assistant client. The server fetches and prepares government data on a " +
        "schedule; clients only ever talk to this API. Unknown paths answer 404 with an ApiError body.",
    },
    servers: [{ url: "/api" }],
    paths,
    components: {
      schemas,
      parameters: {
        IfNoneMatch: {
          name: "If-None-Match",
          in: "header",
          required: false,
          description: "The etag of the copy the client already has. If it is still current, the answer is 304.",
          schema: { type: "string" },
        },
      },
      headers: {
        ETag: { description: "The fingerprint of the data, the same as the body's etag.", schema: { type: "string" } },
      },
      responses: {
        NotLoadedYet: {
          description: "Service Unavailable: the server hasn't loaded this data yet (it is still starting up).",
          content: { "application/json": { schema: schemaRef("ApiError") } },
        },
      },
    },
  };
}
