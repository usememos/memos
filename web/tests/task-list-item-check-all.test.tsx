import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskListItem } from "@/components/MemoContent/TaskListItem";

// Regression test for usememos/memos#6143 ("Check all tasks not working").
//
// remark-gfm passes `checked: undefined` for unchecked task items (`- [ ]`).
// Base UI's Checkbox locks controlled/uncontrolled mode at mount, so a checkbox
// that mounts with `checked === undefined` becomes uncontrolled and silently
// ignores `checked=true` arriving later — exactly what happens after
// "Check all tasks" rewrites the memo content and the markdown re-renders.
// TaskListItem must coerce `checked` to a boolean so the checkbox is always
// controlled.

const mockUpdateMemo = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useMemoQueries", () => ({
  useUpdateMemo: () => ({ mutate: mockUpdateMemo }),
}));

vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => ({
    memo: {
      name: "memos/1",
      content: "- [ ] task one",
      relations: [],
      attachments: [],
      reactions: [],
    },
  }),
  useMemoViewDerived: () => ({
    readonly: false,
  }),
}));

describe("<TaskListItem /> check-all regression (#6143)", () => {
  it("reflects checked=true arriving after mounting unchecked (Check all tasks)", () => {
    // remark-gfm renders `- [ ]` with `checked` undefined.
    const { rerender } = render(<TaskListItem checked={undefined} node={undefined} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    // "Check all tasks" updates memo content; the markdown re-renders with checked=true.
    rerender(<TaskListItem checked={true} node={undefined} />);
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("reflects checked reverting to undefined (Uncheck all tasks)", () => {
    const { rerender } = render(<TaskListItem checked={true} node={undefined} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "true");

    // remark-gfm passes undefined (not false) for `- [ ]` items.
    rerender(<TaskListItem checked={undefined} node={undefined} />);
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });
});
