import { Code, ConnectError } from "@connectrpc/connect";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateSpaceDialog from "@/components/CreateSpaceDialog";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  onOpenChange: vi.fn(),
  onCreated: vi.fn(),
  toastSuccess: vi.fn(),
  uuidv4: vi.fn(),
  isPending: false,
}));

vi.mock("react-hot-toast", () => ({
  toast: { error: vi.fn(), success: mocks.toastSuccess },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/test" }),
}));

vi.mock("@/hooks/useSpaceQueries", () => ({
  useCreateSpace: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending }),
}));

vi.mock("uuid", () => ({
  v4: mocks.uuidv4,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const FIRST_SPACE_UID = "5c094171-6f55-4cd0-b79a-2b777ec3596d";
const SECOND_SPACE_UID = "53a9441d-7536-411a-b234-a1d655422108";

describe("CreateSpaceDialog", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset().mockResolvedValue({ name: "spaces/product", title: "Product", description: "Plans" });
    mocks.onOpenChange.mockClear();
    mocks.onCreated.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.uuidv4.mockReset().mockReturnValue(FIRST_SPACE_UID);
    mocks.isPending = false;
  });

  it("creates and reports the new Space to the caller", async () => {
    render(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} onCreated={mocks.onCreated} />);

    fireEvent.change(screen.getByLabelText("common.name"), { target: { value: "  Product  " } });
    fireEvent.change(screen.getByLabelText("common.description"), { target: { value: "  Plans  " } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await waitFor(() => {
      expect(mocks.onCreated).toHaveBeenCalledWith({ name: "spaces/product", title: "Product", description: "Plans" });
      expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ title: "Product", description: "Plans", spaceId: FIRST_SPACE_UID });
  });

  it("allows a valid custom Space UID and explains invalid values", async () => {
    render(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByLabelText("common.name"), { target: { value: "Product" } });
    fireEvent.click(screen.getByRole("button", { name: "space.custom-id-toggle" }));

    const spaceIdInput = screen.getByLabelText("space.custom-id-label");
    expect(spaceIdInput).toHaveValue(FIRST_SPACE_UID);
    fireEvent.change(spaceIdInput, { target: { value: "-product" } });
    expect(screen.getByRole("alert")).toHaveTextContent("space.custom-id-invalid");
    expect(screen.getByRole("button", { name: "common.create" })).toBeDisabled();

    fireEvent.change(spaceIdInput, { target: { value: "P" } });
    expect(screen.getByText("space.custom-id-help")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.create" })).toBeEnabled();

    fireEvent.change(spaceIdInput, { target: { value: "Product-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ title: "Product", description: undefined, spaceId: "Product-2026" }),
    );
  });

  it("reveals and associates a conflicting Space UID returned by the server", async () => {
    mocks.mutateAsync.mockRejectedValue(new ConnectError("space already exists", Code.AlreadyExists));
    render(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByLabelText("common.name"), { target: { value: "Product" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    const spaceUidInput = await screen.findByLabelText("space.custom-id-label");
    expect(spaceUidInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("space.custom-id-conflict");
    expect(screen.getByRole("button", { name: "common.create" })).toBeDisabled();

    fireEvent.change(spaceUidInput, { target: { value: "product-2" } });
    expect(spaceUidInput).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText("space.custom-id-help")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.create" })).toBeEnabled();
  });

  it("reuses the Space UID for retries and generates a new one for the next open", async () => {
    mocks.uuidv4.mockReset().mockReturnValueOnce(FIRST_SPACE_UID).mockReturnValueOnce(SECOND_SPACE_UID);
    mocks.mutateAsync.mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce({
      name: `spaces/${FIRST_SPACE_UID}`,
      title: "Product",
      description: "",
    });
    const view = render(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByLabelText("common.name"), { target: { value: "Product" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));
    expect(mocks.mutateAsync.mock.calls[0][0].spaceId).toBe(FIRST_SPACE_UID);
    expect(mocks.mutateAsync.mock.calls[1][0].spaceId).toBe(FIRST_SPACE_UID);

    view.rerender(<CreateSpaceDialog open={false} onOpenChange={mocks.onOpenChange} />);
    view.rerender(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "space.custom-id-toggle" }));
    expect(screen.getByLabelText("space.custom-id-label")).toHaveValue(SECOND_SPACE_UID);
  });

  it("can create without activating the new Space", async () => {
    render(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByLabelText("common.name"), { target: { value: "Product" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await waitFor(() => expect(mocks.onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.mutateAsync).toHaveBeenCalledOnce();
    expect(mocks.onCreated).not.toHaveBeenCalled();
  });

  it("waits for creation to finish before closing and reporting the Space", async () => {
    let resolveCreate!: (space: { name: string; title: string; description: string }) => void;
    mocks.mutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    render(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} onCreated={mocks.onCreated} />);

    fireEvent.change(screen.getByLabelText("common.name"), { target: { value: "Product" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    expect(mocks.mutateAsync).toHaveBeenCalledOnce();
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
    expect(mocks.onCreated).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate({ name: "spaces/product", title: "Product", description: "" });
    });

    await waitFor(() => {
      expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
      expect(mocks.onCreated).toHaveBeenCalledWith({ name: "spaces/product", title: "Product", description: "" });
    });
  });

  it("prevents dismissal while creation is pending", async () => {
    let resolveCreate!: (space: { name: string; title: string; description: string }) => void;
    mocks.mutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const view = render(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} onCreated={mocks.onCreated} />);
    fireEvent.change(screen.getByLabelText("common.name"), { target: { value: "Product" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    mocks.isPending = true;
    view.rerender(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} onCreated={mocks.onCreated} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      resolveCreate({ name: "spaces/product", title: "Product", description: "" });
    });
    expect(mocks.onCreated).toHaveBeenCalledWith({ name: "spaces/product", title: "Product", description: "" });
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
  });
});
