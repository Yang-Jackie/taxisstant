import { z } from "zod";

/** Every position in the contract is WGS 84, in degrees. */
export const Latitude = z.number().min(-90).max(90).describe("WGS 84 degrees.");
export const Longitude = z.number().min(-180).max(180).describe("WGS 84 degrees.");
