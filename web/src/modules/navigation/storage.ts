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

/** Finds the newest config memo server-side; no localStorage involvement. */
export const findConfigMemo = async (): Promise<Memo | null> => {
  const response = await memoServiceClient.listMemos(
    create(ListMemosRequestSchema, {
      pageSize: CONFIG_MEMO_PAGE_SIZE,
      state: State.ARCHIVED,
      filter: `content.contains("${NAV_CONFIG_MARKER_PREFIX}")`,
    }),
  );
  let newest: Memo | null = null;
  for (const memo of response.memos) {
    if (!extractConfigPayload(memo.content)) continue;
    const ts = (memo.updateTime?.seconds ?? 0n) * 1000n + BigInt(memo.updateTime?.nanos ?? 0) / 1_000_000n;
    const newestTs = newest ? (newest.updateTime?.seconds ?? 0n) * 1000n + BigInt(newest.updateTime?.nanos ?? 0) / 1_000_000n : -1n;
    if (ts > newestTs) newest = memo;
  }
  return newest;
};

export const createConfigMemo = async (config: NavConfig): Promise<Memo> =>
  memoServiceClient.createMemo(create(CreateMemoRequestSchema, { memo: toMemoMessage(buildConfigContent(config)) }));

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
