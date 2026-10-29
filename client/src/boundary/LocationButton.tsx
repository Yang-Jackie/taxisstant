import currentLocation from "@tabler/icons/outline/current-location.svg?raw";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`location-button${highlighted ? " location-button--highlighted" : ""}`}
      aria-label={t("location.centre")}
      title={highlighted ? t("location.backToMine") : t("location.mine")}
      disabled={!enabled}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: currentLocation }}
    />
  );
}
