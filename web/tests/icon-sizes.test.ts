import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Standalone icons take the package's size classes (node_modules/@usememos/ui/llms-full.txt, Icons):
 * `mu-icon-xs` (12px), `mu-icon-sm` (14px) and `mu-icon` (16px) all draw the package's 1.25px
 * stroke. A Tailwind size on a `mu-icon` changes the box but not the stroke, which is how small
 * icons once ended up at a larger size's stroke and looked heavy.
 */
const SRC = resolve(import.meta.dirname, "../src");
const files = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"))
  .filter((file) => !file.startsWith("types/"))
  .map((file) => ({ path: relative(SRC, resolve(SRC, file)), text: readFileSync(resolve(SRC, file), "utf8") }));

// Class strings holding `mu-icon`, and a 12, 14 or 16px Tailwind size anywhere in one of them.
const CLASS_STRINGS = /["'`]([^"'`]*\bmu-icon\b[^"'`]*)["'`]/g;
const ICON_SIZE = /(?<![\w:.-])(size-(3|3\.5|4)|h-(3|3\.5|4) w-\3|w-(3|3\.5|4) h-\4|w-4 h-auto)(?![\w.-])/;
const sizesIconByHand = (text: string) => [...text.matchAll(CLASS_STRINGS)].some((match) => ICON_SIZE.test(match[1]));

describe("icon sizes", () => {
  it("catches a hand-set size before or after mu-icon", () => {
    expect(sizesIconByHand('className="mu-icon size-3.5"')).toBe(true);
    expect(sizesIconByHand('className="h-4 w-4 mu-icon"')).toBe(true);
    expect(sizesIconByHand('className="mu-icon-sm"')).toBe(false);
    expect(sizesIconByHand('className="mu-icon size-5"')).toBe(false);
  });

  it("sizes 12, 14 and 16px icons with the package's size rows, not Tailwind", () => {
    expect(files.filter(({ text }) => sizesIconByHand(text)).map(({ path }) => path)).toEqual([]);
  });

  it("leaves Lucide's stroke to the package instead of setting it by hand", () => {
    // Drawn artwork (illustrations, the avatar fallback, the title's slash) sets its own strokes.
    const allowed = ["components/Placeholder/InkIllustration.tsx", "components/UserAvatar.tsx", "components/AppSidebar/SpaceSwitcher.tsx"];
    const offenders = files.filter(({ path, text }) => /\bstrokeWidth=/.test(text) && !allowed.includes(path)).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("passes icons to package controls through their icon slot, not as children", () => {
    // Package controls put their children in one label, so an icon child breaks onto its own line.
    // A trailing icon on a Button goes through iconEnd.
    const CONTROLS = /<(Button|Toggle|Menu\.Item|Menu\.CheckboxItem|Menu\.RadioItem|Menu\.SubmenuTrigger|Select\.Item)\b/g;
    const iconChildren = (text: string) => {
      const found: string[] = [];
      for (const open of text.matchAll(CONTROLS)) {
        // Walk to the end of the opening tag, skipping `>` inside props such as icon={<PlusIcon />}.
        let i = (open.index ?? 0) + open[0].length;
        for (let depth = 0; i < text.length; i++) {
          if (text[i] === "{") depth++;
          else if (text[i] === "}") depth--;
          else if (text[i] === ">" && depth === 0) break;
        }
        if (text[i - 1] === "/") continue;
        const body = text.slice(i + 1, text.indexOf(`</${open[1]}>`, i));
        const icon = body.replace(/icon=\{<[^}]*\}/g, "").match(/<([A-Z]\w*Icon|\w+\.icon|Spinner)\b/);
        if (icon) found.push(icon[0]);
      }
      return found;
    };
    const offenders = files.filter(({ text }) => iconChildren(text).length > 0).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});
