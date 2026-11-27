import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InviteSpaceMemberDialog from "@/components/Settings/InviteSpaceMemberDialog";
import { State } from "@/types/proto/api/common_pb";
import { type Space, SpaceMember_Role } from "@/types/proto/api/space_service_pb";
import { type User, User_Role } from "@/types/proto/api/user_service_pb";

const state = vi.hoisted(() => ({
  candidate: undefined as User | undefined,
  requestedUsernames: [] as string[][],
  mutateAsync: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({ toast: { add: vi.fn(), close: vi.fn() }, showErrorToast: vi.fn() }));

vi.mock("@/hooks/useSpaceQueries", () => ({
  useCreateSpaceInvitation: () => ({ isPending: false, mutateAsync: state.mutateAsync }),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useUsersByUsernames: (usernames: string[]) => {
    state.requestedUsernames.push(usernames);
    const username = usernames[0];
    return {
      data: new Map(username && state.candidate?.username === username ? [[username, state.candidate]] : []),
      isFetching: false,
      isSuccess: true,
    };
  },
}));

vi.mock("@/components/UserAvatar", () => ({
  default: () => <span aria-hidden />,
}));

vi.mock("@usememos/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@usememos/ui")>()),
  Dialog: {
    Root: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? children : null),
    Popup: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
    Description: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    Footer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  },
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => {
    const copy: Record<string, string> = {
      "setting.spaces.active-user": "Active Memos user",
      "setting.spaces.invite-description": "Invite an existing Memos user. They must accept before joining the space.",
      "setting.spaces.memos-user": "Memos user",
      "setting.spaces.search-user-placeholder": "Search by exact username",
      "setting.spaces.send-invitation": "Send invitation",
    };
    return copy[key] ?? key;
  },
}));

const productSpace: Space = {
  $typeName: "memos.api.Space",
  name: "spaces/product",
  title: "Product",
  description: "Product decisions",
  currentUserRole: SpaceMember_Role.ADMIN,
  memberCount: 1,
};

const alice: User = {
  $typeName: "memos.api.User",
  name: "users/alice",
  username: "alice",
  displayName: "Alice",
  email: "",
  avatarUrl: "",
  description: "",
  password: "",
  role: User_Role.USER,
  state: State.NORMAL,
};

describe("InviteSpaceMemberDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.candidate = alice;
    state.requestedUsernames = [];
    state.mutateAsync.mockReset().mockResolvedValue(undefined);
    state.onOpenChange.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("invites an exact active Memos user with the chosen role and explains consent", async () => {
    render(
      <InviteSpaceMemberDialog
        open
        onOpenChange={state.onOpenChange}
        space={productSpace}
        viewerName="users/steven"
        memberUserNames={new Set(["users/steven"])}
        pendingInviteeNames={new Set()}
      />,
    );

    expect(screen.getByText("Invite an existing Memos user. They must accept before joining the space.")).toBeInTheDocument();
    expect(screen.getByText("product")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Memos user"), { target: { value: "  @alice  " } });
    act(() => vi.advanceTimersByTime(300));

    expect(state.requestedUsernames.at(-1)).toEqual(["alice"]);
    expect(screen.getByText(/@alice · Active Memos user/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));
    fireEvent.click(screen.getByRole("radio", { name: /setting\.spaces\.space-admin/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    await act(async () => Promise.resolve());

    expect(state.mutateAsync).toHaveBeenCalledWith({
      parent: "spaces/product",
      spaceInvitation: expect.objectContaining({
        invitee: "users/alice",
        role: SpaceMember_Role.ADMIN,
      }),
    });
    expect(state.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("wraps a maximum-length Space UID in the dialog context", () => {
    const uid = "a".repeat(36);

    render(
      <InviteSpaceMemberDialog
        open
        onOpenChange={state.onOpenChange}
        space={{ ...productSpace, name: `spaces/${uid}` }}
        viewerName="users/steven"
        memberUserNames={new Set(["users/steven"])}
        pendingInviteeNames={new Set()}
      />,
    );

    expect(screen.getByText(uid)).toHaveClass("break-all");
  });
});
