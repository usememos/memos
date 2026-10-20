import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoContentView } from "@/components/MemoEditor/view/MemoContentView";
import { highlightLoadedCode, loadHighlighter } from "@/lib/code-highlight";

const state = vi.hoisted(() => ({
  linkPreview: true,
  resolved: new Set<string>(),
  tagsSetting: undefined as unknown,
  filters: [] as { factor: string; value: string }[],
  addFilter: vi.fn(),
  removeFilter: vi.fn(),
  navigateTo: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ userTagsSetting: state.tagsSetting, userGeneralSetting: { theme: "default" } }),
}));

vi.mock("@/contexts/MemoFilterContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/contexts/MemoFilterContext")>()),
  useMemoFilterContext: () => ({
    getFiltersByFactor: (factor: string) => state.filters.filter((filter) => filter.factor === factor),
    addFilter: state.addFilter,
    removeFilter: state.removeFilter,
  }),
}));

vi.mock("@/hooks/useDevicePreferences", () => ({
  useDevicePreferences: () => ({ linkPreview: state.linkPreview, doubleClickEdit: false }),
}));
vi.mock("@/contexts/MentionResolutionContext", () => ({ useResolvedMentionUsernames: () => state.resolved }));
vi.mock("@/hooks/useNavigateTo", () => ({ default: () => state.navigateTo }));
vi.mock("@/hooks/useNearViewport", () => ({ useNearViewport: () => ({ ref: () => {}, isNearViewport: true }) }));
vi.mock("@/hooks/useMemoQueries", () => ({
  useLinkMetadata: () => ({
    data: { url: "https://example.com", title: "Example Title", description: "An example site", image: "" },
    isSuccess: true,
  }),
}));

const renderMemo = (content: string, props: Partial<React.ComponentProps<typeof MemoContentView>> = {}, path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MemoContentView content={content} memoName="memos/1" {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  state.linkPreview = true;
  state.resolved = new Set();
  state.tagsSetting = undefined;
  state.filters = [];
});

describe("memo view", () => {
  it("shows the memo read-only", () => {
    const { container } = renderMemo("# Title\n\nSome **bold** text");
    const root = container.querySelector(".memo-content-root");
    expect(root).toHaveAttribute("aria-readonly", "true");
    expect(container.querySelector("h1")).toHaveTextContent("Title");
    expect(container.querySelector("strong")).toHaveTextContent("bold");
  });

  it("lets an owner tick a task, changing only its bracket", async () => {
    const onTaskToggle = vi.fn();
    const content = "- [ ] First\n- [x] Second\n\nNote";
    const { container } = renderMemo(content, { onTaskToggle });
    const checkbox = container.querySelector<HTMLInputElement>("input.mbe-checkbox");
    expect(checkbox).not.toBeDisabled();
    fireEvent.mouseDown(checkbox!);
    await waitFor(() => expect(onTaskToggle).toHaveBeenCalledWith("- [x] First\n- [x] Second\n\nNote"));
  });

  it("keeps tasks locked for readers", () => {
    const { container } = renderMemo("- [ ] First");
    expect(container.querySelector("input.mbe-checkbox")).toBeDisabled();
  });
});

describe("tags and mentions", () => {
  it("toggles the tag filter from a list", () => {
    renderMemo("Plan #work today");
    fireEvent.click(screen.getByText("#work"));
    expect(state.addFilter).toHaveBeenCalledWith({ factor: "tagSearch", value: "work" });
  });

  it("opens the collection filtered by the tag from a memo detail page", () => {
    renderMemo("Plan #work today", { parentPage: "/?creator=alice" }, "/memos/1");
    fireEvent.click(screen.getByText("#work"));
    expect(state.navigateTo).toHaveBeenCalledWith("/?creator=alice&filter=tagSearch%3Awork");
  });

  it("does not treat code or links as tags", () => {
    const { container } = renderMemo("`#code` [#link](/x) #real");
    expect(Array.from(container.querySelectorAll(".mbe-tag"), (tag) => tag.textContent)).toEqual(["#real"]);
  });

  it("links resolved mentions to the profile and leaves unknown ones as text", () => {
    state.resolved = new Set(["alice"]);
    const { container } = renderMemo("Hi @alice and @nobody");
    const [alice, nobody] = container.querySelectorAll<HTMLElement>(".mbe-mention");
    expect(alice).toHaveAttribute("data-resolved");
    expect(nobody).not.toHaveAttribute("data-resolved");
  });
});

describe("headings", () => {
  it("gives every heading the anchor the outline links to", () => {
    const { container } = renderMemo("# Intro\n\n## Dup\n\n##### Dup\n\n## Dup\n\n# 🎉🎉\n\n# Comments");
    expect(Array.from(container.querySelectorAll("h1, h2, h5"), (heading) => heading.id)).toEqual([
      "intro",
      "dup",
      "dup-1",
      "dup-2",
      "heading",
      "comments-1",
    ]);
  });
});

