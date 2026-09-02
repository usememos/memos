import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoDetailSidebar from "@/components/MemoDetailSidebar/MemoDetailSidebar";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import {
  LocationSchema,
  MemoRelation_MemoSchema,
  MemoRelation_Type,
  MemoRelationSchema,
  MemoSchema,
  Visibility,
} from "@/types/proto/api/v1/memo_service_pb";

const copyToClipboard = vi.hoisted(() => vi.fn());
const currentUserState = vi.hoisted(() => ({ value: { name: "users/alice" } as { name: string } | undefined }));
const clearSelectedSpace = vi.hoisted(() => vi.fn());

vi.mock("copy-to-clipboard", () => ({ default: copyToClipboard }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn() } }));
vi.mock("@/components/MemoDetailSidebar/MemoOutline", () => ({
  default: ({ headings }: { headings: unknown[] }) => <div data-testid="outline">{headings.length}</div>,
}));
vi.mock("@/components/MemoDetailSidebar/MemoSharePanel", () => ({ default: () => <div data-testid="share-panel" /> }));
vi.mock("@/components/MemoMetadata/Relation/useResolvedRelationMemos", () => ({ useResolvedRelationMemos: () => ({}) }));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ profile: { instanceUrl: "https://memos.example/" } }) }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ clearSelectedSpace }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => currentUserState.value }));
vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, values?: { source?: string }) => (values?.source ? `${key}:${values.source}` : key),
}));

const renderSidebar = (sidebar: React.ReactNode, route = "/memos/detail") =>
  render(<MemoryRouter initialEntries={[route]}>{sidebar}</MemoryRouter>);

const createIncomingReference = (memoName: string, sourceName = "memos/incoming", snippet = "Incoming backlink") =>
  create(MemoRelationSchema, {
    type: MemoRelation_Type.REFERENCE,
    memo: create(MemoRelation_MemoSchema, { name: sourceName, snippet }),
    relatedMemo: create(MemoRelation_MemoSchema, { name: memoName }),
  });

