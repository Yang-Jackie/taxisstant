import { useEffect, type ReactNode } from "react";
import "./Drawer.css";

export interface DrawerProps {
  /** What screen readers call it, e.g. "Menu". */
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/** The mockup's drawer: a panel from the left over the dimmed map. A tap outside it or Escape closes it. */
export function Drawer({ label, onClose, children }: DrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="drawer">
      <div className="drawer__overlay" aria-hidden="true" onClick={onClose} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </div>
  );
}
