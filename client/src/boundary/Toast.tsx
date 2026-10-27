import { useEffect } from "react";
import "./Toast.css";

export interface ToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

/** A short message that removes itself after a few seconds (NF-3.2.1). */
export function Toast({ message, onDismiss, durationMs = 4_000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div role="alert" className="toast">
      {message}
    </div>
  );
}
