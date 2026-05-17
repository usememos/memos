import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheService } from "@/components/MemoEditor/services/cacheService";

describe("memo editor cache", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
    });
    cacheService.clearAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores draft content", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");

    cacheService.saveNow(key, "- [x] Draft task");

    expect(cacheService.load(key)).toBe("- [x] Draft task");
  });

  it("removes empty draft content instead of caching it", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");

    cacheService.saveNow(key, "");

    expect(cacheService.load(key)).toBe("");
  });

  it("loads content from previously structured draft entries", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");
    localStorage.setItem(key, JSON.stringify({ kind: "memos.editor-cache", version: 1, content: "- [ ] migrated task" }));

    expect(cacheService.load(key)).toBe("- [ ] migrated task");
  });

  it("keeps raw JSON markdown drafts intact", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");
    const jsonDraft = '{"content":"not a cache envelope"}';
    localStorage.setItem(key, jsonDraft);

    expect(cacheService.load(key)).toBe(jsonDraft);
  });

  it("keeps structured-looking drafts without a supported version intact", () => {
    const key = cacheService.key("users/steven", "home-memo-editor");
    const jsonDraft = JSON.stringify({ kind: "memos.editor-cache", content: "not a supported envelope" });
    localStorage.setItem(key, jsonDraft);

    expect(cacheService.load(key)).toBe(jsonDraft);
  });
});

// ---------------------------------------------------------------------------
// T5 — server-side draft-memo feature: memoService.saveDraft (RED today).
//
// These tests pin the saveDraft contract (aurum-systems §5.1 / plan T5 / E4,E7)
// BEFORE the function exists. They mock the connect client (core Vitest, same
// vi.mock primitive already used in tests/paged-memo-list.test.tsx) but DO NOT
// mock away the real shared `MemoSchema` builder — the payload snapshot must
// reflect the real builder so it proves §2 field inheritance from save().
//
// Expected status TODAY: every test in this block FAILS because
// `memoService.saveDraft` is not exported (TypeError: not a function).
// ---------------------------------------------------------------------------

const createMemoMock = vi.fn(async (req: { memo: unknown }) => ({ name: "memos/draft-1", ...(req.memo as object) }));
const updateMemoMock = vi.fn(async (req: { memo: { name?: string } }) => ({ name: req.memo.name ?? "memos/draft-1" }));
const getMemoMock = vi.fn(async ({ name }: { name: string }) => ({ name, content: "", attachments: [], relations: [] }));

vi.mock("@/connect", () => ({
  memoServiceClient: {
    createMemo: (req: { memo: unknown }) => createMemoMock(req),
    updateMemo: (req: { memo: { name?: string } }) => updateMemoMock(req),
    getMemo: (req: { name: string }) => getMemoMock(req),
    createMemoComment: vi.fn(),
  },
}));

// uploadService.uploadFiles is called by save()/saveDraft() before building the
// payload; stub it to a no-op so the field-set comparison is deterministic.
vi.mock("@/components/MemoEditor/services/uploadService", () => ({
  uploadService: { uploadFiles: vi.fn(async () => []) },
}));

import { memoService } from "@/components/MemoEditor/services/memoService";
import type { EditorState } from "@/components/MemoEditor/state";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";

function makeEditorState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    content: "draft body",
    metadata: {
      visibility: Visibility.PRIVATE,
      attachments: [],
      relations: [],
      location: undefined,
    },
    ui: {
      isFocusMode: false,
      isLoading: { saving: false, uploading: false, loading: false },
      isComposing: false,
    },
    timestamps: { createTime: undefined, updateTime: undefined },
    localFiles: [],
    audioRecorder: {
      isSupported: true,
      permission: "unknown",
      status: "idle",
      elapsedSeconds: 0,
      error: undefined,
    },
    ...overrides,
  };
}

