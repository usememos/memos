import { create } from "@bufbuild/protobuf";
import { EmptySchema } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter } from "@connectrpc/connect";
import {
  BatchGetLinkMetadataResponseSchema,
  LinkMetadataSchema,
  ListMemoAttachmentsResponseSchema,
  ListMemoCommentsResponseSchema,
  ListMemoReactionsResponseSchema,
  ListMemoRelationsResponseSchema,
  ListMemoSharesResponseSchema,
  ListMemosResponseSchema,
  MemoRelationSchema,
  MemoRelation_MemoSchema,
  MemoRelation_Type,
  MemoSchema,
  MemoShareSchema,
  Memo_PropertySchema,
  LocationSchema,
  MemoService,
  ReactionSchema,
  Visibility as VisibilityPb,
  type Memo,
  type MemoRelation,
  type Reaction,
} from "../gen/api/v1/memo_service_pb";
import { MemoPayload_LocationSchema, MemoPayload_PropertySchema } from "../gen/store/memo_pb";
import { FilterError } from "../filter/cel";
import { MEMO_FILTER_SCHEMA, renderFilter } from "../filter/render";
import { extractAll, generateSnippet } from "../markdown/extract";
import {
  collectMemoTreeIds,
  createMemo,
  createMemoShare,
  deleteMemoRelations,
  deleteMemoShare,
  deleteReaction,
  emptyPayload,
  getMemo,
  getReaction,
  listMemoRelations,
  listMemoShares,
  listMemos,
  listReactions,
  updateMemo,
  upsertMemoRelation,
  upsertReaction,
  type MemoRelationRow,
  type MemoRow,
  type ReactionRow,
  type RelationType,
  type Visibility,
} from "../store/memos";
import { getAttachment, listAttachments, updateAttachment, type AttachmentRow } from "../store/attachments";
import { listUsers, type UserRow } from "../store/users";
import { attachmentUidFromName, convertAttachment } from "./attachment";
import { dispatchMemoWebhooks } from "../lib/webhook";
import { dispatchCommentNotification, dispatchMentionNotifications } from "../lib/notifications";
import type { ServiceContext } from "./context";
import { requireUser } from "./context";
import { buildUserName, stateFromRowStatus, rowStatusFromState, tsFromUnix } from "./convert";

export const MEMO_NAME_PREFIX = "memos/";
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 1000;
const DEFAULT_CONTENT_LENGTH_LIMIT = 8 * 1024;
const SNIPPET_LENGTH = 64;

export function memoUidFromName(name: string): string {
  const match = /^memos\/(.+)$/.exec(name);
  if (!match || !match[1]) {
    throw new ConnectError(`invalid memo name: ${name}`, Code.InvalidArgument);
  }
  return match[1];
}

export function generateUid(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(22));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

function visibilityToStore(v: VisibilityPb): Visibility {
  switch (v) {
    case VisibilityPb.PUBLIC:
      return "PUBLIC";
    case VisibilityPb.PROTECTED:
      return "PROTECTED";
    default:
      return "PRIVATE";
  }
}

function visibilityFromStore(v: Visibility): VisibilityPb {
  switch (v) {
    case "PUBLIC":
      return VisibilityPb.PUBLIC;
    case "PROTECTED":
      return VisibilityPb.PROTECTED;
    default:
      return VisibilityPb.PRIVATE;
  }
}

interface PageToken {
  limit: number;
  offset: number;
}

function encodePageToken(token: PageToken): string {
  return btoa(JSON.stringify(token));
}

function decodePageToken(raw: string): PageToken {
  try {
    const parsed = JSON.parse(atob(raw)) as PageToken;
    if (typeof parsed.limit !== "number" || typeof parsed.offset !== "number") {
      throw new Error("bad shape");
    }
    return parsed;
  } catch {
    throw new ConnectError("invalid page token", Code.InvalidArgument);
  }
}

async function loadCreators(ctx: ServiceContext, creatorIds: number[]): Promise<Map<number, UserRow>> {
  const unique = [...new Set(creatorIds)];
  if (unique.length === 0) {
    return new Map();
  }
  const users = await listUsers(ctx.env.DB, { idList: unique });
  return new Map(users.map((u) => [u.id, u]));
}

