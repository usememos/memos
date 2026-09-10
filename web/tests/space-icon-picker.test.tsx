import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SpaceIcon from "@/components/SpaceIcon";
import SpaceIconPicker from "@/components/SpaceIconPicker";
import { SPACE_EMOJI } from "@/lib/space-emoji";
import { type Space_Icon, Space_IconSchema } from "@/types/proto/api/v1/space_service_pb";
import { FULLY_QUALIFIED_EMOJI } from "@/utils/tag-unicode-data";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const icon = (value: string, kind: "emoji" | "lucide" = "lucide") => create(Space_IconSchema, { value: { case: kind, value } });
function Harness({ initial, onChange = vi.fn() }: { initial?: Space_Icon; onChange?: (value?: Space_Icon) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <SpaceIconPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("SpaceIconPicker", () => {
  it("searches and selects a symbol with keyboard navigation and restores trigger focus", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "space.icon.change" });
    fireEvent.click(trigger);
    const search = await screen.findByRole("textbox", { name: "space.icon.search-icons" });
    fireEvent.change(search, { target: { value: "book" } });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Book" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Book" }), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Notebook" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Notebook" }));
    expect(onChange).toHaveBeenCalledWith(icon("notebook-pen"));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("accepts a pasted joined emoji and can reset it", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "space.icon.change" }));
    fireEvent.click(await screen.findByRole("tab", { name: "space.icon.emoji" }));
    const search = screen.getByRole("textbox", { name: "space.icon.search-emoji" });
    fireEvent.change(search, { target: { value: "👩🏽‍🌾" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(icon("👩🏽‍🌾", "emoji"));
    fireEvent.click(screen.getByRole("button", { name: "space.icon.change" }));
    expect(await screen.findByRole("tab", { name: "space.icon.emoji" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "space.icon.reset" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("keeps the selection unchanged when dismissed or when Enter completes IME composition", async () => {
    const onChange = vi.fn();
    render(<Harness initial={icon("leaf")} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "space.icon.change" }));
    const search = await screen.findByRole("textbox", { name: "space.icon.search-icons" });
    expect(screen.getByRole("button", { name: "Leaf" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(search, { key: "Enter", isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(search, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows empty search results without accepting invalid emoji text", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "space.icon.change" }));
    fireEvent.click(await screen.findByRole("tab", { name: "space.icon.emoji" }));
    const search = screen.getByRole("textbox", { name: "space.icon.search-emoji" });
    fireEvent.change(search, { target: { value: "🌱🌱" } });
    expect(screen.getByRole("status")).toHaveTextContent("space.icon.no-results");
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables editing while a form is saving", () => {
    render(<SpaceIconPicker disabled onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "space.icon.change" })).toBeDisabled();
  });

  it("offers only emoji accepted by the shared Unicode catalog", () => {
    for (const [emoji] of SPACE_EMOJI) expect(FULLY_QUALIFIED_EMOJI).toContain(emoji);
  });
});

describe("SpaceIcon", () => {
  it("renders symbols and emoji, with a fallback for unknown names", () => {
    const view = render(<SpaceIcon icon={icon("leaf")} />);
    expect(view.container.querySelector(".lucide-leaf")).not.toBeNull();
    view.rerender(<SpaceIcon icon={icon("🌱", "emoji")} />);
    expect(view.container).toHaveTextContent("🌱");
    view.rerender(<SpaceIcon icon={icon("future-symbol")} />);
    expect(view.container.querySelector(".lucide-astroid")).not.toBeNull();
  });
});
