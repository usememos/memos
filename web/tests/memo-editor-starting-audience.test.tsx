import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoEditor, preloadMemoEditing } from "@/components/MemoEditor";
import { cacheService } from "@/components/MemoEditor/edit/services";
import { memoKeys } from "@/hooks/useMemoQueries";
import { type Memo, MemoSchema, Visibility } from "@/types/proto/api/memo_service_pb";

vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  useTranslate: () => (key: string) => key,
}));
vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: () => ({ data: {} }),
  useUsersByUsernames: () => ({ data: undefined }),
  useUpdateUserEditorSetting: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/1" }) }));
vi.mock("@/contexts/AuthContext", () => ({
  // The author's own default is the narrowest audience, so anything wider below comes from where the memo is written.
  useAuth: () => ({ userGeneralSetting: { memoVisibility: "PRIVATE" }, userEditorSetting: undefined, setUserEditorSetting: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({ toast: { add: vi.fn(), close: vi.fn() }, showErrorToast: vi.fn() }));
vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ profile: {} }),
}));
vi.mock("@/contexts/NewMemoContext", () => ({ useNewMemo: () => ({ markNewMemo: vi.fn() }) }));
vi.mock("@/hooks/useSpaceQueries", () => ({ useSpaces: () => ({ data: [] }) }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ selectedSpaceName: undefined }) }));
vi.mock("@/connect", () => ({ attachmentServiceClient: {}, memoServiceClient: {}, userServiceClient: {} }));
vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

beforeAll(async () => {
  // The editing session loads lazily; loaded once, it renders without suspending.
  await preloadMemoEditing();
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => cacheService.clearAll());

const PARENT = "memos/parent";

/** Mounts a composer; a parent, when given, is held by a query the way the detail page holds it. */
const mount = (draft: { scope?: string; space?: string; parent?: string }, parent?: Partial<Memo>) => {
  const client = new QueryClient();
  if (parent) client.setQueryData(memoKeys.detail(PARENT), create(MemoSchema, { name: PARENT, ...parent } as Parameters<typeof create>[1]));
  render(
    <QueryClientProvider client={client}>
      <MemoEditor draft={draft} />
    </QueryClientProvider>,
  );
};

const audienceOptions = () => {
  fireEvent.click(screen.getByRole("button", { name: /memo\.audience\./ }));
  return screen.getAllByRole("menuitemradio").map((item) => item.textContent);
};

describe("the audience a composer starts with", () => {
  it("is the author's default for a memo outside a Space", () => {
    mount({ scope: "home" });
    expect(screen.getByRole("button", { name: "memo.audience.private" })).toBeInTheDocument();
  });

  it("is the Space's members for a memo composed into a Space", () => {
    mount({ scope: "home", space: "spaces/work" });
    expect(screen.getByRole("button", { name: "memo.audience.space" })).toBeInTheDocument();
  });

  it("is the parent's audience for a comment", () => {
    mount({ parent: PARENT }, { visibility: Visibility.PUBLIC });
    expect(screen.getByRole("button", { name: "memo.audience.public" })).toBeInTheDocument();
    expect(audienceOptions()).not.toContain("memo.audience.space");
  });

  it("shares a comment on a Space memo with the Space's members, and offers that audience", () => {
    mount({ parent: PARENT }, { visibility: Visibility.SPACE, space: "spaces/work" });
    expect(screen.getByRole("button", { name: "memo.audience.space" })).toBeInTheDocument();
    expect(audienceOptions()).toContain("memo.audience.space");
  });

  it("falls back to the author's default while no query holds the parent", () => {
    mount({ parent: PARENT });
    expect(screen.getByRole("button", { name: "memo.audience.private" })).toBeInTheDocument();
  });
});
