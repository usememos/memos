import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoSave } from "@/components/MemoEditor/hooks/useAutoSave";
import { cacheService } from "@/components/MemoEditor/services/cacheService";
import { EditorProvider, useEditorContext } from "@/components/MemoEditor/state";

// Probe surfaces the store's dispatch/actions plus the autosave API so tests can
// drive content changes the way the editor does and assert on cache writes.
let api: {
  dispatch: ReturnType<typeof useEditorContext>["dispatch"];
  actions: ReturnType<typeof useEditorContext>["actions"];
  discardDraft: () => void;
};

function Probe({ username, cacheKey, enabled }: { username: string; cacheKey?: string; enabled?: boolean }) {
  const { dispatch, actions } = useEditorContext();
  const { discardDraft } = useAutoSave(username, cacheKey, enabled);
  api = { dispatch, actions, discardDraft };
  return null;
}

describe("useAutoSave (store-subscribed)", () => {
  let saveSpy: ReturnType<typeof vi.spyOn>;
  let saveNowSpy: ReturnType<typeof vi.spyOn>;
  let clearSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    saveSpy = vi.spyOn(cacheService, "save").mockImplementation(() => {});
    saveNowSpy = vi.spyOn(cacheService, "saveNow").mockImplementation(() => {});
    clearSpy = vi.spyOn(cacheService, "clear").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists content to the draft cache when content changes", () => {
    render(
      <EditorProvider>
        <Probe username="users/steven" cacheKey="k" enabled />
      </EditorProvider>,
    );
    const key = cacheService.key("users/steven", "k");
    saveSpy.mockClear(); // ignore the mount-time persist of the initial empty content
    act(() => {
      api.dispatch(api.actions.updateContent("hello world"));
    });
    expect(saveSpy).toHaveBeenCalledWith(key, "hello world");
  });

  it("does not persist when disabled", () => {
    render(
      <EditorProvider>
        <Probe username="users/steven" cacheKey="k" enabled={false} />
      </EditorProvider>,
    );
    saveSpy.mockClear();
    act(() => {
      api.dispatch(api.actions.updateContent("ignored"));
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("discardDraft clears the cache and suppresses the unmount flush", () => {
    const { unmount } = render(
      <EditorProvider>
        <Probe username="users/steven" cacheKey="k2" enabled />
      </EditorProvider>,
    );
    const key = cacheService.key("users/steven", "k2");
    act(() => {
      api.dispatch(api.actions.updateContent("draft body"));
    });
    act(() => {
      api.discardDraft();
    });
    expect(clearSpy).toHaveBeenCalledWith(key);

    saveNowSpy.mockClear();
    unmount();
    // The just-discarded content equals the latest content, so the unmount
    // flush must NOT re-persist it as a stale draft.
    expect(saveNowSpy).not.toHaveBeenCalled();
  });
});
