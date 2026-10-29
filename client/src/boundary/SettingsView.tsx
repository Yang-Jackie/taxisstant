import chevronLeft from "@tabler/icons/outline/chevron-left.svg?raw";
import x from "@tabler/icons/outline/x.svg?raw";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  TEXT_SIZES,
  type Language,
  type TextSize,
  type UserPreferences,
  type VehicleType,
} from "../entity/UserPreferences";
import { Drawer } from "./Drawer";
import { LanguageChoice } from "./LanguageChoice";
import "./SettingsView.css";

/** The vehicle types: what choosing one does is in its hint (FR-2.1.1, D43). */
const VEHICLES: readonly (VehicleType | undefined)[] = [undefined, "FUEL", "EV"];

/** Each text size's name in the messages. */
const SIZE_NAME: Record<TextSize, "normal" | "large" | "larger" | "largest"> = {
  100: "normal",
  115: "large",
  130: "larger",
  150: "largest",
};

interface SwitchProps {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}

/** An on/off setting, read out as a switch: its label as its name, its hint as its description. */
function Switch({ label, hint, on, onChange }: SwitchProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={`${id}-label`}
      aria-describedby={hint ? `${id}-hint` : undefined}
      className="settings__switch"
      onClick={() => onChange(!on)}
    >
      <span className="settings__text">
        <span className="settings__label" id={`${id}-label`}>
          {label}
        </span>
        {hint && (
          <span className="settings__hint" id={`${id}-hint`}>
            {hint}
          </span>
        )}
      </span>
      <span className="settings__knob" aria-hidden="true" />
    </button>
  );
}

export interface SettingsViewProps {
  preferences: UserPreferences;
  onSetLanguage: (l: Language) => void;
  onSetVehicleType: (v: VehicleType | undefined) => void;
  /** The design model's setDisplay(fontSize, darkMode). */
  onSetDisplay: (fontSize: TextSize, darkMode: boolean) => void;
  onSetSkipNavPrompt: (skip: boolean) => void;
  /** The dialog map's "Exit": back to the side menu. */
  onBack: () => void;
  onClose: () => void;
}

/**
 * The dialog map's Settings UI (FR-2): the design model's SettingsView. Each change takes effect and is saved at once
 * (FR-2.2.1).
 */
export function SettingsView({
  preferences: p,
  onSetLanguage,
  onSetVehicleType,
  onSetDisplay,
  onSetSkipNavPrompt,
  onBack,
  onClose,
}: SettingsViewProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <Drawer label={t("settings.title")} onClose={onClose}>
      <header className="settings__header">
        <button
          type="button"
          className="settings__icon-button"
          aria-label={t("menu.back")}
          autoFocus
          onClick={onBack}
          dangerouslySetInnerHTML={{ __html: chevronLeft }}
        />
        <h2>{t("settings.title")}</h2>
        <button
          type="button"
          className="settings__icon-button"
          aria-label={t("menu.close")}
          onClick={onClose}
          dangerouslySetInnerHTML={{ __html: x }}
        />
      </header>

      <LanguageChoice language={p.language} onChange={onSetLanguage} />

      <fieldset className="settings__group">
        <legend>{t("settings.vehicle")}</legend>
        {VEHICLES.map((v) => {
          const name = v ?? "none";
          const key = `${id}-${name}`;
          return (
            <label key={key} className="settings__choice">
              <input
                type="radio"
                name={`${id}-vehicle`}
                aria-labelledby={`${key}-label`}
                aria-describedby={`${key}-hint`}
                checked={p.vehicleType === v}
                onChange={() => onSetVehicleType(v)}
              />
              <span className="settings__text">
                <span className="settings__label" id={`${key}-label`}>
                  {t(`settings.vehicleType.${name}.label`)}
                </span>
                <span className="settings__hint" id={`${key}-hint`}>
                  {t(`settings.vehicleType.${name}.hint`)}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="settings__group">
        <legend>{t("settings.textSize")}</legend>
        <div className="settings__sizes">
          {TEXT_SIZES.map((size) => (
            <label key={size} className="settings__size">
              <input
                type="radio"
                name={`${id}-size`}
                checked={p.fontSize === size}
                onChange={() => onSetDisplay(size, p.darkMode)}
              />
              <span className="settings__size-name">{t(`settings.size.${SIZE_NAME[size]}`)}</span>
              {/* How big the text would be: the page is already at the current size, so relative to that */}
              <span className="settings__sample" aria-hidden="true" style={{ fontSize: `${size / p.fontSize}rem` }}>
                Aa
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="settings__group">
        <Switch
          label={t("settings.darkMode")}
          hint={t("settings.darkModeHint")}
          on={p.darkMode}
          onChange={(on) => onSetDisplay(p.fontSize, on)}
        />
        <Switch
          label={t("settings.askBeforeMaps")}
          on={!p.skipNavPrompt}
          onChange={(ask) => onSetSkipNavPrompt(!ask)}
        />
      </div>
    </Drawer>
  );
}
