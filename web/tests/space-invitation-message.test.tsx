import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SpaceInvitationMessage from "@/components/Inbox/SpaceInvitationMessage";
import { type Space, SpaceMember_Role, SpaceSchema } from "@/types/proto/api/v1/space_service_pb";
import {
  type UserNotification,
  UserNotification_SpaceInvitationPayload_State,
  UserNotification_Status,
  UserNotification_Type,
  UserNotificationSchema,
  UserSchema,
} from "@/types/proto/api/v1/user_service_pb";

const state = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  selectSpace: vi.fn(),
  updateUserNotification: vi.fn(),
  deleteUserNotification: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: { error: state.toastError, success: state.toastSuccess },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/alice" }),
}));

vi.mock("@/hooks/useSpaceQueries", () => ({
  useAcceptSpaceInvitation: () => ({ isPending: false, mutateAsync: state.acceptInvitation }),
  useDeclineSpaceInvitation: () => ({ isPending: false, mutateAsync: state.declineInvitation }),
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({ selectSpace: state.selectSpace }),
}));

vi.mock("@/connect", () => ({
  userServiceClient: {
    updateUserNotification: state.updateUserNotification,
    deleteUserNotification: state.deleteUserNotification,
  },
}));

vi.mock("@/components/SpaceMark", () => ({
  default: () => <span aria-hidden>space-mark</span>,
}));

vi.mock("@/components/UserAvatar", () => ({
  default: () => <span aria-hidden data-testid="user-avatar" />,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, params?: Record<string, string>) => (params ? `${key}:${Object.values(params).join(",")}` : key),
}));

const space: Space = create(SpaceSchema, { name: "spaces/design", title: "Design team", description: "Product design notes" });

const createNotification = (overrides: {
  state: UserNotification_SpaceInvitationPayload_State;
  status?: UserNotification_Status;
  role?: SpaceMember_Role;
}): UserNotification =>
  create(UserNotificationSchema, {
    name: "users/alice/notifications/7",
    sender: "users/bob",
    senderUser: create(UserSchema, { name: "users/bob", username: "bob", displayName: "Bob" }),
    status: overrides.status ?? UserNotification_Status.UNREAD,
    type: UserNotification_Type.SPACE_INVITATION,
    payload: {
      case: "spaceInvitation",
      value: {
        spaceInvitation: "spaces/design/invitations/alice",
        space,
        role: overrides.role ?? SpaceMember_Role.USER,
        state: overrides.state,
      },
    },
  });

describe("SpaceInvitationMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.acceptInvitation.mockResolvedValue({ name: "spaces/design/members/alice" });
    state.declineInvitation.mockResolvedValue("spaces/design/invitations/alice");
  });

  it("offers accept and decline while the invitation is pending", async () => {
    render(<SpaceInvitationMessage notification={createNotification({ state: UserNotification_SpaceInvitationPayload_State.PENDING })} />);

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("inbox.space-invitation")).toBeInTheDocument();
    expect(screen.getByText("Design team")).toBeInTheDocument();
    expect(screen.getByText("design")).toBeInTheDocument();
    expect(screen.getByText("Product design notes")).toBeInTheDocument();
    expect(screen.getByText("setting.spaces.space-user")).toBeInTheDocument();
    expect(screen.queryByText("inbox.space-invitation-open")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "setting.spaces.accept" }));
    await waitFor(() => expect(state.acceptInvitation).toHaveBeenCalledWith({ name: "spaces/design/invitations/alice" }));
    await waitFor(() => expect(state.toastSuccess).toHaveBeenCalledWith("setting.spaces.accept-success:Design team (design)"));
  });

  it("declines the invitation from the inbox", async () => {
    render(<SpaceInvitationMessage notification={createNotification({ state: UserNotification_SpaceInvitationPayload_State.PENDING })} />);

    fireEvent.click(screen.getByRole("button", { name: "setting.spaces.decline" }));
    await waitFor(() => expect(state.declineInvitation).toHaveBeenCalledWith({ name: "spaces/design/invitations/alice" }));
    expect(state.acceptInvitation).not.toHaveBeenCalled();
    await waitFor(() => expect(state.toastSuccess).toHaveBeenCalledWith("setting.spaces.decline-success"));
  });

  it("reports a failed accept without pretending it succeeded", async () => {
    state.acceptInvitation.mockRejectedValueOnce(new Error("space invitation not found"));
    render(<SpaceInvitationMessage notification={createNotification({ state: UserNotification_SpaceInvitationPayload_State.PENDING })} />);

    fireEvent.click(screen.getByRole("button", { name: "setting.spaces.accept" }));
    await waitFor(() => expect(state.toastError).toHaveBeenCalled());
    expect(state.toastSuccess).not.toHaveBeenCalled();
  });

  it("shows the accepted state with a shortcut into the space", () => {
    render(
      <SpaceInvitationMessage
        notification={createNotification({
          state: UserNotification_SpaceInvitationPayload_State.ACCEPTED,
          status: UserNotification_Status.ARCHIVED,
          role: SpaceMember_Role.ADMIN,
        })}
      />,
    );

    expect(screen.getByText("inbox.space-invitation-accepted")).toBeInTheDocument();
    expect(screen.getByText("setting.spaces.space-admin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "setting.spaces.accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "setting.spaces.decline" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "inbox.space-invitation-open" }));
    expect(state.selectSpace).toHaveBeenCalledWith(space);
  });

  it("falls back to the error row when the payload is missing", () => {
    const notification = create(UserNotificationSchema, {
      name: "users/alice/notifications/8",
      type: UserNotification_Type.SPACE_INVITATION,
      status: UserNotification_Status.UNREAD,
    });
    render(<SpaceInvitationMessage notification={notification} />);

    expect(screen.getByText("inbox.failed-to-load")).toBeInTheDocument();
    expect(screen.queryByText("setting.spaces.accept")).not.toBeInTheDocument();
  });
});
