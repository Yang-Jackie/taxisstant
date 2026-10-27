// M6 acceptance tests — LocalStore: the browser's own database (IndexedDB), as a simple read/write.
// Tests use an in-memory IndexedDB (fake-indexeddb, see test-setup.ts), wiped before every test.
import { describe, expect, it } from "vitest";
import { LocalStore } from "./LocalStore";

describe("LocalStore", () => {
  it("reads undefined for a key that was never written", async () => {
    expect(await new LocalStore().read("preferences")).toBeUndefined();
  });

  it("reads back what was written", async () => {
    const store = new LocalStore();
    await store.write("preferences", { visibleLayers: ["TAXI_STAND"] });
    expect(await store.read("preferences")).toEqual({ visibleLayers: ["TAXI_STAND"] });
  });

  it("replaces the value when the same key is written again", async () => {
    const store = new LocalStore();
    await store.write("preferences", { visibleLayers: ["TAXI_STAND"] });
    await store.write("preferences", { visibleLayers: [] });
    expect(await store.read("preferences")).toEqual({ visibleLayers: [] });
  });

  it("keeps data when the app is reopened (a new LocalStore on the same database)", async () => {
    await new LocalStore().write("preferences", { visibleLayers: ["FUEL"] });
    const afterReload = new LocalStore();
    expect(await afterReload.read("preferences")).toEqual({ visibleLayers: ["FUEL"] });
  });

  it("keeps different databases apart", async () => {
    await new LocalStore("one").write("preferences", "from one");
    expect(await new LocalStore("two").read("preferences")).toBeUndefined();
  });
});
