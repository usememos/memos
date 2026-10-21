import { DirectionProvider } from "@base-ui/react/direction-provider";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Example() {
  const [value, setValue] = useState("general");
  return (
    <Tabs value={value} onValueChange={setValue} size="sm">
      <TabsList aria-label="Settings">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          Unavailable
        </TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

describe("Tabs keyboard navigation", () => {
  it("keeps disabled tabs discoverable without activating them, and maintains one tab stop", async () => {
    render(<Example />);
    const general = screen.getByRole("tab", { name: "General" });
    const members = screen.getByRole("tab", { name: "Members" });
    act(() => general.focus());
    fireEvent.keyDown(general, { key: "ArrowRight" });
    const disabled = screen.getByRole("tab", { name: "Unavailable" });
    await waitFor(() => expect(disabled).toHaveFocus());
    expect(disabled).toHaveAttribute("aria-selected", "false");
    expect(general).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(disabled, { key: "Enter" });
    expect(disabled).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(disabled, { key: "ArrowRight" });
    await waitFor(() => expect(members).toHaveFocus());
    expect(members).toHaveAttribute("aria-selected", "true");
    expect(members).toHaveAttribute("tabindex", "0");
    expect(general).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "Unavailable" })).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(members, { key: "ArrowRight" });
    await waitFor(() => expect(general).toHaveFocus());
  });

  it("supports Home and End", async () => {
    render(<Example />);
    const general = screen.getByRole("tab", { name: "General" });
    const members = screen.getByRole("tab", { name: "Members" });
    act(() => general.focus());
    fireEvent.keyDown(general, { key: "End" });
    await waitFor(() => expect(members).toHaveFocus());
    fireEvent.keyDown(members, { key: "Home" });
    await waitFor(() => expect(general).toHaveFocus());
    expect(general).toHaveAttribute("aria-selected", "true");
  });

  it("follows the inline direction in RTL", async () => {
    render(
      <DirectionProvider direction="rtl">
        <Example />
      </DirectionProvider>,
    );
    const general = screen.getByRole("tab", { name: "General" });
    const members = screen.getByRole("tab", { name: "Members" });
    act(() => general.focus());
    fireEvent.keyDown(general, { key: "ArrowLeft" });
    const disabled = screen.getByRole("tab", { name: "Unavailable" });
    await waitFor(() => expect(disabled).toHaveFocus());
    fireEvent.keyDown(disabled, { key: "ArrowLeft" });
    await waitFor(() => expect(members).toHaveFocus());
    expect(members).toHaveAttribute("aria-selected", "true");
  });
});
