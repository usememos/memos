import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UpdateAccountDialog from "@/components/UpdateAccountDialog";
import { UserSchema } from "@/types/proto/api/user_service_pb";

const state = vi.hoisted(() => ({
  updateUser: vi.fn(),
  setCurrentUser: vi.fn(),
}));

const currentUser = create(UserSchema, {
  name: "users/alice",
  username: "alice",
  displayName: "Alice",
  email: "alice@example.com",
  description: "",
});

vi.mock("@/hooks/useCurrentUser", () => ({ default: () => currentUser }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ setCurrentUser: state.setCurrentUser }),
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ generalSetting: { disallowChangeUsername: false, disallowChangeNickname: false } }),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useUpdateUser: () => ({ mutateAsync: state.updateUser }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("UpdateAccountDialog", () => {
  beforeEach(() => {
    state.updateUser.mockReset().mockImplementation(async ({ user }) => user);
    state.setCurrentUser.mockReset();
  });

  it("does not save a cancelled edit with a later change", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<UpdateAccountDialog open onOpenChange={onOpenChange} />);

    fireEvent.change(document.getElementById("displayName")!, { target: { value: "Typo" } });
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    rerender(<UpdateAccountDialog open={false} onOpenChange={onOpenChange} />);

    // Reopen to change only the description.
    rerender(<UpdateAccountDialog open onOpenChange={onOpenChange} />);
    expect(document.getElementById("displayName")).toHaveValue("Alice");
    fireEvent.change(document.getElementById("description")!, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(state.updateUser).toHaveBeenCalledTimes(1));
    expect(state.updateUser.mock.calls[0][0].updateMask).toEqual(["description"]);
  });
});
