import type { Location } from "../entity/Location";
import type { NavigationGateway } from "../services/NavigationGateway";
import type { SettingsController } from "./SettingsController";
import { Store } from "./Store";

/** Somewhere to route to, and what to call it in the prompt. */
export interface NavigationTarget {
  readonly location: Location;
  readonly name: string;
}

export interface NavigationState {
  /** The design model's pendingDest: waiting for the driver's Yes or No (UC 0012 step 3). */
  readonly pending: NavigationTarget | null;
}

/** Routes the driver to a place through Google Maps (UC 0012): the design model's NavigationController «control». */
export class NavigationController extends Store<NavigationState> {
  private readonly settings: SettingsController;
  private readonly gateway: Pick<NavigationGateway, "openDeepLink">;

  constructor(settings: SettingsController, gateway: Pick<NavigationGateway, "openDeepLink">) {
    super({ pending: null });
    this.settings = settings;
    this.gateway = gateway;
  }

  /** A Navigate button: ask first (step 3), unless the driver said not to (step 2); then open Google Maps. */
  navigateTo(target: NavigationTarget): void {
    if (this.settings.getPreferences().skipNavPrompt) this.gateway.openDeepLink(target.location);
    else this.setState({ pending: target });
  }

  /**
   * The prompt's answer. Yes opens Google Maps (step 4) and, with "Do not show this again" ticked, skips the prompt
   * from now on; No only closes it (4a), remembering nothing, since skipping means always opening (D39).
   */
  confirm(ok: boolean, doNotShow: boolean): void {
    const { pending } = this.getSnapshot();
    if (!pending) return;
    this.setState({ pending: null });
    if (!ok) return;
    this.gateway.openDeepLink(pending.location); // first, while the tap still counts: browsers block late pop-ups
    if (doNotShow) void this.settings.setSkipNavPrompt(true);
  }
}
