import chevronLeft from "@tabler/icons/outline/chevron-left.svg?raw";
import x from "@tabler/icons/outline/x.svg?raw";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Drawer } from "./Drawer";
import "./HelpView.css";
import "./SettingsView.css";

const TOPICS = ["layers", "suggestions", "navigation", "bookmarks", "location", "settings", "freshness"] as const;

const SODL = "https://data.gov.sg/open-data-licence";

/** The Singapore Open Data Licence's sources, with the datasets the app reads from each (D46). */
const OPEN_DATA = [
  {
    source: "LTA DataMall",
    datasets: ["Taxi Stands", "Carpark Availability", "EV Charging Points", "Platform Crowd Density Real Time"],
  },
  {
    source: "data.gov.sg",
    datasets: ["Taxi Availability", "Dates of Hawker Centres Closure", "LTA MRT Station Exit"],
  },
] as const;

const sgDate = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Singapore",
});

/** "a, b and c". */
const listed = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items.join("");

export interface HelpViewProps {
  /** Back to the side menu: the dialog map's Exit. */
  onBack: () => void;
  onClose: () => void;
  /** When the data was accessed: the data service refreshes all of it at least daily. Read once, on opening. */
  now?: Date;
}

/**
 * The dialog map's Help and support page (D46): how to use each feature, where the data comes from with the credits its
 * licences ask for, and that the app is a student project. No contact details are given anywhere, so none are shown.
 */
export function HelpView({ onBack, onClose, now }: HelpViewProps) {
  const { t } = useTranslation();
  const [openedAt] = useState(() => now ?? new Date());
  const accessed = sgDate.format(openedAt);
  return (
    <Drawer label={t("help.title")} onClose={onClose}>
      <header className="settings__header">
        <button
          type="button"
          className="settings__icon-button"
          aria-label={t("menu.back")}
          autoFocus
          onClick={onBack}
          dangerouslySetInnerHTML={{ __html: chevronLeft }}
        />
        <h2>{t("help.title")}</h2>
        <button
          type="button"
          className="settings__icon-button"
          aria-label={t("menu.close")}
          onClick={onClose}
          dangerouslySetInnerHTML={{ __html: x }}
        />
      </header>

      {TOPICS.map((topic) => (
        <section key={topic} className="help__topic">
          <h3>{t(`help.topics.${topic}.title`)}</h3>
          <p>{t(`help.topics.${topic}.text`)}</p>
        </section>
      ))}

      <section className="help__topic">
        <h3>{t("help.sources")}</h3>
        <p>{t("help.sourcesNote")}</p>
        {/* The licences' own wording, in English in both languages, like the map credits */}
        <ul className="help__sources" lang="en">
          {OPEN_DATA.map(({ source, datasets }) => (
            <li key={source}>
              Contains information from {listed(datasets)} accessed on {accessed} from {source} which is made available
              under the terms of the{" "}
              <a href={SODL} target="_blank" rel="noopener noreferrer">
                Singapore Open Data Licence version 1.0
              </a>
              .
            </li>
          ))}
          <li>
            Fuel stations ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap contributors
            </a>
            , under the Open Database Licence.
          </li>
          <li>
            Map and station positions:{" "}
            <a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">
              OneMap
            </a>
            , Singapore Land Authority.
          </li>
        </ul>
      </section>

      <section className="help__topic">
        <h3>{t("help.about")}</h3>
        <p>{t("help.aboutText")}</p>
      </section>
    </Drawer>
  );
}
