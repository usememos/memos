import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateSpaceDialog from "@/components/CreateSpaceDialog";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  onOpenChange: vi.fn(),
  selectSpace: vi.fn(),
  toastSuccess: vi.fn(),
  isPending: false,
}));

vi.mock("react-hot-toast", () => ({
  toast: { error: vi.fn(), success: mocks.toastSuccess },
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({ selectSpace: mocks.selectSpace }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/test" }),
}));

vi.mock("@/hooks/useSpaceQueries", () => ({
  useCreateSpace: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("CreateSpaceDialog", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset().mockResolvedValue({ name: "spaces/product", title: "Product", description: "Plans" });
    mocks.onOpenChange.mockClear();
    mocks.selectSpace.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.isPending = false;
  });

  it("creates and immediately selects the new Space", async () => {
    render(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} />);

    fireEvent.change(screen.getByLabelText("common.name"), { target: { value: "  Product  " } });
    fireEvent.change(screen.getByLabelText("common.description"), { target: { value: "  Plans  " } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith({ title: "Product", description: "Plans" }));
    expect(mocks.selectSpace).toHaveBeenCalledWith({ name: "spaces/product", title: "Product", description: "Plans" });
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("prevents dismissal while creation is pending", async () => {
    let resolveCreate!: (space: { name: string; title: string; description: string }) => void;
    mocks.mutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const view = render(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} />);
    fireEvent.change(screen.getByLabelText("common.name"), { target: { value: "Product" } });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    mocks.isPending = true;
    view.rerender(<CreateSpaceDialog open onOpenChange={mocks.onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mocks.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      resolveCreate({ name: "spaces/product", title: "Product", description: "" });
    });
    expect(mocks.selectSpace).toHaveBeenCalledWith({ name: "spaces/product", title: "Product", description: "" });
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
  });
});
