import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Button, Tooltip } from "@usememos/ui";
import { SmilePlusIcon } from "lucide-react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoReactionListView from "@/components/MemoReactionListView/MemoReactionListView";
import ReactionSelector from "@/components/MemoReactionListView/ReactionSelector";
import { memoDetailQueryOptions, memoKeys } from "@/hooks/useMemoQueries";
import { State } from "@/types/proto/api/common_pb";
import { MemoSchema, ReactionSchema } from "@/types/proto/api/memo_service_pb";
import { UserSchema } from "@/types/proto/api/user_service_pb";

const state = vi.hoisted(() => ({
  currentUser: { name: "users/me", username: "me" } as { name: string; username: string } | undefined,
  api: { getMemo: vi.fn(), upsertMemoReaction: vi.fn(), deleteMemoReaction: vi.fn() },
}));

vi.mock("@/connect", () => ({ memoServiceClient: state.api }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => state.currentUser }));
vi.mock("@/contexts/MentionResolutionContext", () => ({
  useResolvedUsersByNames: () =>
    new Map([
      ["users/me", create(UserSchema, { name: "users/me", username: "me" })],
      ["users/other", create(UserSchema, { name: "users/other", username: "other" })],
    ]),
}));
vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ memoRelatedSetting: { reactions: ["👍", "🎉", "❤️"] } }),
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const reactionMemo = () =>
  create(MemoSchema, {
    name: "memos/1",
    state: State.NORMAL,
    reactions: [
      { name: "memos/1/reactions/1", reactionType: "🎉", creator: "users/me" },
      { name: "memos/1/reactions/2", reactionType: "👍", creator: "users/other" },
    ],
  });

const setup = (memo = reactionMemo(), trigger?: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(memoKeys.detail(memo.name), memo);
  state.api.getMemo.mockResolvedValue(memo);
  const Surface = () => {
    const { data } = useQuery({ ...memoDetailQueryOptions(memo.name), staleTime: Infinity });
    if (!data) return null;
    return trigger ? <ReactionSelector memo={data} trigger={trigger} /> : <MemoReactionListView memo={data} reactions={data.reactions} />;
  };
  return render(
    <QueryClientProvider client={client}>
      <Tooltip.Provider>
        <Surface />
        <textarea aria-label="Memo draft" />
      </Tooltip.Provider>
    </QueryClientProvider>,
  );
};

const openPicker = async () => {
  fireEvent.click(screen.getByRole("button", { name: "setting.memo.add-reaction" }));
  return within(await screen.findByRole("dialog", { name: "setting.memo.add-reaction" }));
};

const openPickerWithMouse = () => {
  const trigger = screen.getByRole("button", { name: "setting.memo.add-reaction" });
  fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
  fireEvent.mouseDown(trigger, { button: 0 });
  trigger.focus();
  fireEvent.pointerUp(trigger, { pointerType: "mouse", button: 0 });
  fireEvent.mouseUp(trigger, { button: 0 });
  fireEvent.click(trigger, { detail: 1 });
};

