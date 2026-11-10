import { expect, it, vi } from "vitest";
import { confirmEncryptedDiscard, registerEncryptedDraft } from "../src/lib/e2ee/dirty";

it("checks dirty editors globally, including a lock triggered by another memo", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const release = registerEncryptedDraft();
  expect(confirmEncryptedDiscard("discard?")).toBe(false);
  expect(confirm).toHaveBeenCalledWith("discard?");
  release();
  expect(confirmEncryptedDiscard("discard?")).toBe(true);
  confirm.mockRestore();
});
