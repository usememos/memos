import { create } from "@bufbuild/protobuf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadOrSeedConfig, persistConfig, resetConfig } from "@/modules/navigation/controller";
import { buildConfigContent } from "@/modules/navigation/storage";
import { createSeedConfig, NAV_STORAGE_KEYS, type NavConfig } from "@/modules/navigation/types";
import { State } from "@/types/proto/api/v1/common_pb";
import { MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";

const state = vi.hoisted(() => ({
  listMemos: vi.fn(),
  createMemo: vi.fn(),
  updateMemo: vi.fn(),
  deleteMemo: vi.fn(),
}));

vi.mock("@/connect", () => ({
  memoServiceClient: {
    listMemos: state.listMemos,
    createMemo: state.createMemo,
    updateMemo: state.updateMemo,
    deleteMemo: state.deleteMemo,
  },
}));

const memo = (name: string, content: string) =>
  create(MemoSchema, {
    name,
    content,
    state: State.ARCHIVED,
    visibility: Visibility.PRIVATE,
    updateTime: { seconds: 1_700_000_000n, nanos: 0 },
  });

const seedConfig = createSeedConfig();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("loadOrSeedConfig", () => {
  it("seeds a fresh config memo on first visit", async () => {
    state.listMemos.mockResolvedValue({ memos: [] });
    state.createMemo.mockResolvedValue(memo("memos/seed", ""));

    const result = await loadOrSeedConfig();

    expect(result?.source).toBe("seed");
    expect(result?.memoName).toBe("memos/seed");
    expect(result?.config.groups).toHaveLength(3);
    expect(state.createMemo).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(NAV_STORAGE_KEYS.initialized)).toBe("1");
    expect(localStorage.getItem(NAV_STORAGE_KEYS.cache)).toBeTruthy();
  });

  it("loads the newest existing config memo", async () => {
    const config: NavConfig = { ...seedConfig, rev: 4 };
    state.listMemos.mockResolvedValue({ memos: [memo("memos/existing", buildConfigContent(config))] });

    const result = await loadOrSeedConfig();

    expect(result?.source).toBe("memo");
    expect(result?.memoName).toBe("memos/existing");
    expect(result?.config.rev).toBe(4);
    expect(state.createMemo).not.toHaveBeenCalled();
  });

  it("degrades to the cache when the memo payload is broken", async () => {
    state.listMemos.mockResolvedValue({ memos: [memo("memos/broken", "nav-config:v1\n```json\nnot json\n```")] });
    localStorage.setItem(NAV_STORAGE_KEYS.cache, JSON.stringify(seedConfig));

    const result = await loadOrSeedConfig();

    expect(result?.source).toBe("cache");
    expect(result?.memoName).toBeNull();
    expect(state.createMemo).not.toHaveBeenCalled();
  });

  it("degrades to the cache when the RPC fails", async () => {
    state.listMemos.mockRejectedValue(new Error("offline"));
    localStorage.setItem(NAV_STORAGE_KEYS.cache, JSON.stringify(seedConfig));

    const result = await loadOrSeedConfig();

    expect(result?.source).toBe("cache");
    expect(result?.memoName).toBeNull();
  });

  it("rethrows when the RPC fails and there is no cache to fall back to", async () => {
    state.listMemos.mockRejectedValue(new Error("offline"));

    await expect(loadOrSeedConfig()).rejects.toThrow("offline");
  });

  it("returns null for a broken memo with no cache (never re-seeds over it)", async () => {
    state.listMemos.mockResolvedValue({ memos: [memo("memos/broken", "nav-config:v1\n```json\nnot json\n```")] });

    const result = await loadOrSeedConfig();

    expect(result).toBeNull();
    expect(state.createMemo).not.toHaveBeenCalled();
  });
});

describe("persistConfig", () => {
  it("updates the existing memo and bumps rev", async () => {
    state.updateMemo.mockResolvedValue(memo("memos/existing", ""));
    const next: NavConfig = { ...seedConfig, rev: 7 };

    const result = await persistConfig(next, { config: seedConfig, memoName: "memos/existing" });

    expect(result.config.rev).toBe(8);
    expect(state.updateMemo).toHaveBeenCalledTimes(1);
    expect(state.createMemo).not.toHaveBeenCalled();
  });

  it("creates a memo when none exists yet", async () => {
    state.listMemos.mockResolvedValue({ memos: [] });
    state.createMemo.mockResolvedValue(memo("memos/created", ""));

    const result = await persistConfig(seedConfig, { config: null, memoName: null });

    expect(result.memoName).toBe("memos/created");
    expect(result.config.rev).toBe(2);
    expect(state.createMemo).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(NAV_STORAGE_KEYS.initialized)).toBe("1");
  });

  it("updates the newest existing memo instead of forking when memoName is missing", async () => {
    const existing = { ...seedConfig, rev: 3 };
    state.listMemos.mockResolvedValue({ memos: [memo("memos/existing", buildConfigContent(existing))] });
    state.updateMemo.mockResolvedValue(memo("memos/existing", ""));

    const result = await persistConfig(existing, { config: existing, memoName: null });

    expect(result.memoName).toBe("memos/existing");
    expect(state.updateMemo).toHaveBeenCalledTimes(1);
    expect(state.createMemo).not.toHaveBeenCalled();
  });

  it("rolls the cache back to the snapshot when the write fails", async () => {
    state.updateMemo.mockRejectedValue(new Error("conflict"));
    const next: NavConfig = { ...seedConfig, rev: 5 };

    await expect(persistConfig(next, { config: seedConfig, memoName: "memos/existing" })).rejects.toThrow("conflict");

    const cached = JSON.parse(localStorage.getItem(NAV_STORAGE_KEYS.cache) ?? "{}") as NavConfig;
    expect(cached.rev).toBe(seedConfig.rev);
  });
});

describe("resetConfig", () => {
  it("deletes the memo and re-seeds", async () => {
    state.deleteMemo.mockResolvedValue({});
    state.listMemos.mockResolvedValue({ memos: [] });
    state.createMemo.mockResolvedValue(memo("memos/fresh", ""));

    const result = await resetConfig("memos/old");

    expect(state.deleteMemo).toHaveBeenCalledWith(expect.objectContaining({ name: "memos/old" }));
    expect(result?.source).toBe("seed");
    expect(result?.memoName).toBe("memos/fresh");
  });

  it("still re-seeds when the delete fails", async () => {
    state.deleteMemo.mockRejectedValue(new Error("gone"));
    state.listMemos.mockResolvedValue({ memos: [] });
    state.createMemo.mockResolvedValue(memo("memos/fresh", ""));

    const result = await resetConfig("memos/old");

    expect(result?.source).toBe("seed");
  });
});
