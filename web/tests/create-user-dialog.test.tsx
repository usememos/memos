import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CreateUserDialog from "@/components/CreateUserDialog";
import { User_Role, UserSchema } from "@/types/proto/api/user_service_pb";

const state = vi.hoisted(() => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  managed: false,
}));

vi.mock("@/connect", () => ({
  userServiceClient: { createUser: state.createUser, updateUser: state.updateUser },
}));

vi.mock("@/hooks/useConfigurationQueries", () => ({
  useManagedResource: () => undefined,
  isFieldManaged: (_resource: unknown, field: string) => state.managed && field === "role",
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("CreateUserDialog", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  beforeEach(() => {
    state.managed = false;
    state.createUser.mockReset().mockResolvedValue(undefined);
    state.updateUser.mockReset().mockResolvedValue(undefined);
  });

  const user = create(UserSchema, { name: "users/alice", username: "alice", role: User_Role.USER });

  it("updates only the role after selecting an admin", async () => {
    render(<CreateUserDialog open onOpenChange={vi.fn()} user={user} />);

    fireEvent.click(screen.getByRole("combobox", { name: "common.role" }));
    const option = await screen.findByRole("option", { name: "setting.member.admin" });
    fireEvent.pointerDown(option, { pointerType: "mouse" });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));

    await waitFor(() =>
      expect(state.updateUser).toHaveBeenCalledWith({
        user: expect.objectContaining({ name: "users/alice", role: User_Role.ADMIN }),
        updateMask: expect.objectContaining({ paths: ["role"] }),
      }),
    );
  });

  it("does not send a password typed into a cancelled edit", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<CreateUserDialog open onOpenChange={onOpenChange} user={user} />);

    fireEvent.change(screen.getByPlaceholderText("common.password"), { target: { value: "typed-then-cancelled" } });
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    rerender(<CreateUserDialog open={false} onOpenChange={onOpenChange} user={user} />);

    // Reopen the same member to change only the role.
    rerender(<CreateUserDialog open onOpenChange={onOpenChange} user={user} />);
    expect(screen.getByPlaceholderText("common.password")).toHaveValue("");
    fireEvent.click(screen.getByRole("combobox", { name: "common.role" }));
    const option = await screen.findByRole("option", { name: "setting.member.admin" });
    fireEvent.pointerDown(option, { pointerType: "mouse" });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));

    await waitFor(() => expect(state.updateUser).toHaveBeenCalledTimes(1));
    expect(state.updateUser.mock.calls[0][0].updateMask.paths).toEqual(["role"]);
  });

  it("starts empty when reopened after creating a user", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<CreateUserDialog open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByPlaceholderText("common.username"), { target: { value: "bob" } });
    fireEvent.change(screen.getByPlaceholderText("common.password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    rerender(<CreateUserDialog open={false} onOpenChange={onOpenChange} />);

    rerender(<CreateUserDialog open onOpenChange={onOpenChange} />);
    expect(screen.getByPlaceholderText("common.username")).toHaveValue("");
    expect(screen.getByPlaceholderText("common.password")).toHaveValue("");
  });

  it("clears validation errors when the create dialog reopens", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<CreateUserDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));
    expect(screen.getByText("setting.member.username-password-required")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    rerender(<CreateUserDialog open={false} onOpenChange={onOpenChange} />);
    rerender(<CreateUserDialog open onOpenChange={onOpenChange} />);
    expect(screen.queryByText("setting.member.username-password-required")).toBeNull();
    expect(screen.getByPlaceholderText("common.username")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("keeps a role managed by configuration disabled", () => {
    state.managed = true;
    render(<CreateUserDialog open onOpenChange={vi.fn()} user={user} />);

    expect(screen.getByRole("combobox", { name: "common.role" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "common.role" })).toHaveTextContent("setting.member.user");
  });
});
