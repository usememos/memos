import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { EditorProvider } from "@/components/MemoEditor/state";
import InsertMenu from "@/components/MemoEditor/Toolbar/InsertMenu";

vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  useTranslate: () => (key: string) => key,
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => undefined }));
vi.mock("@/components/map/useReverseGeocoding", () => ({ useReverseGeocoding: () => ({ data: undefined }) }));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const renderMenu = (onInsertImages = vi.fn()) =>
  render(
    <EditorProvider>
      <InsertMenu
        onLocationChange={vi.fn()}
        onInsertImages={onInsertImages}
        onAudioRecorderClick={vi.fn()}
        isFormattingToolbarVisible={false}
      />
    </EditorProvider>,
  );

describe("InsertMenu", () => {
  test("shows attachment and inline-image actions in the intended order", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "common.add" });
    expect(trigger).toHaveAttribute("tabindex", "0");

    fireEvent.click(trigger);

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "editor.insert-menu.add-attachment",
      "editor.insert-menu.insert-image",
      "editor.audio-recorder.trigger",
      "editor.insert-menu.link-memo",
      "editor.insert-menu.add-location",
      "editor.focus-mode",
      "editor.formatting-toolbar",
    ]);
  });

  test("uses separate unrestricted and multi-image file inputs", () => {
    const onInsertImages = vi.fn();
    const { container } = renderMenu(onInsertImages);
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    const attachmentInput = inputs.find((input) => input.accept === "");
    const inlineImageInput = inputs.find((input) => input.accept === "image/*");

    expect(attachmentInput).toBeDefined();
    expect(attachmentInput).toHaveAttribute("multiple");
    expect(inlineImageInput).toBeDefined();
    expect(inlineImageInput).toHaveAttribute("multiple");

    const image = new File(["image"], "photo.png", { type: "image/png" });
    fireEvent.change(inlineImageInput!, { target: { files: [image] } });
    expect(onInsertImages).toHaveBeenCalledWith([image]);
  });
});
