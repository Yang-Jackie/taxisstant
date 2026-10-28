import currentLocation from "@tabler/icons/outline/current-location.svg?raw";
import "./LocationButton.css";

export interface LocationButtonProps {
  /** There is a position to go to. */
  enabled: boolean;
  /** The driver's dot is away from the middle of the screen (UC 0013 3a, D31). */
  highlighted: boolean;
  onClick: () => void;
}

/** The mockup's round crosshair button: centres the map on the driver. */
export function LocationButton({ enabled, highlighted, onClick }: LocationButtonProps) {
  return (
    <button
      type="button"
      className={`location-button${highlighted ? " location-button--highlighted" : ""}`}
      aria-label="Centre the map on my location"
      title={highlighted ? "Back to my location" : "My location"}
      disabled={!enabled}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: currentLocation }}
    />
  );
}
