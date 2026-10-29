import chevronLeft from "@tabler/icons/outline/chevron-left.svg?raw";
import x from "@tabler/icons/outline/x.svg?raw";
import { useId } from "react";
import { TEXT_SIZES, type TextSize, type UserPreferences, type VehicleType } from "../entity/UserPreferences";
import { Drawer } from "./Drawer";
import "./SettingsView.css";

/** The vehicle types, and what choosing one does (FR-2.1.1, D43). */
const VEHICLES: readonly { value: VehicleType | undefined; label: string; hint: string }[] = [
  { value: undefined, label: "Not set", hint: "Shows fuel stations and charging points" },
  { value: "FUEL", label: "Petrol or diesel", hint: "Hides charging points" },
  { value: "EV", label: "Electric", hint: "Hides fuel stations" },
];

const SIZE_NAMES: Record<TextSize, string> = { 100: "Normal", 115: "Large", 130: "Larger", 150: "Largest" };

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
 * (FR-2.2.1). The language joins it in package 9b.
 */
export function SettingsView({
  preferences: p,
  onSetVehicleType,
  onSetDisplay,
  onSetSkipNavPrompt,
  onBack,
  onClose,
}: SettingsViewProps) {
  const id = useId();
  return (
    <Drawer label="Settings" onClose={onClose}>
      <header className="settings__header">
        <button
          type="button"
          className="settings__icon-button"
          aria-label="Back to the menu"
          autoFocus
          onClick={onBack}
          dangerouslySetInnerHTML={{ __html: chevronLeft }}
        />
        <h2>Settings</h2>
        <button
          type="button"
          className="settings__icon-button"
          aria-label="Close the menu"
          onClick={onClose}
          dangerouslySetInnerHTML={{ __html: x }}
        />
      </header>

      <fieldset className="settings__group">
        <legend>What do you drive?</legend>
        {VEHICLES.map((v) => {
          const key = `${id}-${v.value ?? "none"}`;
          return (
            <label key={key} className="settings__choice">
              <input
                type="radio"
                name={`${id}-vehicle`}
                aria-labelledby={`${key}-label`}
                aria-describedby={`${key}-hint`}
                checked={p.vehicleType === v.value}
                onChange={() => onSetVehicleType(v.value)}
              />
              <span className="settings__text">
                <span className="settings__label" id={`${key}-label`}>
                  {v.label}
                </span>
                <span className="settings__hint" id={`${key}-hint`}>
                  {v.hint}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="settings__group">
        <legend>Text size</legend>
        <div className="settings__sizes">
          {TEXT_SIZES.map((size) => (
            <label key={size} className="settings__size">
              <input
                type="radio"
                name={`${id}-size`}
                checked={p.fontSize === size}
                onChange={() => onSetDisplay(size, p.darkMode)}
              />
              <span className="settings__size-name">{SIZE_NAMES[size]}</span>
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
          label="Dark mode"
          hint="Dark menus and a night map"
          on={p.darkMode}
          onChange={(on) => onSetDisplay(p.fontSize, on)}
        />
        <Switch
          label="Ask before opening Google Maps"
          on={!p.skipNavPrompt}
          onChange={(ask) => onSetSkipNavPrompt(!ask)}
        />
      </div>
    </Drawer>
  );
}
