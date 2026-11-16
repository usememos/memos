import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UpdateAccountDialog from "@/components/UpdateAccountDialog";
import { UserSchema } from "@/types/proto/api/user_service_pb";

const state = vi.hoisted(() => ({
  updateUser: vi.fn(),
  setCurrentUser: vi.fn(),
  convertFileToBase64: vi.fn(),
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

vi.mock("@/lib/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/browser")>()),
  convertFileToBase64: state.convertFileToBase64,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("UpdateAccountDialog", () => {
  beforeEach(() => {
    state.updateUser.mockReset().mockImplementation(async ({ user }) => user);
    state.setCurrentUser.mockReset();
    state.convertFileToBase64.mockReset();
  });

  it("drops an avatar read that finishes after the dialog was cancelled and reopened", async () => {
    let finishRead: (dataUrl: string) => void = () => {};
    state.convertFileToBase64.mockReturnValue(new Promise<string>((resolve) => (finishRead = resolve)));
    const onOpenChange = vi.fn();
    const { rerender } = render(<UpdateAccountDialog open onOpenChange={onOpenChange} />);

    const avatarInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(avatarInput, { target: { files: [new File(["avatar"], "avatar.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    rerender(<UpdateAccountDialog open={false} onOpenChange={onOpenChange} />);
    rerender(<UpdateAccountDialog open onOpenChange={onOpenChange} />);

    // The read from the cancelled opening finishes only now.
    await act(async () => finishRead("data:image/png;base64,Y2FuY2VsbGVk"));

    fireEvent.change(document.getElementById("description")!, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(state.updateUser).toHaveBeenCalledTimes(1));
    expect(state.updateUser.mock.calls[0][0].updateMask).toEqual(["description"]);
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

  it.each(["username", "avatar"] as const)("clears %s validation when reopened", (field) => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<UpdateAccountDialog open onOpenChange={onOpenChange} />);
    const message = field === "username" ? "message.fill-all" : "setting.account.avatar-too-large";
    if (field === "username") {
      fireEvent.change(document.getElementById("username")!, { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    } else {
      const image = new File(["avatar"], "large.png", { type: "image/png" });
      Object.defineProperty(image, "size", { value: 3 * 1024 * 1024 });
      fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [image] } });
    }
    expect(screen.getByText(message)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    rerender(<UpdateAccountDialog open={false} onOpenChange={onOpenChange} />);
    rerender(<UpdateAccountDialog open onOpenChange={onOpenChange} />);
    expect(screen.queryByText(message)).toBeNull();
    expect(document.getElementById("username")).toHaveValue("alice");
  });

  it("clears a server email error when reopened", async () => {
    state.updateUser.mockRejectedValueOnce(new ConnectError("email is already in use", Code.AlreadyExists));
    const onOpenChange = vi.fn();
    const { rerender } = render(<UpdateAccountDialog open onOpenChange={onOpenChange} />);
    fireEvent.change(document.getElementById("email")!, { target: { value: "taken@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    expect(await screen.findByText("setting.account.email-in-use")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    rerender(<UpdateAccountDialog open={false} onOpenChange={onOpenChange} />);
    rerender(<UpdateAccountDialog open onOpenChange={onOpenChange} />);
    expect(screen.queryByText("setting.account.email-in-use")).toBeNull();
    expect(document.getElementById("email")).toHaveValue("alice@example.com");
  });
});
