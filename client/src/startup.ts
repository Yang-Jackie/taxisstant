import { createContext } from "react";
import { DataSyncController } from "./control/DataSyncController";
import { MapDisplayController } from "./control/MapDisplayController";
import { SettingsController } from "./control/SettingsController";
import { MapDataRepository } from "./entity/MapDataRepository";
import { DataApiClient } from "./services/DataApiClient";
import { LocalStore } from "./services/LocalStore";
import { CacheManager } from "./services/CacheManager";

export interface Controllers {
  readonly settings: SettingsController;
  readonly dataSync: DataSyncController;
  readonly mapDisplay: MapDisplayController;
}

export function initControllers(): Controllers {
  const api = new DataApiClient();
  const localStore = new LocalStore();
  const cache = new CacheManager(localStore);
  const repo = new MapDataRepository();
  const settings = new SettingsController(localStore);
  const dataSync = new DataSyncController(api, repo, cache);
  const mapDisplay = new MapDisplayController(settings, dataSync, repo);
  dataSync.attach(mapDisplay);
  return { settings, dataSync, mapDisplay };
}

export async function startControllers({ settings, dataSync, mapDisplay }: Controllers): Promise<void> {
  await settings.load();
  await dataSync.loadCached();
  const prefetch = dataSync.refreshStatic(); // every static layer, in the background (D18)
  await mapDisplay.start(); // layers left on share the downloads the prefetch just started
  await prefetch;
}

export const ControllersContext = createContext<Controllers | null>(null);
