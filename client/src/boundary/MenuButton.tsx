import menu from "@tabler/icons/outline/menu-2.svg?raw";
import "./MenuButton.css";

export interface MenuButtonProps {
  onClick: () => void;
}

/** The mockup's round "hamburger" button, top left: opens the side menu. */
export function MenuButton({ onClick }: MenuButtonProps) {
  return (
    <button
      type="button"
      className="menu-button"
      aria-label="Open the menu"
      aria-haspopup="dialog"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: menu }}
    />
  );
}
