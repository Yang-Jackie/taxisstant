// M5 acceptance tests — Toast «boundary»: a short message that disappears by itself (NF-3.2.1).
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("shows its message as an alert, so screen readers announce it", () => {
    render(<Toast message="Unable to load taxi stand markers." onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load taxi stand markers.");
  });

  it("asks to be dismissed after 4 seconds, not before", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Hello" onDismiss={onDismiss} />);

    act(() => vi.advanceTimersByTime(3_999));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("cancels its timer if it's removed early (no call after it's gone)", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast message="Hello" onDismiss={onDismiss} />);

    unmount();
    act(() => vi.advanceTimersByTime(10_000));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