function convertReaction(row: ReactionRow, creators: Map<number, UserRow>): Reaction {
  const creator = creators.get(row.creator_id);
  return create(ReactionSchema, {
    name: `reactions/${row.id}`,
    creator: creator ? buildUserName(creator.username) : "",
    contentId: row.content_id,
    reactionType: row.reaction_type,
    createTime: tsFromUnix(row.created_ts),
  });
}

interface RelationContext {
  /** uid + snippet keyed by memo id, for both sides of relations. */
  memoInfo: Map<number, { uid: string; snippet: string }>;
}

async function buildRelationContext(ctx: ServiceContext, relations: MemoRelationRow[]): Promise<RelationContext> {
  const ids = [...new Set(relations.flatMap((r) => [r.memo_id, r.related_memo_id]))];
  const memoInfo = new Map<number, { uid: string; snippet: string }>();
  if (ids.length > 0) {
    const result = await ctx.env.DB.prepare(
      `SELECT id, uid, content FROM memo WHERE id IN (${ids.map(() => "?").join(", ")})`,
    )
      .bind(...ids)
      .all<{ id: number; uid: string; content: string }>();
    for (const row of result.results) {
      memoInfo.set(row.id, { uid: row.uid, snippet: generateSnippet(row.content, SNIPPET_LENGTH) });
    }
  }
  return { memoInfo };
}

function convertRelation(row: MemoRelationRow, rc: RelationContext): MemoRelation {
  const memo = rc.memoInfo.get(row.memo_id);
  const related = rc.memoInfo.get(row.related_memo_id);
  return create(MemoRelationSchema, {
    memo: create(MemoRelation_MemoSchema, {
      name: memo ? `${MEMO_NAME_PREFIX}${memo.uid}` : "",
      snippet: memo?.snippet ?? "",
    }),
    relatedMemo: create(MemoRelation_MemoSchema, {
      name: related ? `${MEMO_NAME_PREFIX}${related.uid}` : "",
      snippet: related?.snippet ?? "",
    }),
    type: row.type === "COMMENT" ? MemoRelation_Type.COMMENT : MemoRelation_Type.REFERENCE,
  });
}

export interface ConvertMemoExtras {
  creators: Map<number, UserRow>;
  reactions: ReactionRow[];
  relations: MemoRelationRow[];
  relationContext: RelationContext;
  attachments?: AttachmentRow[];
}

export function convertMemo(row: MemoRow, extras: ConvertMemoExtras): Memo {
  const creator = extras.creators.get(row.creator_id);
  const property = row.payload.property;
  const location = row.payload.location;
  return create(MemoSchema, {
    name: `${MEMO_NAME_PREFIX}${row.uid}`,
    state: stateFromRowStatus(row.row_status),
    creator: creator ? buildUserName(creator.username) : "",
    createTime: tsFromUnix(row.created_ts),
    updateTime: tsFromUnix(row.updated_ts),
    content: row.content,
    visibility: visibilityFromStore(row.visibility),
    tags: row.payload.tags,
    pinned: row.pinned === 1,
    attachments: (extras.attachments ?? []).map((a) => convertAttachment(a, row.uid)),
    relations: extras.relations.map((r) => convertRelation(r, extras.relationContext)),
    reactions: extras.reactions.map((r) => convertReaction(r, extras.creators)),
    property: property
      ? create(Memo_PropertySchema, {
          hasLink: property.hasLink,
          hasTaskList: property.hasTaskList,
          hasCode: property.hasCode,
          hasIncompleteTasks: property.hasIncompleteTasks,
          title: property.title,
        })
      : undefined,
    parent: row.parent_uid ? `${MEMO_NAME_PREFIX}${row.parent_uid}` : undefined,
    snippet: generateSnippet(row.content, SNIPPET_LENGTH),
    location: location
      ? create(LocationSchema, { placeholder: location.placeholder, latitude: location.latitude, longitude: location.longitude })
      : undefined,
  });
}

