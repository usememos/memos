import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SpacesSection from "@/components/Settings/SpacesSection";
import type { Space, SpaceInvitation, SpaceMember } from "@/types/proto/api/v1/space_service_pb";

const state = vi.hoisted(() => ({
  viewerName: "users/alice",
  viewerInstanceRole: 3,
  spaces: [] as Space[],
  receivedInvitations: [] as SpaceInvitation[],
  members: [] as SpaceMember[],
  managedInvitations: [] as SpaceInvitation[],
  usersByName: new Map(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  updateSpace: vi.fn(),
  deleteSpace: vi.fn(),
  updateMember: vi.fn(),
  deleteMember: vi.fn(),
  deleteInvitation: vi.fn(),
  selectAmbientSpace: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: state.viewerName, role: state.viewerInstanceRole }),
}));

vi.mock("@/hooks/useSpaceQueries", () => ({
  useSpaces: () => ({ data: state.spaces, isError: false, isLoading: false, isSuccess: true }),
  useUserSpaceInvitations: () => ({ data: state.receivedInvitations, isLoading: false }),
  useAcceptSpaceInvitation: () => ({ isPending: false, mutateAsync: state.acceptInvitation }),
  useDeclineSpaceInvitation: () => ({ isPending: false, mutateAsync: state.declineInvitation }),
  useSpaceMembers: () => ({ data: state.members, isError: false, isLoading: false }),
  useSpaceInvitations: () => ({ data: state.managedInvitations, isLoading: false }),
  useUpdateSpace: () => ({ isPending: false, mutateAsync: state.updateSpace }),
  useDeleteSpace: () => ({ isPending: false, mutateAsync: state.deleteSpace }),
  useUpdateSpaceMember: () => ({ isPending: false, mutateAsync: state.updateMember }),
  useDeleteSpaceMember: () => ({ isPending: false, mutateAsync: state.deleteMember }),
  useDeleteSpaceInvitation: () => ({ isPending: false, mutateAsync: state.deleteInvitation }),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useUsersByUsernames: () => ({ data: state.usersByName }),
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({ selectSpace: state.selectAmbientSpace }),
}));

vi.mock("@/components/SpaceMark", () => ({
  default: ({ space }: { space?: { title?: string } }) => <span aria-hidden>{space?.title?.slice(0, 1) ?? "S"}</span>,
}));

vi.mock("@/components/UserAvatar", () => ({
  default: () => <span aria-hidden data-testid="user-avatar" />,
}));

vi.mock("@/components/CreateSpaceDialog", () => ({
  default: ({ open, onCreated }: { open: boolean; onCreated?: (space: Space) => void }) =>
    open ? (
      <div role="dialog" aria-label="create-space-dialog">
        <button
          type="button"
          onClick={() => {
            const createdSpace: Space = {
              $typeName: "memos.api.v1.Space",
              name: "spaces/created",
              title: "Created",
              description: "",
              currentUserRole: 1,
              memberCount: 1,
            };
            state.spaces = [...state.spaces, createdSpace];
            onCreated?.(createdSpace);
          }}
        >
          complete-create
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/Settings/InviteSpaceMemberDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div role="dialog">invite-member-dialog</div> : null),
}));

