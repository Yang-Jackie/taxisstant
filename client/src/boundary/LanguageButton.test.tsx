// Package 9b acceptance tests — the language controls (FR-2.1.2): the mockup's quick button, top right, and the
// choice in Settings and on the side menu's Language screen.
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { i18next } from "./i18n";
import { LanguageButton } from "./LanguageButton";
import { LanguageView } from "./LanguageView";

describe("LanguageButton", () => {
  it("shows the language now, and switches to the other in one tap", async () => {
    const onChange = vi.fn();
    render(<LanguageButton language="EN" onChange={onChange} />);
    const button = screen.getByRole("button", { name: "Switch to 中文" });
    expect(button).toHaveTextContent("EN");
    await userEvent.click(button);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("ZH");
  });

  it("speaks Chinese once switched: '中文' showing, and the way back to English", async () => {
    await act(() => i18next.changeLanguage("zh"));
    const onChange = vi.fn();
    render(<LanguageButton language="ZH" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "切换到English" }));
    expect(screen.getByRole("button")).toHaveTextContent("中文");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("EN");
  });
});

describe("LanguageView", () => {
  it("offers English and 中文, each named in its own language and marked as that language", async () => {
    const onChange = vi.fn();
    render(<LanguageView language="EN" onChange={onChange} onBack={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
    expect(screen.getByText("中文")).toHaveAttribute("lang", "zh-Hans");
    await userEvent.click(screen.getByRole("radio", { name: "中文" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("ZH");
  });

  it("goes back to the menu", async () => {
    const onBack = vi.fn();
    render(<LanguageView language="EN" onChange={vi.fn()} onBack={onBack} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Back to the menu" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
