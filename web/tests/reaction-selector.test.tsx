import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Button, Tooltip } from "@usememos/ui";
import { SmilePlusIcon } from "lucide-react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoReactionListView from "@/components/MemoReactionListView/MemoReactionListView";
import ReactionSelector from "@/components/MemoReactionListView/ReactionSelector";
import { memoKeys, useMemoRecord } from "@/hooks/useMemoQueries";
import { State } from "@/types/proto/api/common_pb";
import { type Memo, MemoSchema, type Reaction, ReactionSchema } from "@/types/proto/api/memo_service_pb";
import { SpaceMember_Role } from "@/types/proto/api/space_service_pb";
import { UserSchema } from "@/types/proto/api/user_service_pb";

const state = vi.hoisted(() => ({
  currentUser: { name: "users/me", username: "me" } as { name: string; username: string } | undefined,
  resolveUsers: true,
  role: 0,
  api: { getMemo: vi.fn(), upsertMemoReaction: vi.fn(), deleteMemoReaction: vi.fn(), showErrorToast: vi.fn() },
}));
vi.mock("@/connect", () => ({ memoServiceClient: state.api }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => state.currentUser }));
vi.mock("@/hooks/useSpaceQueries", () => ({ useSpaces: () => ({ data: [{ name: "spaces/a", currentUserRole: state.role }] }) }));
vi.mock("@/lib/toast", () => ({ showErrorToast: state.api.showErrorToast }));
vi.mock("@/contexts/MentionResolutionContext", () => ({
  useResolvedUsersByNames: () =>
    state.resolveUsers
      ? new Map([
          ["users/me", create(UserSchema, { name: "users/me", username: "me" })],
          ["users/other", create(UserSchema, { name: "users/other", username: "other" })],
        ])
      : new Map(),
}));
vi.mock("@/lib/emoji-data", () => ({
  EMOJI: [
    ["👍", "thumbs up"],
    ["🎉", "party popper"],
    ["❤️", "red heart"],
    ["🦊", "fox"],
    ["👍🏽", "thumbs up: medium skin tone"],
  ],
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key, translate: (key: string) => key }));

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
  const Surface = () => {
    const data = useMemoRecord(memo.name) as Memo;
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
  fireEvent.click(screen.getByRole("button", { name: "memo.add-reaction" }));
  return within(await screen.findByRole("dialog", { name: "memo.add-reaction" }));
};

