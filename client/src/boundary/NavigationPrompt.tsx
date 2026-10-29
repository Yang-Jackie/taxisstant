import { useEffect, useId, useState } from "react";
import type { NavigationTarget } from "../control/NavigationController";
import "./NavigationPrompt.css";

export interface NavigationPromptProps {
  target: NavigationTarget;
  /** The design model's onConfirmNav(ok, doNotShow). */
  onAnswer: (ok: boolean, doNotShow: boolean) => void;
}

/** UC 0012 step 3 (the dialog map's "Redirect confirmation message"): open Google Maps, Yes or No? */
export function NavigationPrompt({ target, onAnswer }: NavigationPromptProps) {
  const [doNotShow, setDoNotShow] = useState(false);
  const titleId = useId();
  const textId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnswer(false, false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnswer]);

  return (
    <div className="nav-prompt">
      <div className="nav-prompt__overlay" aria-hidden="true" onClick={() => onAnswer(false, false)} />
      <div
        className="nav-prompt__box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <h2 id={titleId}>Open Google Maps?</h2>
        <p id={textId}>Get directions to {target.name} in Google Maps.</p>
        <label className="nav-prompt__skip">
          <input type="checkbox" checked={doNotShow} onChange={(e) => setDoNotShow(e.target.checked)} />
          Do not show this again
        </label>
        <div className="nav-prompt__buttons">
          <button type="button" onClick={() => onAnswer(false, doNotShow)}>
            No
          </button>
          <button type="button" className="nav-prompt__yes" autoFocus onClick={() => onAnswer(true, doNotShow)}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
