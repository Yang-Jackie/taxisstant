import { createContext } from "react";
import { DataSyncController } from "./control/DataSyncController";
import { MapDisplayController } from "./control/MapDisplayController";
import { SettingsController } from "./control/SettingsController";
import { MapDataRepository } from "./entity/MapDataRepository";
import { DataApiClient } from "./services/DataApiClient";
import { LocalStore } from "./services/LocalStore";

export interface Controllers {
  readonly settings: SettingsController;
  readonly mapDisplay: MapDisplayController;
}

/** The design model's App.initControllers(): create every service and controller once, and wire the observers. */
export function initControllers(): Controllers {
  const api = new DataApiClient();
  const localStore = new LocalStore();
  const repo = new MapDataRepository();
  const settings = new SettingsController(localStore);
  const dataSync = new DataSyncController(api, repo);
  const mapDisplay = new MapDisplayController(settings, dataSync, repo);
  dataSync.attach(mapDisplay);
  return { settings, mapDisplay };
}

/** Restore saved settings first, then load whatever the visible layers need. */
export async function startControllers({ settings, mapDisplay }: Controllers): Promise<void> {
  await settings.load();
  await mapDisplay.start();
}

export const ControllersContext = createContext<Controllers | null>(null);
