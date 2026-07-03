import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { State } from "../gen/api/v1/common_pb";
import {
  ListAllUserStatsResponseSchema,
  UserStatsSchema,
  UserStats_MemoTypeStatsSchema,
  type ListAllUserStatsResponse,
  type UserStats,
} from "../gen/api/v1/user_service_pb";
import { listMemos, type FindMemo, type MemoRow } from "../store/memos";
import { listUsers } from "../store/users";
import type { ServiceContext } from "./context";
import { buildUserName, tsFromUnix } from "./convert";
import { MEMO_NAME_PREFIX } from "./memo";

function aggregate(rows: MemoRow[]): Map<number, UserStats> {
  const byUser = new Map<number, UserStats>();
  for (const memo of rows) {
    let stats = byUser.get(memo.creator_id);
    if (!stats) {
      stats = create(UserStatsSchema, {
        tagCount: {},
        memoTypeStats: create(UserStats_MemoTypeStatsSchema),
      });
      byUser.set(memo.creator_id, stats);
    }
    stats.memoCreatedTimestamps.push(tsFromUnix(memo.created_ts));
    stats.memoUpdatedTimestamps.push(tsFromUnix(memo.updated_ts));
    stats.totalMemoCount++;
    for (const tag of memo.payload.tags) {
      stats.tagCount[tag] = (stats.tagCount[tag] ?? 0) + 1;
    }
    const property = memo.payload.property;
    if (property && stats.memoTypeStats) {
      if (property.hasLink) stats.memoTypeStats.linkCount++;
      if (property.hasCode) stats.memoTypeStats.codeCount++;
      if (property.hasTaskList) stats.memoTypeStats.todoCount++;
      if (property.hasIncompleteTasks) stats.memoTypeStats.undoCount++;
    }
    if (memo.pinned === 1) {
      stats.pinnedMemos.push(`${MEMO_NAME_PREFIX}${memo.uid}`);
    }
  }
  return byUser;
}

export async function listAllUserStats(
  ctx: ServiceContext,
  options: { state?: State; filter?: string; creatorId?: number },
): Promise<ListAllUserStatsResponse> {
  const find: FindMemo = {
    excludeComments: true,
    excludeContent: true,
    rowStatus: options.state === State.ARCHIVED ? "ARCHIVED" : "NORMAL",
    filters: [],
  };
  if (options.filter) {
    find.filters!.push(options.filter);
  }
  if (options.creatorId !== undefined) {
    find.creatorId = options.creatorId;
  }

  if (options.state === State.ARCHIVED) {
    // Archived memos are only visible to their creator.
    if (!ctx.user) {
      return create(ListAllUserStatsResponseSchema);
    }
    find.creatorId = ctx.user.id;
  } else if (!ctx.user) {
    find.visibilityList = ["PUBLIC"];
  } else if (find.creatorId === undefined) {
    find.filters!.push(`creator_id == ${ctx.user.id} || visibility in ["PUBLIC", "PROTECTED"]`);
  } else if (find.creatorId !== ctx.user.id) {
    find.visibilityList = ["PUBLIC", "PROTECTED"];
  }

  const byUser = new Map<number, UserStats>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const rows = await listMemos(ctx.env.DB, { ...find, limit: pageSize, offset });
    for (const [userId, stats] of aggregate(rows)) {
      const existing = byUser.get(userId);
      if (!existing) {
        byUser.set(userId, stats);
      } else {
        // Merge page into accumulated stats.
        existing.memoCreatedTimestamps.push(...stats.memoCreatedTimestamps);
        existing.memoUpdatedTimestamps.push(...stats.memoUpdatedTimestamps);
        existing.totalMemoCount += stats.totalMemoCount;
        existing.pinnedMemos.push(...stats.pinnedMemos);
        for (const [tag, count] of Object.entries(stats.tagCount)) {
          existing.tagCount[tag] = (existing.tagCount[tag] ?? 0) + count;
        }
        if (existing.memoTypeStats && stats.memoTypeStats) {
          existing.memoTypeStats.linkCount += stats.memoTypeStats.linkCount;
          existing.memoTypeStats.codeCount += stats.memoTypeStats.codeCount;
          existing.memoTypeStats.todoCount += stats.memoTypeStats.todoCount;
          existing.memoTypeStats.undoCount += stats.memoTypeStats.undoCount;
        }
      }
    }
    if (rows.length < pageSize) {
      break;
    }
  }

  const userIds = [...byUser.keys()];
  const users = userIds.length > 0 ? await listUsers(ctx.env.DB, { idList: userIds }) : [];
  const usernames = new Map(users.map((u) => [u.id, u.username]));
  const stats: UserStats[] = [];
  for (const [userId, userStats] of byUser) {
    const username = usernames.get(userId);
    if (!username) {
      throw new ConnectError("failed to resolve user stats name", Code.Internal);
    }
    userStats.name = `${buildUserName(username)}/stats`;
    stats.push(userStats);
  }
  return create(ListAllUserStatsResponseSchema, { stats });
}
