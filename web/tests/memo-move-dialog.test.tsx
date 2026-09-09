import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoMoveDialog from "@/components/MemoActionMenu/MemoMoveDialog";
import { MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { SpaceSchema } from "@/types/proto/api/v1/space_service_pb";

const state = vi.hoisted(() => ({ update: vi.fn(), refetch: vi.fn(), user: "users/alice" }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: state.user }) }));
vi.mock("@/hooks/useMemoQueries", () => ({ useUpdateMemo: () => ({ mutateAsync: state.update, isPending: false }) }));
vi.mock("@/hooks/useSpaceQueries", () => ({
  useSpaces: () => ({
    data: [create(SpaceSchema, { name: "spaces/a", title: "Design" }), create(SpaceSchema, { name: "spaces/b", title: "Product" })],
    isPending: false,
    refetch: state.refetch,
  }),
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn() } }));

const memo = create(MemoSchema, { name: "memos/original", creator: "users/alice", space: "spaces/a", visibility: Visibility.SPACE });
const selectDestination = async (name: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: "space.current" }));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
};

describe("Move to Space", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = "users/alice";
    state.update.mockResolvedValue(memo);
  });

  it("requires a new destination and moves with explicit Space audience", async () => {
    const close = vi.fn();
    render(<MemoMoveDialog memo={memo} onOpenChange={close} />);
    expect(screen.getByRole("button", { name: "memo.move.confirm" })).toBeDisabled();
    await selectDestination("Product");
    fireEvent.click(screen.getByRole("button", { name: "memo.move.confirm" }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(state.update).toHaveBeenCalledWith({
      update: { name: memo.name, space: "spaces/b", visibility: Visibility.SPACE },
      updateMask: ["space", "visibility"],
    });
  });

  it("defaults to Private when unassigning a Space-visible memo", async () => {
    render(<MemoMoveDialog memo={memo} onOpenChange={vi.fn()} />);
    await selectDestination("memo.move.unassigned");
    fireEvent.click(screen.getByRole("button", { name: "memo.move.confirm" }));
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        update: { name: memo.name, space: "", visibility: Visibility.PRIVATE },
        updateMask: ["space", "visibility"],
      }),
    );
  });

  it("preserves non-Space audience while assigning a memo", async () => {
    render(<MemoMoveDialog memo={{ ...memo, space: undefined, visibility: Visibility.PUBLIC }} onOpenChange={vi.fn()} />);
    await selectDestination("Product");
    fireEvent.click(screen.getByRole("button", { name: "memo.move.confirm" }));
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        update: { name: memo.name, space: "spaces/b", visibility: Visibility.PUBLIC },
        updateMask: ["space"],
      }),
    );
  });

  it("keeps the dialog open and refreshes destinations when a move is rejected", async () => {
    state.update.mockRejectedValue(new Error("Membership changed"));
    const close = vi.fn();
    render(<MemoMoveDialog memo={memo} onOpenChange={close} />);
    await selectDestination("Product");
    fireEvent.click(screen.getByRole("button", { name: "memo.move.confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Membership changed");
    expect(close).not.toHaveBeenCalled();
    expect(state.refetch).toHaveBeenCalledOnce();
  });

  it("does not allow another user to submit a move", async () => {
    state.user = "users/bob";
    render(<MemoMoveDialog memo={memo} onOpenChange={vi.fn()} />);
    await selectDestination("Product");
    expect(screen.getByRole("button", { name: "memo.move.confirm" })).toBeDisabled();
    expect(state.update).not.toHaveBeenCalled();
  });
});