vi.mock("@/components/ConfirmDialog", () => ({
  default: ({ open, confirmLabel, onConfirm }: { open: boolean; confirmLabel: string; onConfirm: () => void | Promise<void> }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={() => void onConfirm()}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const adminSpace: Space = {
  $typeName: "memos.api.v1.Space",
  name: "spaces/product",
  title: "Product",
  description: "Product decisions",
  currentUserRole: 1,
  memberCount: 2,
};

const userSpace: Space = {
  ...adminSpace,
  currentUserRole: 2,
};

const adminMember: SpaceMember = {
  $typeName: "memos.api.v1.SpaceMember",
  name: "spaces/product/members/alice",
  user: "users/alice",
  role: 1,
};

const ordinaryMember: SpaceMember = {
  $typeName: "memos.api.v1.SpaceMember",
  name: "spaces/product/members/bob",
  user: "users/bob",
  role: 2,
};

const receivedInvitation: SpaceInvitation = {
  $typeName: "memos.api.v1.SpaceInvitation",
  name: "spaces/research/invitations/alice",
  invitee: "users/alice",
  role: 2,
  space: {
    $typeName: "memos.api.v1.Space",
    name: "spaces/research",
    title: "Research",
    description: "Research notes",
    currentUserRole: 0,
    memberCount: 0,
  },
};

const pendingInvitation: SpaceInvitation = {
  $typeName: "memos.api.v1.SpaceInvitation",
  name: "spaces/product/invitations/carol",
  invitee: "users/carol",
  role: 2,
  space: adminSpace,
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>;
};

const renderSection = (entry = "/setting#spaces") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <SpacesSection />
      <LocationProbe />
    </MemoryRouter>,
  );

describe("SpacesSection", () => {
  beforeEach(() => {
    state.spaces = [];
    state.viewerInstanceRole = 3;
    state.receivedInvitations = [];
    state.members = [];
    state.managedInvitations = [];
    state.usersByName = new Map();
    state.acceptInvitation.mockReset().mockResolvedValue(undefined);
    state.declineInvitation.mockReset().mockResolvedValue(undefined);
    state.updateSpace.mockReset().mockResolvedValue(undefined);
    state.deleteSpace.mockReset().mockResolvedValue(undefined);
    state.updateMember.mockReset().mockResolvedValue(undefined);
    state.deleteMember.mockReset().mockResolvedValue(undefined);
    state.deleteInvitation.mockReset().mockResolvedValue(undefined);
    state.selectAmbientSpace.mockReset();
  });

  it("separates pending invitations from joined spaces and uses exact invitation resource names", async () => {
    state.spaces = [adminSpace];
    state.receivedInvitations = [receivedInvitation];

    renderSection();

    const invitationsSection = screen.getByRole("heading", { name: "setting.spaces.invitations" }).closest("section");
    const joinedSection = screen.getByRole("heading", { name: "setting.spaces.your-spaces" }).closest("section");
    expect(invitationsSection).not.toBeNull();
    expect(joinedSection).not.toBeNull();
    expect(within(invitationsSection!).getByText("Research")).toBeInTheDocument();
    expect(within(invitationsSection!).queryByText("Product")).not.toBeInTheDocument();
    expect(within(joinedSection!).getByText("Product")).toBeInTheDocument();
    expect(within(joinedSection!).queryByText("Research")).not.toBeInTheDocument();

    fireEvent.click(within(invitationsSection!).getByRole("button", { name: "setting.spaces.accept" }));
    await waitFor(() => expect(state.acceptInvitation).toHaveBeenCalledWith({ name: "spaces/research/invitations/alice" }));

    fireEvent.click(within(invitationsSection!).getByRole("button", { name: "setting.spaces.decline" }));
    await waitFor(() => expect(state.declineInvitation).toHaveBeenCalledWith({ name: "spaces/research/invitations/alice" }));
  });

  it("shows governance controls to Space admins and cancels the exact pending invitation", async () => {
    state.spaces = [adminSpace];
    state.members = [adminMember, ordinaryMember];
    state.managedInvitations = [pendingInvitation];

    renderSection("/setting?space=spaces%2Fproduct#spaces");

    expect(screen.getByLabelText("common.name")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "setting.spaces.save-changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "setting.spaces.delete-space" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /setting\.spaces\.members/ }));
    expect(screen.getByRole("button", { name: "setting.spaces.invite-member" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "setting.spaces.remove" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "setting.spaces.pending-invitations" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "setting.spaces.cancel-invitation" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "setting.spaces.cancel-invitation" }));
    await waitFor(() => expect(state.deleteInvitation).toHaveBeenCalledWith({ name: "spaces/product/invitations/carol" }));
  });

  it("keeps ordinary Space members read-only and hides governance controls", () => {
    // Instance administrators do not implicitly receive Space governance rights.
    state.viewerInstanceRole = 2;
    state.spaces = [userSpace];
    state.members = [{ ...ordinaryMember, name: "spaces/product/members/alice", user: "users/alice" }, adminMember];
    state.managedInvitations = [pendingInvitation];

    renderSection("/setting?space=spaces%2Fproduct#spaces");

    expect(screen.getByLabelText("common.name")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "setting.spaces.save-changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "setting.spaces.delete-space" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "setting.spaces.leave-space" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /setting\.spaces\.members/ }));
    expect(screen.queryByRole("button", { name: "setting.spaces.invite-member" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "setting.spaces.remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "setting.spaces.pending-invitations" })).not.toBeInTheDocument();
  });

  it("navigates to a newly created Space for management without switching ambient Space", async () => {
    renderSection();

    fireEvent.click(screen.getAllByRole("button", { name: "setting.spaces.create-space" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "complete-create" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/setting?space=spaces%2Fcreated#spaces"));
    expect(state.selectAmbientSpace).not.toHaveBeenCalled();
  });
});