describe("MemoDetailSidebar", () => {
  beforeEach(() => {
    copyToClipboard.mockReset();
    clearSelectedSpace.mockReset();
    currentUserState.value = { name: "users/alice" };
  });

  it("organizes source, in-page navigation, connections, and frequent actions without repeating metadata", async () => {
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
      relations: [
        create(MemoRelationSchema, {
          type: MemoRelation_Type.REFERENCE,
          memo: create(MemoRelation_MemoSchema, { name: "memos/detail" }),
          relatedMemo: create(MemoRelation_MemoSchema, { name: "memos/outgoing", snippet: "Outgoing reference" }),
        }),
        createIncomingReference("memos/detail"),
      ],
    });
    const parentMemo = create(MemoSchema, { name: "memos/parent", content: "Parent context" });
    const onEdit = vi.fn();
    const onCommentsOpen = vi.fn();
    const onCommentCreate = vi.fn();
    const onShareImageOpen = vi.fn();

    renderSidebar(
      <MemoDetailSidebar
        memo={memo}
        parentMemo={parentMemo}
        parentPage="/explore?filter=tagSearch%3Awork"
        parentScope="preserve"
        hasExplicitOrigin
        commentCount={3}
        onEdit={onEdit}
        onCommentsOpen={onCommentsOpen}
        onCommentCreate={onCommentCreate}
        onShareImageOpen={onShareImageOpen}
      />,
    );

    expect(screen.getByRole("link", { name: "memo.back-to:common.explore" })).toHaveAttribute("href", "/explore?filter=tagSearch%3Awork");
    expect(screen.getByText("memo.on-this-memo")).toBeInTheDocument();
    expect(screen.getByTestId("outline")).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: /memo.comment.self/ })).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: /memo.comment.self/ })).toHaveAttribute("href", "#memo-comments");
    expect(screen.getByText("memo.connections")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "memo.parent-memo: Parent context" })).toHaveAttribute("href", "/memos/parent");
    expect(screen.getByRole("link", { name: "common.referenced-by: Incoming backlink" })).toHaveAttribute("href", "/memos/incoming");
    expect(screen.queryByText("Outgoing reference")).not.toBeInTheDocument();
    expect(screen.getByText("common.actions")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /memo.comment.self/ }));
    expect(onCommentsOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "memo.comment.write-a-comment" }));
    expect(onCommentCreate).toHaveBeenCalledTimes(1);

    expect(screen.queryByRole("button", { name: "common.pin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.unpin" })).not.toBeInTheDocument();
    expect(screen.queryByText("common.visibility")).not.toBeInTheDocument();
    expect(screen.queryByText("common.created-at")).not.toBeInTheDocument();
    expect(screen.queryByText("common.location")).not.toBeInTheDocument();
    expect(screen.queryByText("common.attachments")).not.toBeInTheDocument();
    expect(screen.queryByText("release-notes.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("release/0.30")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.share" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "memo.copy-link" }));
    expect(copyToClipboard).toHaveBeenCalledWith("https://memos.example/memos/detail");

    fireEvent.click(screen.getByRole("button", { name: "common.share" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "memo.share.open-image" }));
    expect(onShareImageOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "common.share" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "memo.share.open-panel" }));
    expect(screen.getByTestId("share-panel")).toBeInTheDocument();
  });

  it("lets an authenticated visitor comment while reserving edit for the author", () => {
    currentUserState.value = { name: "users/bob" };
    const memo = create(MemoSchema, {
      name: "memos/public",
      creator: "users/alice",
      state: State.NORMAL,
      visibility: Visibility.PUBLIC,
      content: "Body",
      relations: [createIncomingReference("memos/public")],
    });

    renderSidebar(
      <MemoDetailSidebar memo={memo} parentPage="/explore" parentScope="all" commentCount={1} onEdit={vi.fn()} onCommentCreate={vi.fn()} />,
    );

    expect(screen.queryByRole("button", { name: "common.edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "memo.comment.write-a-comment" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.referenced-by: Incoming backlink" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "memo.go-to:common.explore" }));
    expect(clearSelectedSpace).toHaveBeenCalledOnce();
  });

  it("keeps a simple memo useful without rendering empty navigation or connections", () => {
    const memo = create(MemoSchema, {
      name: "memos/simple",
      creator: "users/alice",
      state: State.NORMAL,
      content: "Body",
    });

    renderSidebar(
      <MemoDetailSidebar memo={memo} parentPage="/" parentScope="all" commentCount={0} onEdit={vi.fn()} onCommentCreate={vi.fn()} />,
    );

    expect(screen.getByRole("link", { name: "memo.go-to:common.home" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("memo.on-this-memo")).not.toBeInTheDocument();
    expect(screen.queryByText("memo.connections")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "memo.comment.write-a-comment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.share" })).toBeInTheDocument();
  });

  it.each([
    ["an archived memo", State.ARCHIVED, Visibility.PUBLIC],
    ["a Space memo", State.NORMAL, Visibility.SPACE],
  ])("does not offer share-link management for %s", async (_label, state, visibility) => {
    const memo = create(MemoSchema, {
      name: "memos/restricted-share",
      creator: "users/alice",
      state,
      visibility,
      content: "Body",
    });

    renderSidebar(<MemoDetailSidebar memo={memo} parentPage="/" parentScope="all" commentCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "common.share" }));

    expect(await screen.findByRole("menuitem", { name: "memo.copy-link" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "memo.share.open-panel" })).not.toBeInTheDocument();
  });

  it("keeps archived memo navigation and comments readable without offering write actions", () => {
    const memo = create(MemoSchema, {
      name: "memos/archived",
      creator: "users/alice",
      state: State.ARCHIVED,
      content: "Archived body",
    });

    renderSidebar(
      <MemoDetailSidebar
        memo={memo}
        parentPage="/archived"
        parentScope="preserve"
        commentCount={2}
        onEdit={vi.fn()}
        onCommentCreate={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "memo.go-to:common.archived" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /memo.comment.self/ })).toHaveTextContent("2");
    expect(screen.queryByRole("button", { name: "common.edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "memo.comment.write-a-comment" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.share" })).toBeInTheDocument();
  });

  it("keeps shared memos private to their token context and copies the usable share URL", async () => {
    const memo = create(MemoSchema, {
      name: "memos/shared",
      creator: "users/alice",
      state: State.NORMAL,
      visibility: Visibility.PUBLIC,
      content: "# Overview\n\nBody\n\n## Details\n\nMore",
      parent: "memos/parent",
      relations: [createIncomingReference("memos/shared", "memos/private", "Private backlink")],
    });
    const parentMemo = create(MemoSchema, { name: "memos/parent", content: "Private parent" });

    renderSidebar(
      <MemoDetailSidebar
        memo={memo}
        parentMemo={parentMemo}
        parentPage="/explore"
        parentScope="all"
        hasExplicitOrigin
        commentCount={4}
        forceReadonly
        onEdit={vi.fn()}
        onCommentCreate={vi.fn()}
      />,
      "/memos/shares/share-token",
    );

    expect(screen.queryByRole("link", { name: /memo.back-to/ })).not.toBeInTheDocument();
    expect(screen.getByText("memo.on-this-memo")).toBeInTheDocument();
    expect(screen.getByTestId("outline")).toHaveTextContent("2");
    expect(screen.queryByRole("link", { name: /memo.comment.self/ })).not.toBeInTheDocument();
    expect(screen.queryByText("memo.connections")).not.toBeInTheDocument();
    expect(screen.queryByText("Private parent")).not.toBeInTheDocument();
    expect(screen.queryByText("Private backlink")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "memo.comment.write-a-comment" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.share" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "memo.copy-link" }));
    expect(copyToClipboard).toHaveBeenCalledWith("https://memos.example/memos/shares/share-token");
    expect(screen.queryByRole("menuitem", { name: "memo.share.open-panel" })).not.toBeInTheDocument();
  });
});
