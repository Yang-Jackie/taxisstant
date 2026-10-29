import type { TFunction } from "i18next";
import { SuggestedPickup } from "../entity/SuggestedPickup";
import { SuggestedRestStop } from "../entity/SuggestedRestStop";
import type { SuggestedSite } from "../entity/SuggestedSite";

/**
 * Why a site was suggested, in a few words of the driver's language, built from its facts as the server builds its
 * English summary (D28, D29): e.g. "City Hall very crowded · 3 empty taxis nearby".
 */
export function summaryOf(site: SuggestedSite, t: TFunction): string {
  if (site instanceof SuggestedPickup) {
    const crowd =
      site.stationName && site.crowdDensity
        ? t(`summary.crowd.${site.crowdDensity}`, { station: site.stationName })
        : t("summary.noStation");
    return [crowd, t("summary.emptyTaxis", { count: site.taxiCount })].join(" · ");
  }
  if (site instanceof SuggestedRestStop) {
    const parking =
      site.freeLots !== undefined && site.freeLots > 0
        ? t("summary.parkingFree", { count: site.freeLots })
        : site.hasParking && t("summary.parking");
    const charging =
      site.hasCharging &&
      (site.freeChargePoints !== undefined
        ? t("summary.chargingFree", { count: site.freeChargePoints })
        : t("summary.charging"));
    return [t("summary.food", { count: site.foodStalls }), parking, site.hasFuel && t("summary.fuel"), charging]
      .filter(Boolean)
      .join(" · ");
  }
  return site.summary;
}
