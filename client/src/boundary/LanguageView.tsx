import chevronLeft from "@tabler/icons/outline/chevron-left.svg?raw";
import x from "@tabler/icons/outline/x.svg?raw";
import { useTranslation } from "react-i18next";
import type { Language } from "../entity/UserPreferences";
import { Drawer } from "./Drawer";
import { LanguageChoice } from "./LanguageChoice";
import "./SettingsView.css";

export interface LanguageViewProps {
  language: Language;
  onChange: (l: Language) => void;
  /** Back to the side menu. */
  onBack: () => void;
  onClose: () => void;
}

/** The dialog map's Language selection, reached from the side menu's Language entry. */
export function LanguageView({ language, onChange, onBack, onClose }: LanguageViewProps) {
  const { t } = useTranslation();
  return (
    <Drawer label={t("language.heading")} onClose={onClose}>
      <header className="settings__header">
        <button
          type="button"
          className="settings__icon-button"
          aria-label={t("menu.back")}
          autoFocus
          onClick={onBack}
          dangerouslySetInnerHTML={{ __html: chevronLeft }}
        />
        <h2>{t("language.heading")}</h2>
        <button
          type="button"
          className="settings__icon-button"
          aria-label={t("menu.close")}
          onClick={onClose}
          dangerouslySetInnerHTML={{ __html: x }}
        />
      </header>
      <LanguageChoice language={language} onChange={onChange} />
    </Drawer>
  );
}
