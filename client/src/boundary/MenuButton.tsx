import menu from "@tabler/icons/outline/menu-2.svg?raw";
import { useTranslation } from "react-i18next";
import "./MenuButton.css";

export interface MenuButtonProps {
  onClick: () => void;
}

/** The mockup's round "hamburger" button, top left: opens the side menu. */
export function MenuButton({ onClick }: MenuButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="menu-button"
      aria-label={t("menu.open")}
      aria-haspopup="dialog"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: menu }}
    />
  );
}
