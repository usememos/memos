import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InviteSpaceMemberDialog from "@/components/Settings/InviteSpaceMemberDialog";
import { State } from "@/types/proto/api/v1/common_pb";
import { type Space, SpaceMember_Role } from "@/types/proto/api/v1/space_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";

const state = vi.hoisted(() => ({
  candidate: undefined as User | undefined,
  requestedUsernames: [] as string[][],
  mutateAsync: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

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

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? children : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
    <select aria-label="role-select" value={value} onChange={(event) => onValueChange(event.target.value)}>
      <option value="2">Space user</option>
      <option value="1">Space admin</option>
    </select>
  ),
  SelectContent: () => null,
  SelectItem: () => null,
  SelectTrigger: () => null,
  SelectValue: () => null,
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
  $typeName: "memos.api.v1.Space",
  name: "spaces/product",
  title: "Product",
  description: "Product decisions",
  currentUserRole: SpaceMember_Role.ADMIN,
  memberCount: 1,
};

const alice: User = {
  $typeName: "memos.api.v1.User",
  name: "users/alice",
  username: "alice",
  displayName: "Alice",
  email: "",
  avatarUrl: "",
  description: "",
  password: "",
  role: 3,
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
    fireEvent.change(screen.getByLabelText("role-select"), { target: { value: String(SpaceMember_Role.ADMIN) } });
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
