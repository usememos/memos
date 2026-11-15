import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChangeMemberPasswordDialog from "@/components/ChangeMemberPasswordDialog";
import { UserSchema } from "@/types/proto/api/user_service_pb";

const state = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock("@/hooks/useUserQueries", () => ({ useUpdateUser: () => ({ mutateAsync: state.updateUser }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const user = create(UserSchema, { name: "users/alice", displayName: "Alice" });

function enterPasswords(password: string, confirmation = password) {
  fireEvent.change(screen.getByPlaceholderText("auth.new-password"), { target: { value: password } });
  fireEvent.change(screen.getByPlaceholderText("auth.repeat-new-password"), { target: { value: confirmation } });
}

describe("ChangeMemberPasswordDialog", () => {
  beforeEach(() => state.updateUser.mockReset().mockResolvedValue(undefined));

  it("drops both cancelled passwords and requires a fresh password after reopening", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<ChangeMemberPasswordDialog open user={user} onOpenChange={onOpenChange} />);
    enterPasswords("cancelled-secret");
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    rerender(<ChangeMemberPasswordDialog open={false} user={user} onOpenChange={onOpenChange} />);
    rerender(<ChangeMemberPasswordDialog open user={user} onOpenChange={onOpenChange} />);
    expect(screen.getByPlaceholderText("auth.new-password")).toHaveValue("");
    expect(screen.getByPlaceholderText("auth.repeat-new-password")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(screen.getByText("message.fill-all")).toBeVisible();
  });

  it.each(["empty", "mismatch"] as const)("clears %s validation when reopened", (kind) => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<ChangeMemberPasswordDialog open user={user} onOpenChange={onOpenChange} />);
    if (kind === "mismatch") enterPasswords("new-secret", "different-secret");
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    const message = kind === "empty" ? "message.fill-all" : "message.new-password-not-match";
    expect(screen.getByText(message)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    rerender(<ChangeMemberPasswordDialog open={false} user={user} onOpenChange={onOpenChange} />);
    rerender(<ChangeMemberPasswordDialog open user={user} onOpenChange={onOpenChange} />);
    expect(screen.queryByText(message)).toBeNull();
    expect(screen.getByPlaceholderText("auth.new-password")).toHaveValue("");
    expect(screen.getByPlaceholderText("auth.repeat-new-password")).toHaveValue("");
  });

  it("clears the passwords when the target member changes", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<ChangeMemberPasswordDialog open user={user} onOpenChange={onOpenChange} />);
    enterPasswords("alice-secret");
    const otherUser = create(UserSchema, { name: "users/bob", displayName: "Bob" });
    rerender(<ChangeMemberPasswordDialog open user={otherUser} onOpenChange={onOpenChange} />);
    expect(screen.getByPlaceholderText("auth.new-password")).toHaveValue("");
    expect(screen.getByPlaceholderText("auth.repeat-new-password")).toHaveValue("");
  });

  it("saves a new password once and reopens empty after success", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<ChangeMemberPasswordDialog open user={user} onOpenChange={onOpenChange} />);
    enterPasswords("new-secret");
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(state.updateUser).toHaveBeenCalledExactlyOnceWith({
      user: { name: "users/alice", password: "new-secret" },
      updateMask: ["password"],
    });
    rerender(<ChangeMemberPasswordDialog open={false} user={user} onOpenChange={onOpenChange} />);
    rerender(<ChangeMemberPasswordDialog open user={user} onOpenChange={onOpenChange} />);
    expect(screen.getByPlaceholderText("auth.new-password")).toHaveValue("");
    expect(screen.getByPlaceholderText("auth.repeat-new-password")).toHaveValue("");
  });
});