describe("code blocks", () => {
  it("highlights the code and has the editor's copy button", async () => {
    const { container } = renderMemo("```js\nconst value = 1;\n```");
    expect(container.querySelector(".mbe-code .mbe-code-copy")).toBeInTheDocument();
    expect(container.querySelector<HTMLInputElement>(".mbe-code-lang")?.value).toBe("js");
    expect(container.querySelector(".mbe-code code")).toHaveTextContent("const value = 1;");
    await waitFor(() => expect(container.querySelector(".mbe-code code .hljs-keyword")).toHaveTextContent("const"));
  });

  it("escapes plain code and highlights common languages", async () => {
    expect(highlightLoadedCode('<script data-test="x">&</script>', "")).toBe("&lt;script data-test=&quot;x&quot;&gt;&amp;&lt;/script&gt;");
    await loadHighlighter("js");
    expect(highlightLoadedCode("const value = 1;", "js")).toContain("hljs-keyword");
  });
});

describe("link previews", () => {
  it("shows a card for a paragraph that is only a bare link", async () => {
    renderMemo("https://example.com");
    await waitFor(() => expect(screen.getByText("Example Title")).toBeInTheDocument());
  });

  it("keeps the plain link when previews are off or the link has its own text", () => {
    state.linkPreview = false;
    const { container } = renderMemo("https://example.com\n\n[Example](https://example.com)");
    expect(screen.queryByText("Example Title")).not.toBeInTheDocument();
    expect(container.querySelectorAll("a")).toHaveLength(2);
  });
});

describe("raw HTML", () => {
  it("renders inline HTML through the sanitizer", async () => {
    const { container } = renderMemo('Press <kbd>Ctrl</kbd> <span onclick="x">now</span>');
    await waitFor(() => expect(container.querySelector("kbd")).toHaveTextContent("Ctrl"));
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container).not.toHaveTextContent("<kbd>");
  });

  it("renders disclosures once the sanitizer loads", async () => {
    const { container } = renderMemo("<details open><summary>Read <em>more</em></summary>\n\nSupporting text.\n\n</details>");
    await waitFor(() => expect(container.querySelector("details")).toHaveAttribute("open"));
    expect(container.querySelector("summary em")).toHaveTextContent("more");
    expect(screen.getByText("Supporting text.")).toBeInTheDocument();
  });
});

describe("callouts and collapsible sections", () => {
  it("shows a GitHub alert as a callout with its type's icon", () => {
    const { container } = renderMemo("> [!WARNING]\n> Back up first.");
    const callout = container.querySelector('blockquote[data-callout="warning"]');
    expect(callout).toHaveTextContent("Back up first.");
    expect(callout).not.toHaveTextContent("[!WARNING]");
    expect(callout?.querySelector(".mbe-callout-icon")).toHaveAttribute("aria-label", "Warning");
  });

  it("renders a list inside a quote", () => {
    const { container } = renderMemo("> ✏️ **quick note**\n> * Item 1: check xyz\n> * Item 2: check abc");
    expect(container.querySelector("blockquote strong")).toHaveTextContent("quick note");
    expect(container.querySelectorAll(".mbe-list-item")).toHaveLength(2);
    expect(container).not.toHaveTextContent(">");
  });

  it("renders footnotes, quotes and code inside a collapsible section", () => {
    const { container } = renderMemo(
      "<details><summary>Test</summary>\n\n> **Tip** Test[^1]\n\n```\nSome code here\n```\n\n</details>\n\n[^1]: very important",
    );
    expect(container.querySelector(".mbe-details")).toHaveTextContent("Test");
    expect(container.querySelector("blockquote .mbe-footnote-ref")).toHaveTextContent("1");
    expect(container.querySelector(".mbe-code code")).toHaveTextContent("Some code here");
    expect(container).not.toHaveTextContent("<details>");
  });
});

describe("math", () => {
  it("renders formulas with KaTeX once it loads", async () => {
    const { container } = renderMemo("$L$ and\n\n$$\nx + y\n$$");
    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("keeps currency dollars literal", async () => {
    const { container } = renderMemo("less than $1,000, and over $1,000 - owner");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(container.querySelector(".katex")).toBeNull();
    expect(container).toHaveTextContent("less than $1,000, and over $1,000 - owner");
  });
});

describe("footnotes", () => {
  it("shows a reference as a raised label and its definition as a note", () => {
    const { container } = renderMemo("Fact[^1]\n\n[^1]: The source.");
    expect(container.querySelector(".mbe-footnote-ref")).toHaveTextContent("1");
    expect(container.querySelector(".mbe-footnote")).toHaveTextContent("1The source.");
  });
});

describe("links", () => {
  it("scrolls to an in-memo anchor instead of opening a new tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container } = renderMemo("# Intro\n\n[back to top](#intro) [sms](sms:+44)");
    fireEvent.click(screen.getByText("back to top"));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(container.querySelector('a[href="sms:+44"]')).not.toBeNull();
  });
});

describe("images", () => {
  it("loads relative and https images and drops other schemes", () => {
    const { container } = renderMemo("![a](/file/a.png) ![b](https://img.example/b.png) ![c](http://tracker.example/c.png)");
    const sources = Array.from(container.querySelectorAll("img"), (image) => image.getAttribute("src"));
    expect(sources[0]).toBe("/file/a.png");
    expect(sources[1]).toBe("https://img.example/b.png");
    expect(sources[2] ?? "").not.toContain("tracker.example");
    expect(container.querySelector("img")).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
  });
});
