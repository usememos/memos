import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoReadingOptions from "@/components/MemoReadingOptions";
import { DEVICE_PREFERENCES_KEY, updateDevicePreferences } from "@/hooks/useDevicePreferences";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

beforeEach(() => localStorage.clear());

describe("memo reading options", () => {
  it("offers a guest a visible, labelled and focusable switch", () => {
    render(<MemoReadingOptions />);
    expect(screen.getByText("memo.hide-completed-tasks")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "memo.hide-completed-tasks" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).not.toBeDisabled();
    expect(toggle.tabIndex).toBe(0);
  });

  it("saves the choice in this browser and reflects choices made elsewhere", () => {
    render(<MemoReadingOptions />);
    fireEvent.click(screen.getByRole("switch", { name: "memo.hide-completed-tasks" }));
    expect(screen.getByRole("switch", { name: "memo.hide-completed-tasks" })).toHaveAttribute("aria-checked", "true");
    expect(JSON.parse(localStorage.getItem(DEVICE_PREFERENCES_KEY) ?? "null")).toMatchObject({ hideCompletedTasks: true });

    act(() => updateDevicePreferences({ hideCompletedTasks: false }));
    expect(screen.getByRole("switch", { name: "memo.hide-completed-tasks" })).toHaveAttribute("aria-checked", "false");
  });
});
