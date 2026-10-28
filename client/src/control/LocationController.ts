import { z } from "zod";
import type { DriverPosition } from "../entity/DriverPosition";
import { Location } from "../entity/Location";
import type { GPSInterface, GpsFix, GpsProblem } from "../services/GPSInterface";
import type { LocalStore } from "../services/LocalStore";
import type { LocationObserver } from "./LocationObserver";
import { Store } from "./Store";

export type LocationStatus = "starting" | "tracking" | "denied" | "unavailable";

export interface LocationState {
  readonly position: DriverPosition | null;
  /** "denied": UC 0013 exception 1a, the dot greys out and the banner shows (D30). */
  readonly status: LocationStatus;
}

const KEY = "lastLocation";
/** The last position is saved at most this often: enough to reopen near it, without writing every second. */
const SAVE_EVERY_MS = 15_000;

/** What is kept on the phone (D32): only the latest fix, never a history. */
const SavedPosition = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0),
  at: z.iso.datetime(),
});

/** Six decimals is about 10 cm: as much as GPS can tell, and no more (UC 0013's "sanitized coordinates"). */
const round = (degrees: number) => Math.round(degrees * 1e6) / 1e6;

/** Tracks the driver's position (UC 0013): the design model's LocationController «control». */
export class LocationController extends Store<LocationState> {
  private readonly gps: GPSInterface;
  private readonly store: Pick<LocalStore, "read" | "write">;
  private readonly observers: LocationObserver[] = [];
  private stopWatching: (() => void) | undefined;
  private lastSaved = 0;
  private tracking = false;

  constructor(gps: GPSInterface, store: Pick<LocalStore, "read" | "write">) {
    super({ position: null, status: "starting" });
    this.gps = gps;
    this.store = store;
  }

  attach(o: LocationObserver): void {
    this.observers.push(o);
  }

  /** The design model's getCurrentLocation: the latest known position, live or saved. */
  getCurrentLocation(): Location | undefined {
    return this.getSnapshot().position?.location;
  }

  /** The design model's startTracking: show where the driver was last time (D32), then watch the GPS. */
  async startTracking(): Promise<void> {
    const saved = SavedPosition.safeParse(await this.store.read(KEY));
    if (saved.success && !this.getSnapshot().position) {
      const { latitude, longitude, accuracyM, at } = saved.data;
      this.update({ location: new Location(latitude, longitude), accuracyM, at: new Date(at), live: false });
    }
    this.tracking = true;
    this.watch();
  }

  /** The app came to the front (true) or went to the background (false): the GPS is only watched in front. */
  setForeground(on: boolean): void {
    if (!this.tracking) return;
    if (on) this.watch();
    else this.unwatch();
  }

  /** "Try again" on the denied banner (D30): works once the driver has allowed location for this site. */
  retry(): void {
    if (!this.tracking) return;
    this.unwatch();
    this.setState({ ...this.getSnapshot(), status: "starting" });
    this.watch();
  }

  private watch(): void {
    if (this.stopWatching) return;
    this.stopWatching = this.gps.watchPosition(
      (fix) => this.onFix(fix),
      (problem) => this.onProblem(problem),
    );
  }

  private unwatch(): void {
    this.stopWatching?.();
    this.stopWatching = undefined;
  }

  private onFix(fix: GpsFix): void {
    if (!Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude) || !(fix.accuracyM >= 0)) return; // junk
    if (Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180) return;
    this.setState({ ...this.getSnapshot(), status: "tracking" });
    this.update({
      location: new Location(round(fix.latitude), round(fix.longitude)),
      accuracyM: Math.round(fix.accuracyM),
      at: fix.at,
      live: true,
    });
    if (fix.at.getTime() - this.lastSaved >= SAVE_EVERY_MS) {
      this.lastSaved = fix.at.getTime();
      const { latitude, longitude } = this.getSnapshot().position!.location;
      void this.store.write(KEY, {
        latitude,
        longitude,
        accuracyM: Math.round(fix.accuracyM),
        at: fix.at.toISOString(),
      });
    }
  }

  private onProblem(problem: GpsProblem): void {
    // The dot stays where it was, but no longer counts as live (UC 0013 1a: greyed out)
    const position = this.getSnapshot().position;
    this.setState({ position: position && { ...position, live: false }, status: problem });
    if (problem === "denied") this.unwatch();
  }

  private update(position: DriverPosition): void {
    this.setState({ ...this.getSnapshot(), position });
    for (const o of this.observers) o.onLocationUpdated(position);
  }
}
