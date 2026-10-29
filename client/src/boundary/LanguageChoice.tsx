import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { Language } from "../entity/UserPreferences";
import { HTML_LANG } from "./i18n";

const LANGUAGES: readonly Language[] = ["EN", "ZH"];

export interface LanguageChoiceProps {
  language: Language;
  /** The design model's setLanguage. */
  onChange: (l: Language) => void;
}

/** English or 中文 (FR-2.1.2): each named in its own language, so a driver can find theirs whatever is showing. */
export function LanguageChoice({ language, onChange }: LanguageChoiceProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <fieldset className="settings__group">
      <legend>{t("language.heading")}</legend>
      {LANGUAGES.map((l) => (
        <label key={l} className="settings__choice">
          <input type="radio" name={`${id}-language`} checked={language === l} onChange={() => onChange(l)} />
          <span className="settings__label" lang={HTML_LANG[l]}>
            {t(`language.${l}`)}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
