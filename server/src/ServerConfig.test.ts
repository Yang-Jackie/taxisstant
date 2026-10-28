// Package 2e tests — readConfig: the server's settings from environment variables, checked at startup.
import { describe, expect, it } from "vitest";
import { readConfig } from "./ServerConfig.js";

describe("readConfig", () => {
  it("uses the defaults when nothing is set: port 3000, no CORS origins, no proxy, 300 requests a minute", () => {
    expect(readConfig({})).toEqual({ PORT: 3000, CORS_ORIGINS: [], TRUST_PROXY: 0, RATE_LIMIT_PER_MINUTE: 300 });
  });

  it("treats an empty value as not set", () => {
    expect(readConfig({ PORT: "", CORS_ORIGINS: "", TRUST_PROXY: "", RATE_LIMIT_PER_MINUTE: "" })).toEqual(
      readConfig({}),
    );
  });

  it("reads every setting", () => {
    const config = readConfig({
      PORT: "8080",
      CORS_ORIGINS: "https://taxi.example, https://staging.taxi.example",
      TRUST_PROXY: "1",
      RATE_LIMIT_PER_MINUTE: "120",
    });
    expect(config).toEqual({
      PORT: 8080,
      CORS_ORIGINS: ["https://taxi.example", "https://staging.taxi.example"],
      TRUST_PROXY: 1,
      RATE_LIMIT_PER_MINUTE: 120,
    });
  });

  it("refuses a bad value, naming the setting", () => {
    expect(() => readConfig({ PORT: "eighty" })).toThrow(/Bad setting PORT/);
    expect(() => readConfig({ PORT: "0" })).toThrow(/PORT/);
    expect(() => readConfig({ RATE_LIMIT_PER_MINUTE: "-5" })).toThrow(/RATE_LIMIT_PER_MINUTE/);
  });

  it("accepts only bare origins in CORS_ORIGINS: a path or a missing scheme would never match a browser's Origin", () => {
    expect(() => readConfig({ CORS_ORIGINS: "https://taxi.example/app" })).toThrow(/CORS_ORIGINS/);
    expect(() => readConfig({ CORS_ORIGINS: "taxi.example" })).toThrow(/CORS_ORIGINS/);
  });

  it("ignores settings it doesn't know (the rest of the environment)", () => {
    expect(readConfig({ HOME: "/Users/someone", LTA_ACCOUNT_KEY: "k" }).PORT).toBe(3000);
  });
});
