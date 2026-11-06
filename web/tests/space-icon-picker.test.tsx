import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SpaceIcon from "@/components/SpaceIcon";
import SpaceIconPicker from "@/components/SpaceIconPicker";
import SpaceMark from "@/components/SpaceMark";
import { SPACE_EMOJI } from "@/lib/space-emoji";
import { type Space_Icon, Space_IconSchema } from "@/types/proto/api/space_service_pb";
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

// Base UI treats a change as typing (and highlights the first match) only when it carries an inputType.
const type = (input: HTMLElement, value: string, inputType = "insertText") => fireEvent.input(input, { target: { value }, inputType });

describe("SpaceIconPicker", () => {
  it("searches and selects a symbol with keyboard navigation and restores trigger focus", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "space.icon.change" });
    fireEvent.click(trigger);
    const search = await screen.findByRole("combobox", { name: "space.icon.search-icons" });
    await waitFor(() => expect(search).toHaveFocus());
    type(search, "book");
    // The search keeps focus; arrow keys move the grid's highlight.
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "Book" })).toHaveAttribute("data-highlighted"));
    fireEvent.keyDown(search, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "Notebook" })).toHaveAttribute("data-highlighted"));
    expect(search).toHaveFocus();
    fireEvent.click(screen.getByRole("gridcell", { name: "Notebook" }));
    expect(onChange).toHaveBeenCalledWith(icon("notebook-pen"));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("accepts a pasted joined emoji and can reset it", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "space.icon.change" }));
    fireEvent.click(await screen.findByRole("button", { name: "space.icon.emoji" }));
    const search = screen.getByRole("combobox", { name: "space.icon.search-emoji" });
    search.focus();
    type(search, "👩🏽‍🌾", "insertFromPaste");
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "space.icon.use-emoji" })).toHaveAttribute("data-highlighted"));
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(icon("👩🏽‍🌾", "emoji"));
    fireEvent.click(screen.getByRole("button", { name: "space.icon.change" }));
    expect(await screen.findByRole("button", { name: "space.icon.emoji" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "space.icon.reset" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("keeps the selection unchanged when dismissed or when Enter completes IME composition", async () => {
    const onChange = vi.fn();
    render(<Harness initial={icon("leaf")} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "space.icon.change" }));
    const search = await screen.findByRole("combobox", { name: "space.icon.search-icons" });
    expect(screen.getByRole("gridcell", { name: "Leaf" })).toHaveAttribute("aria-selected", "true");
    type(search, "book");
    fireEvent.keyDown(search, { key: "Enter", isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(search, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows empty search results without accepting invalid emoji text", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "space.icon.change" }));
    fireEvent.click(await screen.findByRole("button", { name: "space.icon.emoji" }));
    const search = screen.getByRole("combobox", { name: "space.icon.search-emoji" });
    type(search, "🌱🌱");
    expect(screen.getByRole("status")).toHaveTextContent("space.icon.no-results");
    expect(screen.queryByRole("gridcell")).not.toBeInTheDocument();
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

  it("sizes inline emoji independently of surrounding text and keeps them decorative", () => {
    const view = render(<SpaceIcon icon={icon("🌱", "emoji")} />);
    expect(screen.getByText("🌱")).toHaveClass("mu-icon", "text-base");
    expect(screen.getByText("🌱")).toHaveAttribute("aria-hidden", "true");
    view.rerender(<SpaceIcon icon={icon("🌱", "emoji")} size={12} />);
    expect(screen.getByText("🌱")).toHaveClass("mu-icon-xs", "text-xs");
  });

  it("uses the same compact identity tile for emoji, symbols, and missing icons", () => {
    const view = render(<SpaceMark icon={icon("🌱", "emoji")} size="sm" />);
    expect(view.container.firstElementChild).toHaveClass("size-5", "bg-mu-hover");
    expect(screen.getByText("🌱")).toHaveClass("mu-icon-xs", "text-sm");
    view.rerender(<SpaceMark icon={icon("leaf")} size="sm" />);
    expect(view.container.firstElementChild).toHaveClass("size-5", "bg-mu-hover");
    expect(view.container.querySelector(".lucide-leaf")).toHaveClass("mu-icon-xs");
    view.rerender(<SpaceMark size="sm" />);
    expect(view.container.firstElementChild).toHaveClass("size-5", "bg-mu-hover");
    expect(view.container.querySelector(".lucide-astroid")).toHaveClass("mu-icon-xs");
  });
});