describe("ReactionSelector", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.currentUser = { name: "users/me", username: "me" };
  });

  it("focuses the panel when opened with a mouse, leaving emoji choices unfocused", async () => {
    setup();
    openPickerWithMouse();
    const popup = await screen.findByRole("dialog", { name: "setting.memo.add-reaction" });
    await waitFor(() => expect(popup).toHaveFocus());
  });

  it("focuses the first choice for keyboard opening and the panel when subsequently reopened with a mouse", async () => {
    setup();
    const trigger = screen.getByRole("button", { name: "setting.memo.add-reaction" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger, { detail: 0 });
    fireEvent.keyUp(trigger, { key: "Enter" });
    const popup = await screen.findByRole("dialog", { name: "setting.memo.add-reaction" });
    await waitFor(() => expect(within(popup).getByRole("button", { name: "👍" })).toHaveFocus());

    fireEvent.keyDown(popup, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    openPickerWithMouse();
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
  });

  it("shows configured choices and shares the current user's pressed state with the strip", async () => {
    setup();
    expect(screen.getByRole("button", { name: /🎉\s*1/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /👍\s*1/ })).toHaveAttribute("aria-pressed", "false");

    const picker = await openPicker();
    expect(picker.getAllByRole("button")).toHaveLength(3);
    expect(picker.getByRole("button", { name: "🎉" })).toHaveAttribute("aria-pressed", "true");
    expect(picker.getByRole("button", { name: "👍" })).toHaveAttribute("aria-pressed", "false");
    expect(picker.getByRole("button", { name: "❤️" })).toBeInTheDocument();
  });

  it("updates the strip after a successful request, closes, and shows the saved choice when reopened", async () => {
    const memo = reactionMemo();
    setup(memo);
    state.api.getMemo.mockResolvedValue(
      create(MemoSchema, { ...memo, reactions: [...memo.reactions, create(ReactionSchema, { reactionType: "👍", creator: "users/me" })] }),
    );
    const request = Promise.withResolvers<void>();
    state.api.upsertMemoReaction.mockReturnValue(request.promise);

    const picker = await openPicker();
    fireEvent.click(picker.getByRole("button", { name: "👍" }));
    expect(state.api.upsertMemoReaction).toHaveBeenCalledWith({ parent: memo.name, reaction: { reactionType: "👍" } });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => request.resolve());

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "setting.memo.add-reaction" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /👍\s*2/ })).toHaveAttribute("aria-pressed", "true");
    expect((await openPicker()).getByRole("button", { name: "👍" })).toHaveAttribute("aria-pressed", "true");
  });

  it("removes an existing reaction and closes after the request completes", async () => {
    const memo = reactionMemo();
    setup(memo);
    state.api.getMemo.mockResolvedValue(create(MemoSchema, { ...memo, reactions: memo.reactions.filter((r) => r.creator !== "users/me") }));

    fireEvent.click((await openPicker()).getByRole("button", { name: "🎉" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(state.api.deleteMemoReaction).toHaveBeenCalledExactlyOnceWith({ name: "memos/1/reactions/1" });
    expect(screen.queryByRole("button", { name: /🎉\s*1/ })).not.toBeInTheDocument();
    expect((await openPicker()).getByRole("button", { name: "🎉" })).toHaveAttribute("aria-pressed", "false");
  });

  it("preserves the existing failure behavior: closes without changing saved reactions", async () => {
    setup();
    state.api.upsertMemoReaction.mockRejectedValue(new Error("Request failed"));
    fireEvent.click((await openPicker()).getByRole("button", { name: "👍" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "setting.memo.add-reaction" })).toHaveFocus();
    expect(state.api.getMemo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /👍\s*1/ })).toHaveAttribute("aria-pressed", "false");
    expect((await openPicker()).getByRole("button", { name: "👍" })).toHaveAttribute("aria-pressed", "false");
  });

  it.each(["success", "failure"])("keeps editing focus when a dismissed picker's slow request ends in %s", async (outcome) => {
    setup();
    const request = Promise.withResolvers<void>();
    state.api.upsertMemoReaction.mockReturnValue(request.promise);
    const picker = await openPicker();
    const choice = picker.getByRole("button", { name: "👍" });
    choice.focus();
    fireEvent.click(choice);
    expect(state.api.upsertMemoReaction).toHaveBeenCalledTimes(1);

    const editor = screen.getByRole("textbox", { name: "Memo draft" });
    fireEvent.pointerDown(editor, { pointerType: "mouse", button: 0 });
    editor.focus();
    fireEvent.pointerUp(editor, { pointerType: "mouse", button: 0 });
    fireEvent.click(editor);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(editor).toHaveFocus();
    fireEvent.change(editor, { target: { value: "Continue editing" } });

    await act(async () => {
      if (outcome === "success") request.resolve();
      else request.reject(new Error("Request failed"));
      await request.promise.catch(() => {});
    });

    expect(editor).toHaveFocus();
    expect(editor).toHaveValue("Continue editing");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["signed out", "archived"])("keeps reactions non-interactive when %s", (mode) => {
    const memo = reactionMemo();
    if (mode === "signed out") state.currentUser = undefined;
    else memo.state = State.ARCHIVED;
    setup(memo);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("🎉").closest("button, [role=button], [tabindex]")).toBeNull();
    expect(screen.getByText("👍")).toBeInTheDocument();
    expect(state.api.upsertMemoReaction).not.toHaveBeenCalled();
  });

  it("keeps the header's supplied trigger and returns focus after Escape", async () => {
    setup(reactionMemo(), <Button variant="ghost" size="sm" icon={<SmilePlusIcon />} data-testid="header-trigger" />);
    const trigger = screen.getByRole("button", { name: "setting.memo.add-reaction" });
    expect(trigger).toBe(screen.getByTestId("header-trigger"));
    trigger.focus();
    await openPicker();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