describe("memoService.saveDraft (T5, RED today)", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
    });
    cacheService.clearAll();
    createMemoMock.mockClear();
    updateMemoMock.mockClear();
    getMemoMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saveDraft builds the same MemoSchema field set as save() plus state: State.DRAFT", async () => {
    const state = makeEditorState();

    // Drive save() (NORMAL create) to capture the real builder's field set.
    await memoService.save(state, {});
    expect(createMemoMock).toHaveBeenCalledTimes(1);
    const savePayload = { ...(createMemoMock.mock.calls[0][0].memo as Record<string, unknown>) };
    createMemoMock.mockClear();

    // saveDraft does not exist yet -> this is the RED line.
    const draftFn = (memoService as unknown as { saveDraft?: (s: EditorState, o: { draftMemoName?: string }) => Promise<unknown> })
      .saveDraft;
    expect(typeof draftFn).toBe("function");

    await memoService.saveDraft!(state, {});
    const draftPayload = { ...(createMemoMock.mock.calls[0][0].memo as Record<string, unknown>) };

    // The ONLY delta vs. save()'s create branch must be `state: DRAFT`.
    expect(draftPayload.state).toBe(State.DRAFT);
    const { state: _ignored, ...draftRest } = draftPayload;
    const { state: _saveState, ...saveRest } = savePayload;
    expect(Object.keys(draftRest).sort()).toEqual(Object.keys(saveRest).sort());
    expect(draftRest).toEqual(saveRest);
  });

  it("clears the matching cacheService localStorage key on a successful saveDraft (E7)", async () => {
    const username = "users/steven";
    const cacheKey = "home-memo-editor";
    const key = cacheService.key(username, cacheKey);
    cacheService.saveNow(key, "draft body");
    expect(cacheService.load(key)).toBe("draft body");

    const draftFn = (
      memoService as unknown as {
        saveDraft?: (s: EditorState, o: { draftMemoName?: string; cacheKey?: string; username?: string }) => Promise<unknown>;
      }
    ).saveDraft;
    expect(typeof draftFn).toBe("function");

    await memoService.saveDraft!(makeEditorState(), { username, cacheKey } as { draftMemoName?: string });

    // After a successful server draft save, the localStorage keystroke buffer
    // for this editor must be cleared so it cannot stale-restore (edge E7).
    expect(cacheService.load(key)).toBe("");
  });

  it("does NOT require validationService.canSave — an empty/partial draft is allowed (E4)", async () => {
    // Empty content + no attachments: validationService.canSave() returns invalid.
    const emptyState = makeEditorState({ content: "" });

    const draftFn = (memoService as unknown as { saveDraft?: (s: EditorState, o: { draftMemoName?: string }) => Promise<unknown> })
      .saveDraft;
    expect(typeof draftFn).toBe("function");

    await expect(memoService.saveDraft!(emptyState, {})).resolves.toBeTruthy();
    expect(createMemoMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Bugfix — publishing a resumed draft must transition the SAME draft row
// (DRAFT -> NORMAL) instead of minting a new NORMAL memo. The defect:
// handleSave ignored resumedDraftName and always took save()'s create branch,
// so the published copy appeared on Home (S2) while the original draft stayed
// in the Drafts list (S1). The backend publish transition already exists
// (memo_service.go:549-561). publishDraft is the UI-side call that drives it.
//
// See docs/plans/2026-05-17-server-side-memo-drafts/bugfix-publish-orphans-draft.md.
//
// Pinned at the memoService boundary (where the defective call shape lived) —
// the project has no full <MemoEditor> render harness; every editor test pins
// the contract at this seam with a mocked @/connect (same pattern as the
// saveDraft / useDrafts T5 pins).
//
// Expected status BEFORE the fix: every test FAILS because
// `memoService.publishDraft` is not exported (TypeError: not a function).
// ---------------------------------------------------------------------------

describe("memoService.publishDraft (bugfix: publish a resumed draft)", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
    });
    cacheService.clearAll();
    createMemoMock.mockClear();
    updateMemoMock.mockClear();
    getMemoMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the same MemoSchema field set as saveDraft, with state: State.NORMAL (not DRAFT)", async () => {
    const state = makeEditorState();

    // Capture saveDraft's create-branch payload as the reference field set.
    await memoService.saveDraft!(state, {});
    expect(createMemoMock).toHaveBeenCalledTimes(1);
    const draftPayload = { ...(createMemoMock.mock.calls[0][0].memo as Record<string, unknown>) };

    const publishFn = (
      memoService as unknown as { publishDraft?: (s: EditorState, o: { draftMemoName: string }) => Promise<unknown> }
    ).publishDraft;
    expect(typeof publishFn).toBe("function");

    await memoService.publishDraft!(state, { draftMemoName: "memos/draft-7" });
    const publishPayload = { ...(updateMemoMock.mock.calls[0][0].memo as Record<string, unknown>) };

    // The ONLY field-value delta vs. saveDraft's payload is state: NORMAL
    // (publish also stamps `name` to target the existing row; ignore it on
    // both sides — MemoSchema always carries a `name` key, default "").
    expect(publishPayload.state).toBe(State.NORMAL);
    const { state: _ps, name: _pn, ...publishRest } = publishPayload;
    const { state: _ds, name: _dn, ...draftRest } = draftPayload;
    expect(Object.keys(publishRest).sort()).toEqual(Object.keys(draftRest).sort());
    expect(publishRest).toEqual(draftRest);
  });

  it("ALWAYS updates the existing draft row (updateMemo, never createMemo) — fixes S1/S2", async () => {
    const publishFn = (
      memoService as unknown as { publishDraft?: (s: EditorState, o: { draftMemoName: string }) => Promise<unknown> }
    ).publishDraft;
    expect(typeof publishFn).toBe("function");

    await memoService.publishDraft!(makeEditorState(), { draftMemoName: "memos/draft-7" });

    // Must transition the SAME row, not mint a duplicate NORMAL memo.
    expect(createMemoMock).not.toHaveBeenCalled();
    expect(updateMemoMock).toHaveBeenCalledTimes(1);

    const req = updateMemoMock.mock.calls[0][0] as {
      memo: { name?: string; state?: State };
      updateMask: { paths: string[] };
    };
    expect(req.memo.name).toBe("memos/draft-7");
    expect(req.memo.state).toBe(State.NORMAL);
    // The mask must carry "state" so the backend Draft->NORMAL transition
    // (created_ts/updated_ts refresh + publish side-effects) fires.
    for (const path of ["content", "visibility", "attachments", "relations", "location", "state"]) {
      expect(req.updateMask.paths).toContain(path);
    }
  });

  it("returns the published memo's name", async () => {
    const publishFn = (
      memoService as unknown as { publishDraft?: (s: EditorState, o: { draftMemoName: string }) => Promise<{ memoName: string }> }
    ).publishDraft;
    expect(typeof publishFn).toBe("function");

    const result = await memoService.publishDraft!(makeEditorState(), { draftMemoName: "memos/draft-7" });
    expect(result.memoName).toBe("memos/draft-7");
  });
});
