import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "@/components/ConfirmDialog";

const Confirmation = ({ onConfirm }: { onConfirm: () => void | Promise<void> }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Delete memo</button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this memo?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={onConfirm}
      />
    </>
  );
};

const openConfirmation = async (onConfirm: () => void | Promise<void>) => {
  render(<Confirmation onConfirm={onConfirm} />);
  const opener = screen.getByRole("button", { name: "Delete memo" });
  act(() => opener.focus());
  fireEvent.click(opener);
  return { opener, dialog: await screen.findByRole("dialog") };
};

describe("ConfirmDialog keyboard interaction", () => {
  it("focuses neither action and returns focus after Escape", async () => {
    const confirm = vi.fn();
    const { opener, dialog } = await openConfirmation(confirm);
    await waitFor(() => expect(dialog).toHaveFocus());
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it.each(["ctrlKey", "metaKey"])("confirms with Enter and %s", async (modifier) => {
    const confirm = vi.fn();
    const { opener, dialog } = await openConfirmation(confirm);
    fireEvent.keyDown(dialog, { key: "Enter", [modifier]: true });
    await waitFor(() => expect(opener).toHaveFocus());
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("does not confirm again or dismiss while confirmation is pending", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    const confirm = vi.fn(() => pending);
    const { dialog } = await openConfirmation(confirm);
    fireEvent.keyDown(dialog, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(dialog, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    await act(async () => resolve());
  });
});
