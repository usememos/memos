import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CreateUserDialog from "@/components/CreateUserDialog";
import { User_Role, UserSchema } from "@/types/proto/api/user_service_pb";

const state = vi.hoisted(() => ({
  updateUser: vi.fn(),
  managed: false,
}));

vi.mock("@/connect", () => ({
  userServiceClient: { updateUser: state.updateUser },
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

  it("keeps a role managed by configuration disabled", () => {
    state.managed = true;
    render(<CreateUserDialog open onOpenChange={vi.fn()} user={user} />);

    expect(screen.getByRole("combobox", { name: "common.role" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "common.role" })).toHaveTextContent("setting.member.user");
  });
});
