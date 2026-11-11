import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { E2EEProvider, useVaultSession } from "../src/contexts/E2EEContext";

const mocks = vi.hoisted(() => ({ t: (key: string) => `en:${key}`, toast: vi.fn() }));
vi.mock("../src/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: { name: "users/alice" } }) }));
vi.mock("../src/utils/i18n", () => ({ useTranslate: () => mocks.t }));
vi.mock("../src/lib/toast", () => ({ toast: { add: mocks.toast } }));
afterEach(() => vi.useRealTimers());
it("keeps the vault unlocked on language changes and uses the latest warning translation", () => {
  vi.useFakeTimers();
  let vault: ReturnType<typeof useVaultSession>;
  function Probe() {
    vault = useVaultSession();
    return null;
  }
  const view = render(
    <E2EEProvider>
      <Probe />
    </E2EEProvider>,
  );
  const key = {} as CryptoKey;
  act(() => {
    vault.session.accept(vault.session.ticket(), key, "vault");
  });
  act(() => {
    vi.advanceTimersByTime(13 * 60 * 1000);
  });
  mocks.t = (key: string) => `ko:${key}`;
  view.rerender(
    <E2EEProvider>
      <Probe />
    </E2EEProvider>,
  );
  expect(vault!.key).toBe(key);
  act(() => {
    vi.advanceTimersByTime(60 * 1000);
  });
  expect(mocks.toast).toHaveBeenCalledWith({ title: "ko:e2ee.idle-warning", timeout: 60000 });
  act(() => {
    vi.advanceTimersByTime(60 * 1000);
  });
  expect(vault!.key).toBeUndefined();
});
