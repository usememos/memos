import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { makeTagCompletionSource } from "@/components/MemoEditor/Editor/tagAutocomplete";

function complete(doc: string, pos: number, tags: string[]) {
  const source = makeTagCompletionSource(() => tags);
  const state = EditorState.create({ doc });
  return source(new CompletionContext(state, pos, false));
}

describe("tag autocomplete", () => {
  it("offers known tags after #", () => {
    const result = complete("hello #to", 9, ["todo", "today", "work"]);
    expect(result?.options.map((o) => o.label)).toEqual(["todo", "today"]);
  });

  it("returns null on a bare # with nothing typed", () => {
    expect(complete("hello #", 7, ["todo"])).toBeNull();
  });

  it("returns null when not in a tag", () => {
    expect(complete("hello world", 11, ["todo"])).toBeNull();
  });
});
