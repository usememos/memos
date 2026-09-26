import { type Completion, CompletionContext } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import {
  findMemoReferenceQuery,
  type MemoReferenceCandidate,
  type MemoReferenceSearch,
  makeMemoCompletionSource,
} from "@/components/MemoEditor/Editor/memoAutocomplete";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";

const candidates: MemoReferenceCandidate[] = [
  { uid: "abc123", snippet: "Quarterly planning notes" },
  { uid: "def456", snippet: "Reading list" },
];

/** Runs the source with the debounce disabled, so no test waits on a timer. */
const complete = (doc: string, search: MemoReferenceSearch = async () => candidates, pos = doc.length) => {
  const state = EditorState.create({ doc, extensions: [markdown({ extensions: memoMarkdownExtensions })] });
  return makeMemoCompletionSource(search, 0)(new CompletionContext(state, pos, false));
};

const applyCompletion = (doc: string, option: Completion, from: number, to: number): EditorView => {
  const view = new EditorView({ state: EditorState.create({ doc }) });
  if (typeof option.apply !== "function") throw new Error("a memo reference must be inserted by its own apply");
  option.apply(view, option, from, to);
  return view;
};

describe("memo reference query detection", () => {
  it.each([
    ["@", 0, ""],
    ["hello @plan", 6, "plan"],
    ["(@plan", 1, "plan"],
    ["@two words", 0, "two words"],
  ])("reads the query after a trigger @ in %s", (line, from, query) => {
    expect(findMemoReferenceQuery(line, line.length)).toEqual({ from, query });
  });

  it.each(["name@example.com", "a@b", "@ later in the sentence", `@${"x".repeat(41)}`])("finds no trigger in %s", (line) => {
    expect(findMemoReferenceQuery(line, line.length)).toBeUndefined();
  });

  it("uses the @ nearest the cursor", () => {
    expect(findMemoReferenceQuery("@first and @second", 18)).toEqual({ from: 11, query: "second" });
  });
});

describe("memo reference autocomplete", () => {
  it("offers the searched memos and replaces the trigger with a reference", async () => {
    const search = vi.fn(async (_query: string) => candidates);
    const completion = await complete("See @plan", search);

    expect(search).toHaveBeenCalledWith("plan");
    expect(completion?.from).toBe(4);
    expect(completion?.to).toBe(9);
    // The search already ranked them; CodeMirror must not re-filter prose snippets.
    expect(completion?.filter).toBe(false);
    expect(completion?.options.map((o) => o.label)).toEqual(["Quarterly planning notes", "Reading list"]);

    const view = applyCompletion("See @plan", completion!.options[0], completion!.from, completion!.to!);
    expect(view.state.doc.toString()).toBe("See [Memos](/memos/abc123)");
    // The cursor continues the sentence after the reference.
    expect(view.state.selection.main.head).toBe(26);
    view.destroy();
  });

  it("replaces only the trigger, leaving the rest of the line alone", async () => {
    const completion = await complete("a @plan b", undefined, 7);
    const view = applyCompletion("a @plan b", completion!.options[1], completion!.from, completion!.to!);
    expect(view.state.doc.toString()).toBe("a [Memos](/memos/def456) b");
    view.destroy();
  });

  it("offers recent memos for a bare @", async () => {
    const search = vi.fn(async (_query: string) => candidates);
    expect((await complete("@", search))?.options).toHaveLength(2);
    expect(search).toHaveBeenCalledWith("");
  });

  it("does not search where there is no trigger", async () => {
    const search = vi.fn(async (_query: string) => candidates);
    expect(await complete("mail me at a@b.com", search)).toBeNull();
    expect(search).not.toHaveBeenCalled();
  });

  it("stays closed when nothing matches", async () => {
    expect(await complete("@nope", async () => [])).toBeNull();
  });

  it("swallows a failed search instead of breaking the editor", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await complete("@plan", async () => {
        throw new Error("offline");
      }),
    ).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
