import { z } from "zod";
import { Latitude, Longitude } from "./geo.js";

/** An available (empty) taxi's position (FR-1.2.2), from data.gov.sg. Taxis are anonymous: no id, nothing else. */
export const TaxiDto = z.object({ latitude: Latitude, longitude: Longitude }).meta({ id: "TaxiDto" });
export type TaxiDto = z.infer<typeof TaxiDto>;
