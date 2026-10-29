// The app's languages (FR-2.1.2): i18next, as the Lab 3 stack decided, with every word in en.ts and zh.ts.
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import type { Language } from "../../entity/UserPreferences";
import { en } from "./en";
import { zh } from "./zh";

/** i18next's name for each of the design model's languages. */
export const LOCALE: Record<Language, "en" | "zh"> = { EN: "en", ZH: "zh" };
/** What the page tells the browser and screen readers it is written in. */
export const HTML_LANG: Record<Language, string> = { EN: "en", ZH: "zh-Hans" };

void i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React escapes what it renders
  initAsync: false, // the words are all here: ready at once
});

export { i18next };
