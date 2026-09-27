import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoPanelList } from "@/components/MemoPanel/MemoPanelList";
import type { MemoViewProps } from "@/components/MemoView/types";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const mocks = vi.hoisted(() => ({
  creatorUsername: undefined as string | undefined,
  cards: [] as MemoViewProps[],
  userNames: [] as string[],
}));
vi.mock("@/components/MemoView", () => ({
  default: (props: MemoViewProps) => {
    mocks.cards.push(props);
    return <p>{props.memo.name}</p>;
  },
}));
vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  MentionResolutionProvider: ({ userNames, children }: { userNames: string[]; children: ReactNode }) => {
    mocks.userNames = userNames;
    return children;
  },
}));
vi.mock("@/components/MemoEditor", () => ({ default: () => <div data-testid="editor" /> }));
vi.mock("@/contexts/NewMemoContext", () => ({ NewMemoProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isUserSettingsInitialized: true }) }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ creatorUsername: mocks.creatorUsername }) }));
vi.mock("@/contexts/ViewContext", () => ({ useView: () => ({ compactMode: false }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const memos = [
  create(MemoSchema, { name: "memos/a", creator: "users/alice", pinned: true, reactions: [{ creator: "users/carol" }] }),
  create(MemoSchema, { name: "memos/b", creator: "users/bob" }),
];

beforeEach(() => {
  mocks.cards = [];
  mocks.userNames = [];
});

describe("memo panel list", () => {
  it("attributes a mixed-author selection and resolves every author in one batch", () => {
    mocks.creatorUsername = undefined;
    render(<MemoPanelList memos={memos} selectionKey="2026-09-24" />);
    expect(mocks.cards.map((card) => card.showCreator)).toEqual([true, true]);
    expect(mocks.userNames).toEqual(["users/alice", "users/carol", "users/bob"]);
  });

  it("does not honor other people's pins in a mixed-author selection", () => {
    mocks.creatorUsername = undefined;
    render(<MemoPanelList memos={memos} selectionKey="2026-09-24" />);
    expect(mocks.cards.map((card) => card.showPinned)).toEqual([false, false]);
  });

  it("shows pins but not creators in a single creator's scope", () => {
    mocks.creatorUsername = "alice";
    render(<MemoPanelList memos={memos} selectionKey="2026-09-24" />);
    expect(mocks.cards.map((card) => [card.showCreator, card.showPinned])).toEqual([
      [false, true],
      [false, true],
    ]);
    expect(mocks.userNames).toEqual(["users/carol"]);
  });

  it("says the selection is empty instead of showing a blank panel", () => {
    render(<MemoPanelList memos={[]} selectionKey="2026-09-13" emptyText="No memos on this day" />);
    expect(screen.getByText("No memos on this day")).toBeInTheDocument();
  });
});
