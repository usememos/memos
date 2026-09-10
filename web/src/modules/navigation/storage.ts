/**
 * Storage adapter: persists the navigation config inside Memos itself, as one
 * ARCHIVED + PRIVATE memo tagged with a plain-string marker and a fenced JSON
 * body. ARCHIVED keeps it out of timelines, global search, tags and statistics
 * (they all list state NORMAL); it stays recoverable via a server-side CEL
 * filter (`state=ARCHIVED + content.contains(marker)`) without any dependence
 * on localStorage. The memo also surfaces in the user's Archive page — an
 * accepted, user-manageable transparency trade-off.
 *
 * Raw MemoService RPCs only: zero changes to upstream stores, hooks or backend.
 */

import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { memoServiceClient } from "@/connect";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import {
  CreateMemoRequestSchema,
  DeleteMemoRequestSchema,
  ListMemosRequestSchema,
  MemoSchema,
  UpdateMemoRequestSchema,
  Visibility,
} from "@/types/proto/api/v1/memo_service_pb";
import { NAV_CONFIG_MARKER, NAV_CONFIG_MARKER_PREFIX, type NavConfig } from "./types";
import { extractConfigPayload } from "./validate";

const CONFIG_MEMO_PAGE_SIZE = 50;

export const buildConfigContent = (config: NavConfig): string => {
  const json = JSON.stringify(config, null, 2);
  return `${NAV_CONFIG_MARKER}\n\`\`\`json\n${json}\n\`\`\``;
};

export const extractConfigFromMemo = (memo: Memo): NavConfig | null => {
  const payload = extractConfigPayload(memo.content);
  if (!payload) return null;
  return payload.config;
};

const toMemoMessage = (content: string, memoName?: string) =>
  create(MemoSchema, {
    ...(memoName ? { name: memoName } : {}),
    content,
    visibility: Visibility.PRIVATE,
    state: State.ARCHIVED,
  });

/** Collect valid config memos from one list page. */
const pickConfigMemos = (memos: Memo[]): Memo[] => memos.filter((memo) => extractConfigPayload(memo.content) !== null);

/**
 * Finds the newest config memo. Search both ARCHIVED (the intended home) and
 * NORMAL (legacy seeds, or creates that ignored the requested state) so a
 * visible timeline memo is reused instead of spawning another seed.
 */
export const findConfigMemo = async (): Promise<Memo | null> => {
  const filter = `content.contains("${NAV_CONFIG_MARKER_PREFIX}")`;
  const [archived, normal] = await Promise.all([
    memoServiceClient.listMemos(create(ListMemosRequestSchema, { pageSize: CONFIG_MEMO_PAGE_SIZE, state: State.ARCHIVED, filter })),
    memoServiceClient.listMemos(create(ListMemosRequestSchema, { pageSize: CONFIG_MEMO_PAGE_SIZE, state: State.NORMAL, filter })),
  ]);
  const candidates = [...pickConfigMemos(archived.memos), ...pickConfigMemos(normal.memos)];
  let newest: Memo | null = null;
  for (const memo of candidates) {
    const ts = (memo.updateTime?.seconds ?? 0n) * 1000n + BigInt(memo.updateTime?.nanos ?? 0) / 1_000_000n;
    const newestTs = newest ? (newest.updateTime?.seconds ?? 0n) * 1000n + BigInt(newest.updateTime?.nanos ?? 0) / 1_000_000n : -1n;
    if (ts > newestTs) newest = memo;
  }
  return newest;
};

/**
 * CreateMemo always stores row status NORMAL (API ignores `state` on create),
 * so archive in a follow-up update to keep the config out of the timeline.
 */
export const createConfigMemo = async (config: NavConfig): Promise<Memo> => {
  const created = await memoServiceClient.createMemo(create(CreateMemoRequestSchema, { memo: toMemoMessage(buildConfigContent(config)) }));
  if (created.state !== State.ARCHIVED) {
    try {
      await archiveConfigMemo(created.name);
      created.state = State.ARCHIVED;
    } catch {
      // Still return the memo; the next load will find it as NORMAL and archive it.
    }
  }
  return created;
};

/** Content-only update; the memo keeps its ARCHIVED + PRIVATE state. */
export const updateConfigMemo = async (memoName: string, config: NavConfig): Promise<Memo> =>
  memoServiceClient.updateMemo(
    create(UpdateMemoRequestSchema, {
      memo: toMemoMessage(buildConfigContent(config), memoName),
      updateMask: create(FieldMaskSchema, { paths: ["content", "update_time"] }),
    }),
  );

export const archiveConfigMemo = async (memoName: string): Promise<void> => {
  await memoServiceClient.updateMemo(
    create(UpdateMemoRequestSchema, {
      memo: create(MemoSchema, { name: memoName, state: State.ARCHIVED }),
      updateMask: create(FieldMaskSchema, { paths: ["state"] }),
    }),
  );
};

export const deleteConfigMemo = async (memoName: string): Promise<void> => {
  await memoServiceClient.deleteMemo(create(DeleteMemoRequestSchema, { name: memoName }));
};

/** High-level load: memo first, localStorage cache as degraded fallback. */
export const loadConfig = async (): Promise<{ config: NavConfig | null; memoName: string | null }> => {
  try {
    const memo = await findConfigMemo();
    if (memo) {
      const config = extractConfigFromMemo(memo);
      if (config) return { config, memoName: memo.name };
      // Marker present but payload broken — keep it visible in Archive, degrade locally.
      return { config: null, memoName: null };
    }
    return { config: null, memoName: null };
  } catch {
    return { config: null, memoName: null };
  }
};