// Loads reactions/relations/creators for a batch of memos and converts them.
export async function convertMemos(ctx: ServiceContext, rows: MemoRow[]): Promise<Memo[]> {
  if (rows.length === 0) {
    return [];
  }
  const contentIds = rows.map((r) => `${MEMO_NAME_PREFIX}${r.uid}`);
  const reactions = await listReactions(ctx.env.DB, contentIds);
  const relations = await listMemoRelations(ctx.env.DB, { memoIdList: rows.map((r) => r.id) });
  const relationContext = await buildRelationContext(ctx, relations);
  const attachments = await listAttachments(ctx.env.DB, { memoIdList: rows.map((r) => r.id) });
  const creators = await loadCreators(ctx, [...rows.map((r) => r.creator_id), ...reactions.map((r) => r.creator_id)]);

  return rows.map((row) => {
    const name = `${MEMO_NAME_PREFIX}${row.uid}`;
    return convertMemo(row, {
      creators,
      reactions: reactions.filter((r) => r.content_id === name),
      relations: relations.filter((r) => r.memo_id === row.id || r.related_memo_id === row.id),
      relationContext,
      attachments: attachments.filter((a) => a.memo_id === row.id),
    });
  });
}

function rebuildPayload(row: { content: string; payload: MemoRow["payload"] }): void {
  const extracted = extractAll(row.content);
  row.payload.tags = extracted.tags;
  row.payload.property = create(MemoPayload_PropertySchema, {
    hasLink: extracted.property.hasLink,
    hasTaskList: extracted.property.hasTaskList,
    hasCode: extracted.property.hasCode,
    hasIncompleteTasks: extracted.property.hasIncompleteTasks,
    title: extracted.property.title,
  });
}

async function checkMemoReadAccess(ctx: ServiceContext, memo: MemoRow | undefined): Promise<MemoRow> {
  if (!memo) {
    throw new ConnectError("memo not found", Code.NotFound);
  }
  if (memo.row_status === "ARCHIVED" && (!ctx.user || memo.creator_id !== ctx.user.id)) {
    throw new ConnectError("memo not found", Code.NotFound);
  }
  if (memo.visibility !== "PUBLIC") {
    if (!ctx.user) {
      throw new ConnectError("user not authenticated", Code.Unauthenticated);
    }
    if (memo.visibility === "PRIVATE" && memo.creator_id !== ctx.user.id) {
      throw new ConnectError("permission denied", Code.PermissionDenied);
    }
  }
  return memo;
}

function requireMemoWriteAccess(ctx: ServiceContext, memo: MemoRow): UserRow {
  const user = requireUser(ctx);
  if (memo.creator_id !== user.id && user.role !== "ADMIN") {
    throw new ConnectError("permission denied", Code.PermissionDenied);
  }
  return user;
}

function validateFilter(filter: string): void {
  try {
    renderFilter(filter, MEMO_FILTER_SCHEMA);
  } catch (error) {
    if (error instanceof FilterError) {
      throw new ConnectError(`invalid filter: ${error.message}`, Code.InvalidArgument);
    }
    throw error;
  }
}

