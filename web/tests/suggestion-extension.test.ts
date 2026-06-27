import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { buildExtensions } from "@/components/MemoEditor/Editor/extensions";
import { createSuggestionExtension } from "@/components/MemoEditor/Editor/suggestionExtension";

describe("createSuggestionExtension", () => {
  it("creates a Tiptap extension with the configured name", () => {
    const ext = createSuggestionExtension<string>({
      name: "fooSuggestion",
      char: "@",
      items: () => [],
      command: () => {},
      renderItem: (item) => item,
      getItemKey: (item) => item,
    });
    expect(ext.name).toBe("fooSuggestion");
  });

  it("contributes its suggestion plugin to the editor", () => {
    const base = new Editor({ extensions: buildExtensions(), content: "", contentType: "markdown" });
    const baseline = base.state.plugins.length;
    base.destroy();

    const withSuggestion = new Editor({
      extensions: [
        ...buildExtensions(),
        createSuggestionExtension<string>({
          name: "pluginProbe",
          char: "@",
          items: () => [],
          command: () => {},
          renderItem: (item) => item,
          getItemKey: (item) => item,
        }),
      ],
      content: "",
      contentType: "markdown",
    });
    try {
      expect(withSuggestion.state.plugins.length).toBeGreaterThan(baseline);
    } finally {
      withSuggestion.destroy();
    }
  });

  it("lets multiple triggers coexist in one editor without plugin-key collision", () => {
    const tagLike = createSuggestionExtension<string>({
      name: "tagLike",
      char: "#",
      items: () => ["alpha"],
      command: () => {},
      renderItem: (item) => item,
      getItemKey: (item) => item,
    });
    const slashLike = createSuggestionExtension<string>({
      name: "slashLike",
      char: "/",
      items: () => ["heading"],
      command: () => {},
      renderItem: (item) => item,
      getItemKey: (item) => item,
    });

    const editor = new Editor({
      extensions: [...buildExtensions(), tagLike, slashLike],
      content: "",
      contentType: "markdown",
    });
    try {
      const names = editor.extensionManager.extensions.map((e) => e.name);
      expect(names).toContain("tagLike");
      expect(names).toContain("slashLike");
    } finally {
      editor.destroy();
    }
  });
});
