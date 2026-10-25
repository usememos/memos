import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@usememos/editor";
import { createRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoMarkdown } from "@/components/MemoEditor/MemoMarkdown";
import { MemoContentView } from "@/components/MemoEditor/view/MemoContentView";
import { updateDevicePreferences } from "@/hooks/useDevicePreferences";

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

vi.mock("@/hooks/useDevicePreferences", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useDevicePreferences")>();
  return {
    ...actual,
    useDevicePreferences: () => ({ ...actual.useDevicePreferences(), linkPreview: state.linkPreview }),
  };
});
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

/** The task items the editor actually drew, not the empty element a block view hosts. */
const taskItems = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>(".mbe-list-item[data-list-type='task']"));

const taskItem = (container: HTMLElement, label: string) =>
  taskItems(container).find((item) => item.querySelector(":scope > .mbe-content")?.textContent?.startsWith(label));

const taskCheckbox = (item: HTMLElement) => item.querySelector<HTMLInputElement>(":scope > .mbe-marker > input.mbe-checkbox");

beforeEach(() => {
  localStorage.clear();
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

describe("completed task reading preference", () => {
  it("shows every task by default", () => {
    const { container } = renderMemo("- [ ] Open\n- [x] Done");
    expect(container).toHaveTextContent("Open");
    expect(container).toHaveTextContent("Done");
    expect(container.querySelector(".memos-hide-completed-tasks")).toBeNull();
  });

  it("hides completed tasks and restores them when the preference is turned off", async () => {
    const { container } = renderMemo("- [ ] Open\n- [x] Done");
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    expect(container).toHaveTextContent("Open");
    expect(container).not.toHaveTextContent("Done");
    expect(container.querySelector(".memos-hide-completed-tasks")).not.toBeNull();
    expect(container.querySelector("[data-memos-hidden-completed-task]")).not.toBeNull();

    await act(async () => updateDevicePreferences({ hideCompletedTasks: false }));
    expect(container).toHaveTextContent("Done");
    expect(container.querySelector("[data-memos-hidden-completed-task]")).toBeNull();
  });

  it("keeps open nested items and the completed parent that gives them context", async () => {
    const { container } = renderMemo("- [x] Parent\n  - [ ] Child\n  - [x] Done child\n- [x] Done sibling");
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    expect(container).toHaveTextContent("Parent");
    expect(container).toHaveTextContent("Child");
    expect(container).not.toHaveTextContent("Done child");
    expect(container).not.toHaveTextContent("Done sibling");
  });

  it("hides an all-completed list and restores it", async () => {
    const { container } = renderMemo("- [x] Parent\n  - [x] Child");
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    expect(container).not.toHaveTextContent("Parent");
    expect(container).not.toHaveTextContent("Child");

    await act(async () => updateDevicePreferences({ hideCompletedTasks: false }));
    expect(container).toHaveTextContent("Parent");
    expect(container).toHaveTextContent("Child");
  });

  it("leaves code, ordinary lists and links alone", async () => {
    const content = [
      "- [ ] Open",
      "- [x] Done",
      "",
      "- ordinary bullet",
      "",
      "```",
      "- [x] not a task",
      "```",
      "",
      "[Example](https://example.com)",
    ].join("\n");
    const { container } = renderMemo(content);
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    expect(container).not.toHaveTextContent("Done");
    expect(container).toHaveTextContent("ordinary bullet");
    expect(container).toHaveTextContent("- [x] not a task");
    expect(screen.getByRole("link", { name: "Example" })).toBeInTheDocument();
  });

  it("hides completed tasks and keeps open ones inside a quote", async () => {
    const { container } = renderMemo("> - [x] Done\n> - [ ] Open");
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    expect(container).toHaveTextContent("Open");
    expect(container).not.toHaveTextContent("Done");
  });

  it("hides a completed item when a code block keeps the whole list as raw Markdown", async () => {
    const content = ["- [x] Done", "- [ ] Open", "", "  ```js", "  let x = 1;", "  ```"].join("\n");
    const { container } = renderMemo(content);
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));

    expect(container.querySelector(".mbe-view-markdown")).not.toBeNull();
    expect(taskItem(container, "Done")).not.toBeVisible();
    expect(taskItem(container, "Open")).toBeVisible();
    expect(container.querySelector(".mbe-code code")).toHaveTextContent("let x = 1;");
    // The source is untouched: only the rendered element is hidden.
    expect(taskItem(container, "Done")).toHaveTextContent("Done");

    await act(async () => updateDevicePreferences({ hideCompletedTasks: false }));
    expect(taskItem(container, "Done")).toBeVisible();
    expect(taskItem(container, "Open")).toBeVisible();
  });

  it("hides a completed item in a multi-paragraph list and keeps the open item's text", async () => {
    const content = ["- [x] Done", "- [ ] Open", "", "  second paragraph"].join("\n");
    const { container } = renderMemo(content);
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));

    expect(taskItem(container, "Done")).not.toBeVisible();
    expect(taskItem(container, "Open")).toBeVisible();
    expect(taskItem(container, "Open")).toHaveTextContent("second paragraph");
  });

  it("keeps a completed raw item that gives an open nested task its context", async () => {
    const content = [
      "- [x] Parent",
      "  ```js",
      "  let x = 1;",
      "  ```",
      "  - [x] Child done",
      "  - [ ] Child open",
      "- [ ] Open sibling",
    ].join("\n");
    const { container } = renderMemo(content);
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));

    expect(taskItem(container, "Parent")).toBeVisible();
    expect(taskItem(container, "Child done")).not.toBeVisible();
    expect(taskItem(container, "Child open")).toBeVisible();
    expect(taskItem(container, "Open sibling")).toBeVisible();
  });

  it("keeps a completed raw item above an indented open task", async () => {
    const content = [
      "- [x] Parent",
      "  ```js",
      "  let x = 1;",
      "  ```",
      "  - [x] Child done",
      "    - [ ] Grandchild open",
      "- [ ] Open sibling",
    ].join("\n");
    const { container } = renderMemo(content);
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));

    expect(taskItem(container, "Parent")).toBeVisible();
    expect(taskItem(container, "Child done")).toBeVisible();
    expect(taskItem(container, "Grandchild open")).toBeVisible();
    expect(taskItem(container, "Open sibling")).toBeVisible();
  });

  it("hides and restores an all-completed raw list", async () => {
    const content = ["- [x] Parent", "  ```js", "  let x = 1;", "  ```", "  - [x] Child", "    - [x] Grandchild", "- [x] Other"].join("\n");
    const { container } = renderMemo(content);
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));

    for (const label of ["Parent", "Child", "Grandchild", "Other"]) {
      expect(taskItem(container, label)).not.toBeVisible();
    }
    expect(container.querySelector("[data-memos-hidden-completed-task]")).not.toBeNull();

    await act(async () => updateDevicePreferences({ hideCompletedTasks: false }));
    for (const label of ["Parent", "Child", "Grandchild", "Other"]) {
      expect(taskItem(container, label)).toBeVisible();
    }
    expect(container.querySelector("[data-memos-hidden-completed-task]")).toBeNull();
  });

  it("keeps raw Markdown, checkbox permissions and non-task content when tasks hide", async () => {
    const content = [
      "- [x] Done",
      "- [ ] Open",
      "",
      "  ```js",
      '  const task = "- [x] untouched";',
      "  ```",
      "",
      "- ordinary bullet",
      "",
      "[Example](https://example.com)",
    ].join("\n");
    const onTaskToggle = vi.fn();
    const { container } = renderMemo(content, { onTaskToggle });
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));

    const done = taskItem(container, "Done");
    expect(done).not.toBeVisible();
    // The source is still there: a checked box and the text, only not displayed.
    expect(taskCheckbox(done!)).toBeChecked();
    expect(done).toHaveTextContent("Done");
    // Open tasks keep their existing permission and update path.
    expect(taskCheckbox(taskItem(container, "Open")!)).not.toBeDisabled();
    expect(taskItems(container)).toHaveLength(2);
    expect(container.querySelector(".mbe-code code")).toHaveTextContent('const task = "- [x] untouched";');
    expect(container).toHaveTextContent("ordinary bullet");
    expect(screen.getByRole("link", { name: "Example" })).toBeVisible();
    expect(onTaskToggle).not.toHaveBeenCalled();
  });

  it("hides raw list tasks from the first paint when the preference is already on", () => {
    updateDevicePreferences({ hideCompletedTasks: true });
    const content = ["- [x] Done", "- [ ] Open", "", "  ```js", "  let x = 1;", "  ```"].join("\n");
    const { container } = renderMemo(content);
    expect(taskItem(container, "Done")).not.toBeVisible();
    expect(taskItem(container, "Open")).toBeVisible();
  });

  it("hides completed tasks from the first paint when the preference is already on", () => {
    updateDevicePreferences({ hideCompletedTasks: true });
    const { container } = renderMemo("- [ ] Open\n- [x] Done");
    expect(container).toHaveTextContent("Open");
    expect(container).not.toHaveTextContent("Done");
  });

  it("renders every task when a caller turns the filter off", async () => {
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    const { container } = renderMemo("- [ ] Open\n- [x] Done", { filterCompletedTasks: false });
    expect(container).toHaveTextContent("Open");
    expect(container).toHaveTextContent("Done");
  });

  it("renders every raw list task when a caller turns the filter off", async () => {
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    const content = ["- [x] Done", "- [ ] Open", "", "  ```js", "  let x = 1;", "  ```"].join("\n");
    const { container } = renderMemo(content, { filterCompletedTasks: false });
    expect(taskItem(container, "Done")).toBeVisible();
    expect(taskItem(container, "Open")).toBeVisible();
    expect(container.querySelector("[data-memos-hidden-completed-task]")).toBeNull();
  });

  it("hides a completed parent once its last open child is ticked", async () => {
    const content = "- [x] Parent\n  - [ ] A\n  - [ ] B";
    const onTaskToggle = vi.fn();
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    const { container } = renderMemo(content, { onTaskToggle });
    expect(container).toHaveTextContent("Parent");

    fireEvent.mouseDown(container.querySelectorAll<HTMLInputElement>("input.mbe-checkbox")[1]);
    await waitFor(() => expect(onTaskToggle).toHaveBeenCalledWith("- [x] Parent\n  - [x] A\n  - [ ] B"));
    expect(container).not.toHaveTextContent("A");
    expect(container).toHaveTextContent("Parent");

    const remaining = container.querySelectorAll<HTMLInputElement>("input.mbe-checkbox");
    expect(remaining).toHaveLength(2);
    fireEvent.mouseDown(remaining[1]);
    await waitFor(() => expect(container).not.toHaveTextContent("Parent"));
  });

  it("keeps the source mapping when a visible task is ticked", async () => {
    const content = "- [ ] First\n- [x] Second\n\nNote";
    const onTaskToggle = vi.fn();
    const { container } = renderMemo(content, { onTaskToggle });
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    const checkbox = container.querySelector<HTMLInputElement>("input.mbe-checkbox");
    expect(checkbox).not.toBeNull();
    fireEvent.mouseDown(checkbox!);
    await waitFor(() => expect(onTaskToggle).toHaveBeenCalledWith("- [x] First\n- [x] Second\n\nNote"));
  });

  it("does not write a memo when the preference changes", async () => {
    const onTaskToggle = vi.fn();
    renderMemo("- [ ] Open\n- [x] Done", { onTaskToggle });
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    await act(async () => updateDevicePreferences({ hideCompletedTasks: false }));
    expect(onTaskToggle).not.toHaveBeenCalled();
  });

  it("keeps keyboard focus on a task that becomes completed but stays visible for its open child", async () => {
    const onTaskToggle = vi.fn();
    const { container } = renderMemo("- [ ] Parent\n  - [ ] Child", { onTaskToggle });
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));

    const parent = taskItem(container, "Parent");
    expect(parent).not.toBeNull();
    const checkbox = taskCheckbox(parent!);
    checkbox?.focus();
    expect(checkbox).toHaveFocus();

    // Space on a checkbox activates it as a click with detail 0; the editor's click
    // handler toggles a task only for that value.
    fireEvent.click(checkbox!, { detail: 0 });

    await waitFor(() => expect(onTaskToggle).toHaveBeenCalledWith("- [x] Parent\n  - [ ] Child"));
    // The redraw makes a new checkbox for the same block; the keyboard position stays
    // on that task while it is still shown as the open child's context.
    const after = taskItem(container, "Parent");
    expect(after).not.toBeNull();
    expect(taskCheckbox(after!)).toHaveFocus();
    expect(container).toHaveTextContent("Child");
  });

  it("keeps every task while the editor is editable", async () => {
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    const { container } = render(
      <MemoryRouter>
        <MemoMarkdown value={"- [ ] Open\n- [x] Done"} editable />
      </MemoryRouter>,
    );
    expect(container).toHaveTextContent("Open");
    expect(container).toHaveTextContent("Done");
  });

  it("keeps a raw list's source while the editor is editable", async () => {
    await act(async () => updateDevicePreferences({ hideCompletedTasks: true }));
    const content = ["- [x] Done", "- [ ] Open", "", "  ```js", "  let x = 1;", "  ```"].join("\n");
    const { container } = render(
      <MemoryRouter>
        <MemoMarkdown value={content} editable />
      </MemoryRouter>,
    );
    expect(container).toHaveTextContent("Done");
    expect(container).toHaveTextContent("Open");
    expect(container).toHaveTextContent("let x = 1;");
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
    await waitFor(() => expect(container.querySelector(".mbe-code code .memos-code-token")).toHaveTextContent("const"));
  });

  it("keeps HTML literal in highlighted and plain code", async () => {
    const code = '<script data-test="x">&</script>';
    const content = ["html", "", "not-a-language"].map((language) => `\`\`\`${language}\n${code}\n\`\`\``).join("\n\n");
    const { container } = renderMemo(content);
    await waitFor(() => expect(container.querySelector(".memos-code-token")).not.toBeNull());
    expect(container.querySelectorAll(".mbe-code code")).toHaveLength(3);
    for (const block of container.querySelectorAll(".mbe-code code")) expect(block.textContent).toBe(code);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[data-test]")).toBeNull();
  });

  it("highlights changed code while editing without changing the stored Markdown", async () => {
    const editorRef = createRef<Editor>();
    const onChange = vi.fn();
    const content = '```ts\nconst message = "😀中文";\n```';
    const { container, rerender } = render(<MemoMarkdown value={content} editable editorRef={editorRef} onChange={onChange} />);
    await waitFor(() => expect(container.querySelector(".memos-code-token")).not.toBeNull());
    expect(editorRef.current?.getMarkdown()).toBe(content);

    const updated = content.replace("message", "greeting");
    rerender(<MemoMarkdown value={updated} editable editorRef={editorRef} onChange={onChange} />);
    expect(container.querySelector(".mbe-code code")).toHaveTextContent('const greeting = "😀中文";');
    expect(editorRef.current?.getMarkdown()).toBe(updated);
    expect(onChange).not.toHaveBeenCalled();
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
