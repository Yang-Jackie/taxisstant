import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./LocationBanner.css";

/** Which steps allow location again on this browser: a web page can't open those settings itself (D30). */
function stepsFor(userAgent: string): "ios" | "android" | "other" {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "other";
}

export interface LocationBannerProps {
  onRetry: () => void;
  userAgent?: string;
}

/** UC 0013 exception 1a: location is denied. Its "Open Settings" becomes steps to follow (D30). */
export function LocationBanner({ onRetry, userAgent = globalThis.navigator?.userAgent ?? "" }: LocationBannerProps) {
  const { t } = useTranslation();
  const [showSteps, setShowSteps] = useState(false);
  return (
    <section className="location-banner" aria-label={t("location.region")}>
      <p>{t("location.needed")}</p>
      {showSteps && (
        <ol>
          {t(`location.steps.${stepsFor(userAgent)}`, { returnObjects: true }).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      <div className="location-banner__actions">
        {!showSteps && (
          <button type="button" onClick={() => setShowSteps(true)}>
            {t("location.howTo")}
          </button>
        )}
        <button type="button" onClick={onRetry}>
          {t("location.retry")}
        </button>
      </div>
    </section>
  );
}
