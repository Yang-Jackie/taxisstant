import { createContext } from "react";
import { BookmarkController } from "./control/BookmarkController";
import { DataSyncController } from "./control/DataSyncController";
import { LocationController } from "./control/LocationController";
import { MapDisplayController } from "./control/MapDisplayController";
import { NavigationController } from "./control/NavigationController";
import { RecommendationController } from "./control/RecommendationController";
import { SettingsController } from "./control/SettingsController";
import { BookmarkList } from "./entity/BookmarkList";
import { MapDataRepository } from "./entity/MapDataRepository";
import { DataApiClient } from "./services/DataApiClient";
import { GPSInterface } from "./services/GPSInterface";
import { LocalStore } from "./services/LocalStore";
import { NavigationGateway } from "./services/NavigationGateway";
import { CacheManager } from "./services/CacheManager";

export interface Controllers {
  readonly settings: SettingsController;
  readonly dataSync: DataSyncController;
  readonly mapDisplay: MapDisplayController;
  readonly location: LocationController;
  readonly recommendations: RecommendationController;
  readonly bookmarks: BookmarkController;
  readonly navigation: NavigationController;
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
  const location = new LocationController(new GPSInterface(), localStore);
  location.attach(mapDisplay);
  const recommendations = new RecommendationController(settings, dataSync, repo, mapDisplay, location);
  dataSync.attach(recommendations);
  location.attach(recommendations);
  const bookmarks = new BookmarkController(new BookmarkList(), localStore, repo, dataSync, mapDisplay, settings);
  dataSync.attach(bookmarks);
  const navigation = new NavigationController(settings, new NavigationGateway());
  return { settings, dataSync, mapDisplay, location, recommendations, bookmarks, navigation };
}

export async function startControllers({
  settings,
  dataSync,
  mapDisplay,
  location,
  recommendations,
  bookmarks,
}: Controllers): Promise<void> {
  await Promise.all([settings.load(), bookmarks.load()]);
  void location.startTracking(); // asks for permission now; the map opens where the driver was (D32)
  await dataSync.loadCached();
  const prefetch = dataSync.refreshStatic(); // every static layer, in the background (D18)
  // Layers left on share the downloads the prefetch just started; suggestions left on rank once there's a position
  await Promise.all([mapDisplay.start(), recommendations.start()]);
  await prefetch;
}

export const ControllersContext = createContext<Controllers | null>(null);
