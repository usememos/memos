import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CreateAccessTokenDialog from "@/components/CreateAccessTokenDialog";

const createPersonalAccessToken = vi.hoisted(() => vi.fn());

vi.mock("@/connect", () => ({
  userServiceClient: {
    createPersonalAccessToken,
  },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/alice" }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("CreateAccessTokenDialog", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  beforeEach(() => {
    createPersonalAccessToken.mockReset();
    createPersonalAccessToken.mockResolvedValue({ token: "" });
  });

  it("creates a non-expiring token by default", async () => {
    render(<CreateAccessTokenDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "setting.access-token.create-dialog.duration-never" })).toBeChecked();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "CLI token" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await waitFor(() =>
      expect(createPersonalAccessToken).toHaveBeenCalledWith({
        parent: "users/alice",
        description: "CLI token",
        expiresInDays: 0,
      }),
    );
  });
});