describe("ReactionSelector", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.currentUser = { name: "users/me", username: "me" };
    state.resolveUsers = true;
    state.role = 0;
  });

  it("focuses search, filters by name or pasted emoji, and shows a no-results state", async () => {
    setup();
    const picker = await openPicker();
    const search = picker.getByRole("combobox");
    await waitFor(() => expect(search).toHaveFocus());
    expect(picker.getByRole("gridcell", { name: "party popper" })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(search, { target: { value: "fox" } });
    expect(picker.getAllByRole("gridcell")).toHaveLength(1);
    expect(picker.getByRole("gridcell", { name: "fox" })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "👍🏽" } });
    expect(picker.getByRole("gridcell", { name: "thumbs up: medium skin tone" })).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "no such emoji" } });
    expect(picker.queryByRole("gridcell")).not.toBeInTheDocument();
    expect(picker.getByText("space.icon.no-results")).toBeVisible();
  });

  it("keeps accessible emoji names and actions without native tooltips or a preview footer", async () => {
    setup();
    const picker = await openPicker();
    const search = picker.getByRole("combobox");
    for (const cell of picker.getAllByRole("gridcell")) expect(cell).not.toHaveAttribute("title");

    const heart = picker.getByRole("gridcell", { name: "red heart" });
    expect(heart).toHaveAccessibleDescription("memo.add-reaction");
    expect(picker.getByRole("gridcell", { name: "party popper" })).toHaveAccessibleDescription("memo.remove-reaction");
    fireEvent.mouseMove(heart);
    expect(picker.queryByText("red heart")).not.toBeInTheDocument();
    fireEvent.keyDown(search, { key: "ArrowRight" });
    expect(document.getElementById(search.getAttribute("aria-activedescendant")!)).toHaveAccessibleName("party popper");
    expect(picker.queryByText("party popper")).not.toBeInTheDocument();
    expect(picker.queryByText("memo.add-reaction")).not.toBeInTheDocument();
  });

  it("selects with the keyboard, closes immediately and updates the strip during a slow request", async () => {
    setup();
    const request = Promise.withResolvers<Reaction>();
    state.api.upsertMemoReaction.mockReturnValue(request.promise);
    const picker = await openPicker();
    const search = picker.getByRole("combobox");
    fireEvent.change(search, { target: { value: "fox" } });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "memo.add-reaction" })).toHaveFocus();
    await waitFor(() => expect(screen.getByRole("button", { name: /fox: 1/ })).toHaveAttribute("aria-pressed", "true"));
    expect(state.api.upsertMemoReaction).toHaveBeenCalledWith({ parent: "memos/1", reaction: { reactionType: "🦊" } });
    expect(screen.getByRole("button", { name: "memo.add-reaction" })).toHaveAttribute("aria-disabled", "true");
    await act(async () =>
      request.resolve(create(ReactionSchema, { name: "memos/1/reactions/3", creator: "users/me", reactionType: "🦊" })),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "memo.add-reaction" })).toHaveAttribute("aria-disabled", "false"));
    expect((await openPicker()).getByRole("gridcell", { name: "fox" })).toHaveAttribute("aria-selected", "true");
  });

  it("removes an existing reaction from the picker", async () => {
    setup();
    fireEvent.click((await openPicker()).getByRole("gridcell", { name: "party popper" }));
    await waitFor(() => expect(state.api.deleteMemoReaction).toHaveBeenCalledWith({ name: "memos/1/reactions/1" }));
    expect(screen.queryByRole("button", { name: /party popper:/ })).not.toBeInTheDocument();
  });

  it("reports failure, restores the reaction and leaves editing focus alone", async () => {
    setup();
    const request = Promise.withResolvers<never>();
    state.api.upsertMemoReaction.mockReturnValue(request.promise);
    fireEvent.click((await openPicker()).getByRole("gridcell", { name: "fox" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /fox: 1/ })).toBeInTheDocument());
    const editor = screen.getByRole("textbox", { name: "Memo draft" });
    editor.focus();
    fireEvent.change(editor, { target: { value: "Continue editing" } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => request.reject(new Error("Request failed")));
    await waitFor(() => expect(state.api.showErrorToast).toHaveBeenCalledWith("Request failed"));
    expect(screen.queryByRole("button", { name: /fox: 1/ })).not.toBeInTheDocument();
    expect(editor).toHaveFocus();
    expect(editor).toHaveValue("Continue editing");
    logged.mockRestore();
  });

  it("keeps counts and names when profile lookup is unavailable", () => {
    state.resolveUsers = false;
    setup();
    expect(screen.getByRole("button", { name: /party popper: 1 · me/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /thumbs up: 1 · other/ })).toBeInTheDocument();
  });

  it("keeps a focused pill mounted when its count changes", async () => {
    setup();
    const pill = screen.getByRole("button", { name: /thumbs up: 1/ });
    const request = Promise.withResolvers<Reaction>();
    state.api.upsertMemoReaction.mockReturnValue(request.promise);
    pill.focus();
    fireEvent.click(pill);
    await waitFor(() => expect(screen.getByRole("button", { name: /thumbs up: 2/ })).toBe(pill));
    expect(pill).toHaveFocus();
    await act(async () => request.resolve(create(ReactionSchema, { creator: "users/me", reactionType: "👍" })));
    expect(pill).toHaveFocus();
  });

  it("shows participants on touch long-press without toggling the reaction", async () => {
    vi.useFakeTimers();
    try {
      setup();
      const pill = screen.getByRole("button", { name: /thumbs up: 1/ });
      fireEvent.pointerDown(pill, { pointerType: "touch" });
      await act(async () => vi.advanceTimersByTimeAsync(550));
      expect(screen.getByText("other")).toBeVisible();
      fireEvent.pointerUp(pill, { pointerType: "touch" });
      fireEvent.click(pill);
      expect(state.api.upsertMemoReaction).not.toHaveBeenCalled();
      expect(state.api.deleteMemoReaction).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["signed out", "archived"])("keeps reactions non-interactive when %s", (mode) => {
    const memo = reactionMemo();
    if (mode === "signed out") state.currentUser = undefined;
    else memo.state = State.ARCHIVED;
    setup(memo);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("🎉")).toBeInTheDocument();
  });

  it("hides the picker for a Space outsider but lets them withdraw their existing reaction", async () => {
    const memo = reactionMemo();
    memo.space = "spaces/a";
    setup(memo);
    expect(screen.queryByRole("button", { name: "memo.add-reaction" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /thumbs up:/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /party popper:/ }));
    await waitFor(() => expect(state.api.deleteMemoReaction).toHaveBeenCalledWith({ name: "memos/1/reactions/1" }));
  });

  it("offers the picker to an active Space member", async () => {
    state.role = SpaceMember_Role.USER;
    const memo = reactionMemo();
    memo.space = "spaces/a";
    setup(memo);
    expect((await openPicker()).getByRole("combobox")).toBeInTheDocument();
  });

  it("keeps a supplied header trigger and returns focus after Escape", async () => {
    setup(reactionMemo(), <Button variant="ghost" size="sm" icon={<SmilePlusIcon />} data-testid="header-trigger" />);
    const trigger = screen.getByRole("button", { name: "memo.add-reaction" });
    expect(trigger).toBe(screen.getByTestId("header-trigger"));
    await openPicker();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
