// Writes shared/openapi.json from the zod schemas. Run it after changing the contract: npm run openapi -w shared
import { writeFileSync } from "node:fs";
import { buildOpenApi } from "../src/openapi.js";

const file = new URL("../openapi.json", import.meta.url);
writeFileSync(file, `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
console.log(`Wrote ${file.pathname}`);
