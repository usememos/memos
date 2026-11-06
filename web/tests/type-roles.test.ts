import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The package's type scale sets text by role, not by size (node_modules/@usememos/ui/llms-full.txt,
 * Typography): `heading` is the page title, `title` is for dialog, panel and empty-state titles,
 * `label` is a section title. The migration once mapped sizes instead of roles and turned memo
 * text into the 500-weight `title` style; these checks keep that from coming back unnoticed.
 */
const SRC = resolve(import.meta.dirname, "../src");

const sourceFiles = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((file) => /\.(tsx|ts)$/.test(file) && !file.startsWith("types/"))
  .map((file) => ({ path: relative(SRC, resolve(SRC, file)), text: readFileSync(resolve(SRC, file), "utf8") }));

const filesUsing = (pattern: RegExp) =>
  sourceFiles
    .filter(({ text }) => pattern.test(text))
    .map(({ path }) => path)
    .sort();

describe("type roles", () => {
  it("keeps the title style on dialog, panel and empty-state titles", () => {
    // A new use is fine when it is one of those roles: add it here. Page titles use `mu-heading`,
    // section titles `mu-label`, body text `mu-body`.
    expect(filesUsing(/\bmu-title\b/)).toEqual([
      "components/MemoActionMenu/MemoShareImagePreview.tsx",
      "components/MemoPanel/MemoPanel.tsx",
      "components/WelcomeGuide/WelcomeGuideDialog.tsx",
    ]);
  });

  it("keeps memo text at the editor's regular 16px, not a title style", () => {
    for (const path of ["components/MemoEditor/view/MemoContentView.tsx", "components/MemoEditor/edit/Editor.tsx"]) {
      const text = sourceFiles.find((file) => file.path === path)?.text ?? "";
      expect(text, path).toContain("text-base leading-6");
      expect(text, path).not.toMatch(/\bmu-(title|label|heading)\b/);
    }
  });

  it("uses Tailwind text sizes only for memo text, the wordmark and glyph-sized icons", () => {
    expect(filesUsing(/\btext-(xs|sm|base|lg|xl|2xl|3xl|\[\d+(\.\d+)?(px|rem|em)\])(?![\w-])/)).toEqual(
      [
        // Memo text and the composer: the editor's 16px reading size.
        "components/MemoEditor/MemoEditor.tsx",
        "components/MemoEditor/edit/Editor.tsx",
        "components/MemoEditor/view/MemoContentView.tsx",
        // Emoji and custom icons, whose font size is the icon box.
        "components/AppSidebar/ViewsSection.tsx",
        "components/CustomIconPicker.tsx",
        "components/MemoFilters.tsx",
        "components/MemoReactionListView/ReactionSelector.tsx",
        "components/SpaceIcon.tsx",
        "components/SpaceMark.tsx",
        "pages/MemoViews.tsx",
        // The serif wordmark.
        "components/IdentityLabel.tsx",
        // Sizes relative to memo text (inline code, tag pills, the welcome guide's memo specimen).
        "lib/markdownStyles.ts",
        "components/WelcomeGuide/headers.tsx",
        // Drawn into images: the share card, and the type labels printed on small thumbnails.
        "components/MemoActionMenu/MemoShareImagePreview.tsx",
        "components/MemoMetadata/Attachment/AttachmentListEditor.tsx",
        "components/MemoPreview/MemoPreview.tsx",
        // The decorative status numeral on the error pages.
        "pages/NotFound.tsx",
        "pages/PermissionDenied.tsx",
      ].sort(),
    );
  });
});
