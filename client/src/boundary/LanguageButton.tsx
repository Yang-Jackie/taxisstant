import world from "@tabler/icons/outline/world.svg?raw";
import { useTranslation } from "react-i18next";
import type { Language } from "../entity/UserPreferences";
import { HTML_LANG } from "./i18n";
import "./LanguageButton.css";

export interface LanguageButtonProps {
  language: Language;
  onChange: (l: Language) => void;
}

/** The mockup's language button, top right (Lab 1's "quick language options"): one tap switches to the other. */
export function LanguageButton({ language, onChange }: LanguageButtonProps) {
  const { t } = useTranslation();
  const other: Language = language === "EN" ? "ZH" : "EN";
  return (
    <button
      type="button"
      className="language-button"
      aria-label={t("language.switchTo", { language: t(`language.${other}`) })}
      onClick={() => onChange(other)}
    >
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: world }} />
      <span lang={HTML_LANG[language]}>{t(`language.short.${language}`)}</span>
    </button>
  );
}
