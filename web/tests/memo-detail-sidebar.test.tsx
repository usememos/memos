import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const updateMemo = vi.hoisted(() => vi.fn());

vi.mock("copy-to-clipboard", () => ({ default: copyToClipboard }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn() } }));
vi.mock("@/components/MemoDetailSidebar/MemoOutline", () => ({
  default: ({ headings }: { headings: unknown[] }) => <div data-testid="outline">{headings.length}</div>,
}));
vi.mock("@/components/MemoDetailSidebar/MemoSharePanel", () => ({ default: () => <div data-testid="share-panel" /> }));
vi.mock("@/components/MemoMetadata/Relation/useResolvedRelationMemos", () => ({ useResolvedRelationMemos: () => ({}) }));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ profile: { instanceUrl: "https://memos.example" } }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/alice" }) }));
vi.mock("@/hooks/useMemoQueries", () => ({ useUpdateMemo: () => ({ mutateAsync: updateMemo }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("MemoDetailSidebar", () => {
  beforeEach(() => {
    copyToClipboard.mockReset();
    updateMemo.mockReset();
    updateMemo.mockResolvedValue(undefined);
  });

  it("renders concise actions, outline, and backlinks without repeating body metadata", async () => {
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
        create(MemoRelationSchema, {
          type: MemoRelation_Type.REFERENCE,
          memo: create(MemoRelation_MemoSchema, { name: "memos/incoming", snippet: "Incoming backlink" }),
          relatedMemo: create(MemoRelation_MemoSchema, { name: "memos/detail" }),
        }),
      ],
    });
    const onShareImageOpen = vi.fn();

    render(
      <MemoryRouter>
        <MemoDetailSidebar memo={memo} onShareImageOpen={onShareImageOpen} />
      </MemoryRouter>,
    );

    expect(screen.getByText("common.actions")).toBeInTheDocument();
    expect(screen.getByText("memo.outline")).toBeInTheDocument();
    expect(screen.getByText("common.referenced-by")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Incoming backlink" })).toBeInTheDocument();
    expect(screen.queryByText("Outgoing reference")).not.toBeInTheDocument();
    expect(screen.queryByText("common.visibility")).not.toBeInTheDocument();
    expect(screen.queryByText("common.created-at")).not.toBeInTheDocument();
    expect(screen.queryByText("common.location")).not.toBeInTheDocument();
    expect(screen.queryByText("common.attachments")).not.toBeInTheDocument();
    expect(screen.queryByText("release-notes.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("release/0.30")).not.toBeInTheDocument();
    expect(screen.getByTestId("outline")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "common.pin" }));
    await waitFor(() =>
      expect(updateMemo).toHaveBeenCalledWith({ update: { name: "memos/detail", pinned: true }, updateMask: ["pinned"] }),
    );

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

  it("keeps a readonly simple memo useful with only the share action", () => {
    const memo = create(MemoSchema, {
      name: "memos/readonly",
      creator: "users/alice",
      state: State.NORMAL,
      visibility: Visibility.PUBLIC,
      content: "# Overview\n\nBody",
      relations: [
        create(MemoRelationSchema, {
          type: MemoRelation_Type.REFERENCE,
          memo: create(MemoRelation_MemoSchema, { name: "memos/incoming", snippet: "Private backlink" }),
          relatedMemo: create(MemoRelation_MemoSchema, { name: "memos/readonly" }),
        }),
      ],
    });

    render(
      <MemoryRouter>
        <MemoDetailSidebar memo={memo} forceReadonly />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "common.share" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.pin" })).not.toBeInTheDocument();
    expect(screen.queryByText("memo.outline")).not.toBeInTheDocument();
    expect(screen.queryByText("common.referenced-by")).not.toBeInTheDocument();
    expect(screen.queryByText("Private backlink")).not.toBeInTheDocument();
  });

  it("keeps the outline available for readonly memos with multiple headings", () => {
    const memo = create(MemoSchema, {
      name: "memos/readonly-outline",
      creator: "users/alice",
      state: State.NORMAL,
      visibility: Visibility.PUBLIC,
      content: "# Overview\n\nBody\n\n## Details\n\nMore",
    });

    render(
      <MemoryRouter>
        <MemoDetailSidebar memo={memo} forceReadonly />
      </MemoryRouter>,
    );

    expect(screen.getByText("memo.outline")).toBeInTheDocument();
    expect(screen.getByTestId("outline")).toHaveTextContent("2");
  });
});