async function fetchLinkMetadata(link: string): Promise<{ title: string; description: string; image: string }> {
  const response = await fetch(link, {
    headers: { "User-Agent": "memos-bot/1.0", Accept: "text/html" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new ConnectError(`failed to fetch link: ${response.status}`, Code.Internal);
  }
  const html = (await response.text()).slice(0, 512 * 1024);
  const pick = (patterns: RegExp[]): string => {
    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return "";
  };
  const meta = (name: string) =>
    new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i");
  const metaReversed = (name: string) =>
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i");
  return {
    title: pick([meta("og:title"), metaReversed("og:title"), /<title[^>]*>([^<]*)<\/title>/i]),
    description: pick([meta("og:description"), metaReversed("og:description"), meta("description"), metaReversed("description")]),
    image: pick([meta("og:image"), metaReversed("og:image")]),
  };
}

export function registerMemoService(router: ConnectRouter, ctx: ServiceContext): void {
  const db = ctx.env.DB;

  async function resolveMemo(name: string): Promise<MemoRow | undefined> {
    return getMemo(db, { uid: memoUidFromName(name) });
  }

  async function createMemoInternal(request: {
    content: string;
    visibility: VisibilityPb;
    createTime?: { seconds: bigint } | undefined;
    updateTime?: { seconds: bigint } | undefined;
    location?: { placeholder: string; latitude: number; longitude: number } | undefined;
    memoId?: string;
  }): Promise<MemoRow> {
    const user = requireUser(ctx);
    if (request.memoId && !/^[a-zA-Z0-9-]{16,}$/.test(request.memoId)) {
      throw new ConnectError("invalid memo_id", Code.InvalidArgument);
    }
    if (request.content.length > DEFAULT_CONTENT_LENGTH_LIMIT) {
      throw new ConnectError(`content too long (max ${DEFAULT_CONTENT_LENGTH_LIMIT} characters)`, Code.InvalidArgument);
    }
    const payload = emptyPayload();
    const row = {
      content: request.content,
      payload,
    };
    rebuildPayload(row);
    if (request.location) {
      payload.location = create(MemoPayload_LocationSchema, {
        placeholder: request.location.placeholder,
        latitude: request.location.latitude,
        longitude: request.location.longitude,
      });
    }
    try {
      return await createMemo(db, {
        uid: request.memoId || generateUid(),
        creatorId: user.id,
        content: request.content,
        visibility: visibilityToStore(request.visibility),
        payload,
        createdTs: request.createTime ? Number(request.createTime.seconds) : undefined,
        updatedTs: request.updateTime ? Number(request.updateTime.seconds) : undefined,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw new ConnectError(`memo with ID ${request.memoId} already exists`, Code.AlreadyExists);
      }
      throw error;
    }
  }

  router.service(MemoService, {
    async createMemo(request) {
      if (!request.memo) {
        throw new ConnectError("memo is required", Code.InvalidArgument);
      }
      const row = await createMemoInternal({ ...request.memo, memoId: request.memoId });
      // Relations provided inline at creation.
      for (const relation of request.memo.relations) {
        const related = await resolveMemo(relation.relatedMemo?.name ?? "");
        if (related) {
          await upsertMemoRelation(db, {
            memo_id: row.id,
            related_memo_id: related.id,
            type: relation.type === MemoRelation_Type.COMMENT ? "COMMENT" : "REFERENCE",
          });
        }
      }
      const [memo] = await convertMemos(ctx, [row]);
      ctx.waitUntil(dispatchMemoWebhooks(db, "memos.memo.created", memo!, row.creator_id));
      ctx.waitUntil(dispatchMentionNotifications(ctx, row, extractAll(row.content).mentions));
      return memo!;
    },

    async listMemos(request) {
      const find: Parameters<typeof listMemos>[1] = { excludeComments: true, filters: [] };
      if (request.state === stateFromRowStatus("ARCHIVED")) {
        if (!ctx.user) {
          return create(ListMemosResponseSchema, {});
        }
        find.rowStatus = "ARCHIVED";
        find.creatorId = ctx.user.id;
      } else {
        find.rowStatus = "NORMAL";
      }

      if (request.orderBy) {
        for (const clause of request.orderBy.split(",").map((c) => c.trim().toLowerCase())) {
          const [field, direction] = clause.split(/\s+/);
          if (field === "pinned") {
            find.orderByPinned = true;
          } else if (field === "update_time") {
            find.orderByUpdatedTs = true;
            find.orderByTimeAsc = direction === "asc";
          } else if (field === "create_time" || field === "display_time") {
            find.orderByTimeAsc = direction === "asc";
          } else if (field) {
            throw new ConnectError(`unsupported order_by field: ${field}`, Code.InvalidArgument);
          }
        }
      }

      if (request.filter) {
        validateFilter(request.filter);
        find.filters!.push(request.filter);
      }
      if (!ctx.user) {
        find.visibilityList = ["PUBLIC"];
      } else if (find.creatorId === undefined) {
        find.filters!.push(`creator_id == ${ctx.user.id} || visibility in ["PUBLIC", "PROTECTED"]`);
      }

      let limit: number;
      let offset = 0;
      if (request.pageToken) {
        const token = decodePageToken(request.pageToken);
        limit = token.limit;
        offset = Math.max(token.offset, 0);
      } else {
        limit = request.pageSize > 0 ? request.pageSize : DEFAULT_PAGE_SIZE;
      }
      limit = Math.min(limit, MAX_PAGE_SIZE);

      find.limit = limit + 1;
      find.offset = offset;
      let rows = await listMemos(db, find);
      let nextPageToken = "";
      if (rows.length === limit + 1) {
        rows = rows.slice(0, limit);
        nextPageToken = encodePageToken({ limit, offset: offset + limit });
      }
      return create(ListMemosResponseSchema, {
        memos: await convertMemos(ctx, rows),
        nextPageToken,
      });
    },

    async getMemo(request) {
      const memo = await checkMemoReadAccess(ctx, await resolveMemo(request.name));
      const [converted] = await convertMemos(ctx, [memo]);
      return converted!;
    },

    async updateMemo(request) {
      if (!request.memo || !request.updateMask || request.updateMask.paths.length === 0) {
        throw new ConnectError("memo and update_mask are required", Code.InvalidArgument);
      }
      const memo = await resolveMemo(request.memo.name);
      if (!memo) {
        throw new ConnectError("memo not found", Code.NotFound);
      }
      requireMemoWriteAccess(ctx, memo);
      const update: Parameters<typeof updateMemo>[1] = { id: memo.id, updatedTs: Math.floor(Date.now() / 1000) };
      for (const path of request.updateMask.paths) {
        switch (path) {
          case "content": {
            if (request.memo.content.length > DEFAULT_CONTENT_LENGTH_LIMIT) {
              throw new ConnectError("content too long", Code.InvalidArgument);
            }
            update.content = request.memo.content;
            const rebuilt = { content: request.memo.content, payload: memo.payload };
            rebuildPayload(rebuilt);
            update.payload = memo.payload;
            break;
          }
          case "visibility":
            update.visibility = visibilityToStore(request.memo.visibility);
            break;
          case "state":
            update.rowStatus = rowStatusFromState(request.memo.state);
            break;
          case "pinned":
            update.pinned = request.memo.pinned;
            break;
          case "create_time":
            update.createdTs = request.memo.createTime ? Number(request.memo.createTime.seconds) : undefined;
            break;
          case "update_time":
            update.updatedTs = request.memo.updateTime ? Number(request.memo.updateTime.seconds) : update.updatedTs;
            break;
          case "location":
            memo.payload.location = request.memo.location
              ? create(MemoPayload_LocationSchema, {
                  placeholder: request.memo.location.placeholder,
                  latitude: request.memo.location.latitude,
                  longitude: request.memo.location.longitude,
                })
              : undefined;
            update.payload = memo.payload;
            break;
          case "attachments":
          case "relations":
            // Handled via SetMemoAttachments / SetMemoRelations.
            break;
          default:
            throw new ConnectError(`invalid update path: ${path}`, Code.InvalidArgument);
        }
      }
      await updateMemo(db, update);
      const updated = await getMemo(db, { id: memo.id });
      const [converted] = await convertMemos(ctx, [updated!]);
      ctx.waitUntil(dispatchMemoWebhooks(db, "memos.memo.updated", converted!, memo.creator_id));
      return converted!;
    },

    async deleteMemo(request) {
      const memo = await resolveMemo(request.name);
      if (!memo) {
        throw new ConnectError("memo not found", Code.NotFound);
      }
      requireMemoWriteAccess(ctx, memo);
      const ids = await collectMemoTreeIds(db, memo.id);
      const idList = ids.join(", ");
      const attachmentRows = await db
        .prepare(`SELECT r2_key FROM attachment WHERE memo_id IN (${idList}) AND r2_key != ''`)
        .all<{ r2_key: string }>();
      await db.batch([
        db.prepare(`DELETE FROM reaction WHERE content_id IN (SELECT 'memos/' || uid FROM memo WHERE id IN (${idList}))`),
        db.prepare(`DELETE FROM attachment WHERE memo_id IN (${idList})`),
        db.prepare(`DELETE FROM memo_relation WHERE memo_id IN (${idList}) OR related_memo_id IN (${idList})`),
        db.prepare(`DELETE FROM memo_share WHERE memo_id IN (${idList})`),
        db.prepare(`DELETE FROM memo WHERE id IN (${idList})`),
      ]);
      const keys = attachmentRows.results.map((r) => r.r2_key);
      if (keys.length > 0) {
        await ctx.env.BUCKET.delete(keys);
      }
      return create(EmptySchema);
    },

    async setMemoAttachments(request) {
      const memo = await resolveMemo(request.name);
      if (!memo) {
        throw new ConnectError("memo not found", Code.NotFound);
      }
      requireMemoWriteAccess(ctx, memo);
      const wantedUids = request.attachments.map((a) => attachmentUidFromName(a.name));
      const current = await listAttachments(db, { memoId: memo.id });
      // Unlink attachments that are no longer referenced.
      for (const row of current) {
        if (!wantedUids.includes(row.uid)) {
          await updateAttachment(db, { id: row.id, memoId: null });
        }
      }
      for (const uid of wantedUids) {
        const row = await getAttachment(db, { uid });
        if (row) {
          await updateAttachment(db, { id: row.id, memoId: memo.id });
        }
      }
      return create(EmptySchema);
    },

    async listMemoAttachments(request) {
      const memo = await checkMemoReadAccess(ctx, await resolveMemo(request.name));
      const rows = await listAttachments(db, { memoId: memo.id });
      return create(ListMemoAttachmentsResponseSchema, {
        attachments: rows.map((row) => convertAttachment(row, memo.uid)),
      });
    },

    async setMemoRelations(request) {
      const memo = await resolveMemo(request.name);
      if (!memo) {
        throw new ConnectError("memo not found", Code.NotFound);
      }
      requireMemoWriteAccess(ctx, memo);
      // Replace REFERENCE relations; COMMENT relations are managed internally.
      await deleteMemoRelations(db, { memoId: memo.id, type: "REFERENCE" });
      for (const relation of request.relations) {
        if (relation.type === MemoRelation_Type.COMMENT) {
          continue;
        }
        const related = await resolveMemo(relation.relatedMemo?.name ?? "");
        if (related) {
          await upsertMemoRelation(db, { memo_id: memo.id, related_memo_id: related.id, type: "REFERENCE" });
        }
      }
      return create(EmptySchema);
    },

    async listMemoRelations(request) {
      const memo = await checkMemoReadAccess(ctx, await resolveMemo(request.name));
      const relations = await listMemoRelations(db, { memoId: memo.id });
      const relationContext = await buildRelationContext(ctx, relations);
      return create(ListMemoRelationsResponseSchema, {
        relations: relations.map((r) => convertRelation(r, relationContext)),
      });
    },

    async createMemoComment(request) {
      if (!request.comment) {
        throw new ConnectError("comment is required", Code.InvalidArgument);
      }
      const parent = await checkMemoReadAccess(ctx, await resolveMemo(request.name));
      const row = await createMemoInternal(request.comment);
      await upsertMemoRelation(db, { memo_id: row.id, related_memo_id: parent.id, type: "COMMENT" });
      const fresh = await getMemo(db, { id: row.id });
      ctx.waitUntil(dispatchCommentNotification(ctx, fresh!, parent));
      ctx.waitUntil(dispatchMentionNotifications(ctx, fresh!, extractAll(fresh!.content).mentions));
      const [converted] = await convertMemos(ctx, [fresh!]);
      return converted!;
    },

    async listMemoComments(request) {
      const memo = await checkMemoReadAccess(ctx, await resolveMemo(request.name));
      const relations = await listMemoRelations(db, { relatedMemoId: memo.id, type: "COMMENT" });
      const commentIds = relations.map((r) => r.memo_id);
      let rows = commentIds.length > 0 ? await listMemos(db, { filters: [], orderByTimeAsc: true }) : [];
      rows = rows.filter((r) => commentIds.includes(r.id));
      // Visibility: anonymous users see PUBLIC comments only.
      if (!ctx.user) {
        rows = rows.filter((r) => r.visibility === "PUBLIC");
      } else if (ctx.user.role !== "ADMIN") {
        rows = rows.filter((r) => r.visibility !== "PRIVATE" || r.creator_id === ctx.user!.id);
      }
      return create(ListMemoCommentsResponseSchema, { memos: await convertMemos(ctx, rows) });
    },

    async listMemoReactions(request) {
      const memo = await checkMemoReadAccess(ctx, await resolveMemo(request.name));
      const reactions = await listReactions(db, [`${MEMO_NAME_PREFIX}${memo.uid}`]);
      const creators = await loadCreators(ctx, reactions.map((r) => r.creator_id));
      return create(ListMemoReactionsResponseSchema, {
        reactions: reactions.map((r) => convertReaction(r, creators)),
      });
    },

    async upsertMemoReaction(request) {
      const user = requireUser(ctx);
      if (!request.reaction) {
        throw new ConnectError("reaction is required", Code.InvalidArgument);
      }
      await checkMemoReadAccess(ctx, await resolveMemo(request.name));
      const row = await upsertReaction(db, user.id, `${MEMO_NAME_PREFIX}${memoUidFromName(request.name)}`, request.reaction.reactionType);
      const creators = await loadCreators(ctx, [user.id]);
      return convertReaction(row, creators);
    },

    async deleteMemoReaction(request) {
      const user = requireUser(ctx);
      const match = /^reactions\/(\d+)$/.exec(request.name);
      if (!match) {
        throw new ConnectError(`invalid reaction name: ${request.name}`, Code.InvalidArgument);
      }
      const reaction = await getReaction(db, Number(match[1]));
      if (!reaction) {
        throw new ConnectError("reaction not found", Code.NotFound);
      }
      if (reaction.creator_id !== user.id && user.role !== "ADMIN") {
        throw new ConnectError("permission denied", Code.PermissionDenied);
      }
      await deleteReaction(db, reaction.id);
      return create(EmptySchema);
    },

    async createMemoShare(request) {
      const memo = await resolveMemo(request.parent);
      if (!memo) {
        throw new ConnectError("memo not found", Code.NotFound);
      }
      const user = requireMemoWriteAccess(ctx, memo);
      const expiresTs = request.memoShare?.expireTime ? Number(request.memoShare.expireTime.seconds) : undefined;
      const share = await createMemoShare(db, generateUid(), memo.id, user.id, expiresTs);
      return create(MemoShareSchema, {
        name: `${MEMO_NAME_PREFIX}${memo.uid}/shares/${share.uid}`,
        createTime: tsFromUnix(share.created_ts),
        expireTime: share.expires_ts ? tsFromUnix(share.expires_ts) : undefined,
      });
    },

    async listMemoShares(request) {
      const memo = await resolveMemo(request.parent);
      if (!memo) {
        throw new ConnectError("memo not found", Code.NotFound);
      }
      requireMemoWriteAccess(ctx, memo);
      const shares = await listMemoShares(db, { memoId: memo.id });
      return create(ListMemoSharesResponseSchema, {
        memoShares: shares.map((share) =>
          create(MemoShareSchema, {
            name: `${MEMO_NAME_PREFIX}${memo.uid}/shares/${share.uid}`,
            createTime: tsFromUnix(share.created_ts),
            expireTime: share.expires_ts ? tsFromUnix(share.expires_ts) : undefined,
          }),
        ),
      });
    },

    async deleteMemoShare(request) {
      const match = /^memos\/([^/]+)\/shares\/(.+)$/.exec(request.name);
      if (!match || !match[1] || !match[2]) {
        throw new ConnectError(`invalid share name: ${request.name}`, Code.InvalidArgument);
      }
      const memo = await getMemo(db, { uid: match[1] });
      if (!memo) {
        throw new ConnectError("memo not found", Code.NotFound);
      }
      requireMemoWriteAccess(ctx, memo);
      const shares = await listMemoShares(db, { memoId: memo.id, uid: match[2] });
      if (shares.length === 0) {
        throw new ConnectError("share not found", Code.NotFound);
      }
      await deleteMemoShare(db, shares[0]!.id);
      return create(EmptySchema);
    },

    async getMemoByShare(request) {
      const shares = await listMemoShares(db, { uid: request.shareId });
      const share = shares[0];
      if (!share || (share.expires_ts !== null && share.expires_ts < Math.floor(Date.now() / 1000))) {
        throw new ConnectError("share not found or expired", Code.NotFound);
      }
      const memo = await getMemo(db, { id: share.memo_id });
      if (!memo || memo.row_status === "ARCHIVED") {
        throw new ConnectError("memo not found", Code.NotFound);
      }
      const [converted] = await convertMemos(ctx, [memo]);
      return converted!;
    },

    async getLinkMetadata(request) {
      const metadata = await fetchLinkMetadata(request.url);
      return create(LinkMetadataSchema, { url: request.url, ...metadata });
    },

    async batchGetLinkMetadata(request) {
      const urls = request.urls.slice(0, 10);
      const results = await Promise.allSettled(urls.map((url) => fetchLinkMetadata(url)));
      return create(BatchGetLinkMetadataResponseSchema, {
        linkMetadata: results.flatMap((result, i) =>
          result.status === "fulfilled" ? [create(LinkMetadataSchema, { url: urls[i]!, ...result.value })] : [],
        ),
      });
    },
  });
}
