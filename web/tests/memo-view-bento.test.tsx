import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import MemoView from "@/components/MemoView";
import { MemoRelation_Type, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({ useResolvedUser: () => undefined }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userTagsSetting: undefined }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/me" }) }));
vi.mock("@/hooks/useNavigateTo", () => ({ default: () => vi.fn() }));
vi.mock("@/components/MemoView/hooks", () => ({
  useImagePreview: () => ({ previewState: { items: [], open: false, index: 0 }, openPreview: vi.fn(), setPreviewOpen: vi.fn() }),
}));
vi.mock("@/components/MemoView/components", () => ({
  MemoHeader: () => <div data-testid="header" />,
  MemoBody: () => <div data-testid="body" />,
  MemoCommentListView: () => <div data-testid="comments" />,
}));

const memo = create(MemoSchema, {
  name: "memos/bookmark",
  creator: "users/me",
  relations: [{ type: MemoRelation_Type.COMMENT, relatedMemo: { name: "memos/bookmark" } }],
});

describe("MemoView bento variant", () => {
  it("keeps comment previews out of the fixed-height tile", () => {
    render(
      <MemoryRouter>
        <MemoView memo={memo} variant="bento" />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("comments")).not.toBeInTheDocument();
    expect(screen.queryByTestId("body")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bookmark/ })).toBeInTheDocument();
  });
});
