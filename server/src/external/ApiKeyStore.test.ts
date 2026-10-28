// M3 acceptance tests — ApiKeyStore: API keys come from environment variables (server/.env), never from code.
import { describe, expect, it } from "vitest";
import { ApiKeyStore } from "./ApiKeyStore.js";

describe("ApiKeyStore", () => {
  it("reads the LTA key from the LTA_ACCOUNT_KEY environment variable", () => {
    const keys = new ApiKeyStore({ LTA_ACCOUNT_KEY: "test-key" });
    expect(keys.getKey("LTA_DATAMALL")).toBe("test-key");
  });

  it("ignores spaces around the key (a common copy-paste accident)", () => {
    const keys = new ApiKeyStore({ LTA_ACCOUNT_KEY: "  test-key \n" });
    expect(keys.getKey("LTA_DATAMALL")).toBe("test-key");
  });

  it("can be created without a key, so the server still starts (and serves 503s)", () => {
    expect(() => new ApiKeyStore({})).not.toThrow();
  });

  it("says which variable to set when the key is missing", () => {
    expect(() => new ApiKeyStore({}).getKey("LTA_DATAMALL")).toThrow(/LTA_ACCOUNT_KEY/);
  });

  it("treats a blank key as missing", () => {
    expect(() => new ApiKeyStore({ LTA_ACCOUNT_KEY: "   " }).getKey("LTA_DATAMALL")).toThrow(/LTA_ACCOUNT_KEY/);
  });

  it("says so when asked for a key a provider doesn't use (package 2a)", () => {
    expect(() => new ApiKeyStore({}).getKey("DATA_GOV_SG")).toThrow(/doesn't use an API key/);
    expect(() => new ApiKeyStore({}).getKey("OSM_OVERPASS")).toThrow(/doesn't use an API key/);
  });
});
