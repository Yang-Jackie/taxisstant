import { useState } from "react";
import "./LocationBanner.css";

/** How to allow location again, by browser: a web page can't open those settings itself (D30). */
function stepsFor(userAgent: string): string[] {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return [
      "Open the Settings app, then Privacy & Security, then Location Services.",
      "Turn Location Services on, then tap Safari Websites and choose While Using the App.",
      "Come back here and tap Try again.",
    ];
  }
  if (/Android/.test(userAgent)) {
    return [
      "Tap the icon left of the address bar, then Permissions (or Site settings).",
      "Set Location to Allow, and make sure the phone's Location is on.",
      "Come back here and tap Try again.",
    ];
  }
  return [
    "Open this site's settings in your browser (the icon left of the address).",
    "Allow Location, then tap Try again.",
  ];
}

export interface LocationBannerProps {
  onRetry: () => void;
  userAgent?: string;
}

/** UC 0013 exception 1a: location is denied. Its "Open Settings" becomes steps to follow (D30). */
export function LocationBanner({ onRetry, userAgent = globalThis.navigator?.userAgent ?? "" }: LocationBannerProps) {
  const [showSteps, setShowSteps] = useState(false);
  return (
    <section className="location-banner" aria-label="Location access">
      <p>Location access required to show real-time position.</p>
      {showSteps && (
        <ol>
          {stepsFor(userAgent).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      <div className="location-banner__actions">
        {!showSteps && (
          <button type="button" onClick={() => setShowSteps(true)}>
            How to turn it on
          </button>
        )}
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    </section>
  );
}
