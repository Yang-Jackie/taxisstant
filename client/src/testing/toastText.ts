// Test helper: a toast's words in English, so controller tests can check the use cases' own wording.
import { i18next } from "../boundary/i18n";
import type { NoticeKey } from "../control/Notice";

const english = i18next.getFixedT("en");

export function toastText(notice: NoticeKey | null): string | null {
  return notice && english(`toast.${notice}`);
}
