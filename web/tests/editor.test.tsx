import { create } from "@bufbuild/protobuf";
import { render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Editor from "@/components/MemoEditor/edit/Editor";
import type { EditorController } from "@/components/MemoEditor/edit/types/editorController";
import { UserSetting_TagsSettingSchema } from "@/types/proto/api/user_service_pb";
import { ColorSchema } from "@/types/proto/google/type/color_pb";

const queries = vi.hoisted(() => ({
  useTagCounts: vi.fn(() => ({ data: {} })),
  users: new Map<string, unknown>(),
  tagsSetting: undefined as unknown,
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: queries.useTagCounts,
  useUsersByUsernames: (usernames: string[]) => ({
    data: usernames.length ? new Map(usernames.map((username) => [username, queries.users.get(username)])) : undefined,
  }),
  userDetailQueryOptions: () => ({}),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userTagsSetting: queries.tagsSetting }) }));

const baseProps = {
  className: "x",
  placeholder: "memo",
  onContentChange: () => {},
  onFiles: () => {},
  onSubmit: () => {},
};

describe("Editor", () => {
  it("scopes tag autocomplete stats to the current user", () => {
    render(<Editor {...baseProps} value="" />);

    expect(queries.useTagCounts).toHaveBeenCalledWith(true);
  });

  it("loads markdown and serializes it back verbatim", () => {
    const ref = createRef<EditorController>();
    render(<Editor {...baseProps} ref={ref} value={"# Title\n\n- a\n  1. b"} />);
    expect(ref.current?.getMarkdown()).toBe("# Title\n\n- a\n  1. b");
  });

  it("emits edits through onContentChange", async () => {
    const ref = createRef<EditorController>();
    const onContentChange = vi.fn();
    render(<Editor {...baseProps} ref={ref} value="alpha" onContentChange={onContentChange} />);
    ref.current?.setSelection({ anchor: { block: 0, offset: 5 }, focus: { block: 0, offset: 5 } });
    ref.current?.insertMarkdown("beta");
    await waitFor(() => expect(onContentChange).toHaveBeenLastCalledWith("alpha\n\nbeta"));
  });

  it("applies a new value from outside the editor", () => {
    const ref = createRef<EditorController>();
    const { rerender } = render(<Editor {...baseProps} ref={ref} value="draft" />);
    rerender(<Editor {...baseProps} ref={ref} value="" />);
    expect(ref.current?.getMarkdown()).toBe("");
  });

  it("does not replace newer editor text with a stale local echo", async () => {
    const ref = createRef<EditorController>();
    const emitted: string[] = [];
    const props = { ...baseProps, ref, onContentChange: (markdown: string) => emitted.push(markdown) };
    const { rerender } = render(<Editor {...props} value="H" />);

    ref.current?.insertMarkdown("first");
    await waitFor(() => expect(emitted).toHaveLength(1));
    ref.current?.insertMarkdown("second");
    await waitFor(() => expect(emitted).toHaveLength(2));
    rerender(<Editor {...props} value={emitted[0]} />);

    expect(ref.current?.getMarkdown()).toBe(emitted[1]);
  });

  it("enables native text assistance for prose input", () => {
    const { container } = render(<Editor {...baseProps} value="" />);

    const root = container.querySelector(".memo-editor-root");
    expect(root).toHaveAttribute("autocorrect", "on");
    expect(root).toHaveAttribute("autocapitalize", "on");
    expect(root).toHaveAttribute("spellcheck", "true");
  });

  it("updates the placeholder when its translation changes", () => {
    const { container, rerender } = render(<Editor {...baseProps} value="" placeholder="Any thoughts?" />);
    const root = container.querySelector<HTMLElement>(".memo-editor-root");
    expect(root?.style.getPropertyValue("--mbe-placeholder")).toBe('"Any thoughts?"');

    rerender(<Editor {...baseProps} value="" placeholder="有什么想法？" />);
    expect(root?.style.getPropertyValue("--mbe-placeholder")).toBe('"有什么想法？"');
  });

  it("draws tags as the memo view does, in the viewer's custom colors", async () => {
    queries.tagsSetting = undefined;
    const { container, rerender } = render(<Editor {...baseProps} value="#work and #life" />);
    const tag = (name: string) => container.querySelector<HTMLElement>(`.mbe-tag[data-tag="${name}"]`);
    expect(tag("life")).toHaveClass("rounded-full", "border-primary");
    expect(tag("work")).not.toHaveAttribute("style");

    queries.tagsSetting = create(UserSetting_TagsSettingSchema, {
      tags: { work: { backgroundColor: create(ColorSchema, { red: 1, green: 0, blue: 0 }) } },
    });
    rerender(<Editor {...baseProps} value="#work and #life" />);
    await waitFor(() => expect(tag("work")?.getAttribute("style")).toContain("color-mix"));
    expect(tag("work")).not.toHaveClass("border-primary");
    queries.tagsSetting = undefined;
  });

  it("draws mentions of people who exist as the memo view does", async () => {
    queries.users = new Map([["alice", { name: "users/alice" }]]);
    const { container } = render(<Editor {...baseProps} value="Hi @alice and @nobody" />);
    const mention = (name: string) => container.querySelector<HTMLElement>(`.mbe-mention[data-mention="${name}"]`);
    await waitFor(() => expect(mention("alice")).toHaveAttribute("data-resolved"), { timeout: 2000 });
    expect(mention("alice")).toHaveClass("text-primary");
    expect(mention("nobody")).not.toHaveAttribute("data-resolved");
    expect(mention("nobody")).not.toHaveClass("text-primary");
  });
});
