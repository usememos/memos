import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoDetailSidebar from "@/components/MemoDetailSidebar/MemoDetailSidebar";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import { LocationSchema, MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";

const updateMemo = vi.hoisted(() => vi.fn());

vi.mock("copy-to-clipboard", () => ({ default: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn() } }));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, render }: { children: React.ReactNode; render: React.ReactElement }) => (
    <>
      {render}
      {children}
    </>
  ),
}));
vi.mock("@/components/MemoEditor/Toolbar/VisibilitySelector", () => ({
  default: ({ onChange }: { onChange: (visibility: Visibility) => void }) => (
    <button type="button" onClick={() => onChange(Visibility.PRIVATE)}>
      visibility-selector
    </button>
  ),
}));
vi.mock("@/components/UserAvatar", () => ({ default: () => <div data-testid="avatar" /> }));
vi.mock("@/components/MemoDetailSidebar/MemoOutline", () => ({
  default: ({ headings }: { headings: unknown[] }) => <div data-testid="outline">{headings.length}</div>,
}));
vi.mock("@/components/MemoDetailSidebar/MemoSharePanel", () => ({ default: () => <div data-testid="share-panel" /> }));
vi.mock("@/components/MemoMetadata/Relation/useResolvedRelationMemos", () => ({ useResolvedRelationMemos: () => ({}) }));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ profile: { instanceUrl: "https://memos.example" } }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/alice" }) }));
vi.mock("@/hooks/useMemoQueries", () => ({ useUpdateMemo: () => ({ mutateAsync: updateMemo }) }));
vi.mock("@/hooks/useUserQueries", () => ({
  useUser: () => ({ data: { username: "alice", displayName: "Alice", avatarUrl: "" } }),
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/i18n", () => ({ default: { language: "en-US" } }));

describe("MemoDetailSidebar", () => {
  beforeEach(() => {
    updateMemo.mockReset();
    updateMemo.mockResolvedValue(undefined);
  });

  it("renders the property rail and wires editable quick actions", async () => {
    const memo = create(MemoSchema, {
      name: "memos/detail",
      creator: "users/alice",
      state: State.NORMAL,
      visibility: Visibility.PUBLIC,
      content: "# Overview\n\n## Details",
      tags: ["release/0.30"],
      location: create(LocationSchema, { placeholder: "Singapore" }),
      attachments: [
        create(AttachmentSchema, {
          name: "attachments/spec",
          filename: "release-notes.pdf",
          type: "application/pdf",
          size: 2048n,
        }),
      ],
    });
    const onShareImageOpen = vi.fn();

    render(
      <MemoryRouter>
        <MemoDetailSidebar memo={memo} onShareImageOpen={onShareImageOpen} />
      </MemoryRouter>,
    );

    expect(screen.getByText("common.visibility")).toBeInTheDocument();
    expect(screen.getByText("common.created-at")).toBeInTheDocument();
    expect(screen.getByText("common.author")).toBeInTheDocument();
    expect(screen.getByText("common.location")).toBeInTheDocument();
    expect(screen.getByText("common.tags")).toBeInTheDocument();
    expect(screen.getByText("common.attachments")).toBeInTheDocument();
    expect(screen.getByText("memo.outline")).toBeInTheDocument();
    expect(screen.getByText("release/0.30")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /release-notes\.pdf/ })).toBeInTheDocument();
    expect(screen.getByTestId("outline")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "common.pin" }));
    await waitFor(() =>
      expect(updateMemo).toHaveBeenCalledWith({ update: { name: "memos/detail", pinned: true }, updateMask: ["pinned"] }),
    );

    fireEvent.click(screen.getByRole("button", { name: "visibility-selector" }));
    await waitFor(() =>
      expect(updateMemo).toHaveBeenCalledWith({
        update: { name: "memos/detail", visibility: Visibility.PRIVATE },
        updateMask: ["visibility"],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "memo.share.open-image" }));
    expect(onShareImageOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "memo.share.open-panel" }));
    expect(screen.getByTestId("share-panel")).toBeInTheDocument();
  });
});
