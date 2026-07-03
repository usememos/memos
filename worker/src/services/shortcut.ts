import { create, fromJsonString, toJsonString } from "@bufbuild/protobuf";
import { EmptySchema } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter } from "@connectrpc/connect";
import {
  ListShortcutsResponseSchema,
  ShortcutSchema,
  ShortcutService,
  type Shortcut,
} from "../gen/api/v1/shortcut_service_pb";
import {
  ShortcutsUserSettingSchema,
  ShortcutsUserSetting_ShortcutSchema,
  type ShortcutsUserSetting,
} from "../gen/store/user_setting_pb";
import { getUserSetting, upsertUserSetting } from "../store/settings";
import { getUser, type UserRow } from "../store/users";
import { MEMO_FILTER_SCHEMA, renderFilter } from "../filter/render";
import { FilterError } from "../filter/cel";
import type { ServiceContext } from "./context";
import { requireUser } from "./context";
import { generateUid } from "./memo";

const SETTING_KEY = "SHORTCUTS";

async function loadShortcuts(ctx: ServiceContext, userId: number): Promise<ShortcutsUserSetting> {
  const row = await getUserSetting(ctx.env.DB, userId, SETTING_KEY);
  return row
    ? fromJsonString(ShortcutsUserSettingSchema, row.value, { ignoreUnknownFields: true })
    : create(ShortcutsUserSettingSchema);
}

async function saveShortcuts(ctx: ServiceContext, userId: number, setting: ShortcutsUserSetting): Promise<void> {
  await upsertUserSetting(ctx.env.DB, userId, SETTING_KEY, toJsonString(ShortcutsUserSettingSchema, setting));
}

// users/{user}/shortcuts/{shortcut}
function parseShortcutName(name: string): { username: string; shortcutId: string } {
  const match = /^users\/([^/]+)\/shortcuts\/(.+)$/.exec(name);
  if (!match || !match[1] || !match[2]) {
    throw new ConnectError(`invalid shortcut name: ${name}`, Code.InvalidArgument);
  }
  return { username: match[1], shortcutId: match[2] };
}

async function requireOwner(ctx: ServiceContext, username: string): Promise<UserRow> {
  const currentUser = requireUser(ctx);
  const user = await getUser(ctx.env.DB, { username });
  if (!user) {
    throw new ConnectError("user not found", Code.NotFound);
  }
  if (user.id !== currentUser.id) {
    throw new ConnectError("permission denied", Code.PermissionDenied);
  }
  return user;
}

function validateShortcutFilter(filter: string): void {
  if (filter.trim() === "") {
    throw new ConnectError("filter is required", Code.InvalidArgument);
  }
  try {
    renderFilter(filter, MEMO_FILTER_SCHEMA);
  } catch (error) {
    if (error instanceof FilterError) {
      throw new ConnectError(`invalid filter: ${error.message}`, Code.InvalidArgument);
    }
    throw error;
  }
}

function convert(username: string, shortcut: { id: string; title: string; filter: string }): Shortcut {
  return create(ShortcutSchema, {
    name: `users/${username}/shortcuts/${shortcut.id}`,
    title: shortcut.title,
    filter: shortcut.filter,
  });
}

export function registerShortcutService(router: ConnectRouter, ctx: ServiceContext): void {
  router.service(ShortcutService, {
    async listShortcuts(request) {
      const match = /^users\/([^/]+)$/.exec(request.parent);
      if (!match || !match[1]) {
        throw new ConnectError(`invalid parent: ${request.parent}`, Code.InvalidArgument);
      }
      const user = await requireOwner(ctx, match[1]);
      const setting = await loadShortcuts(ctx, user.id);
      return create(ListShortcutsResponseSchema, {
        shortcuts: setting.shortcuts.map((s) => convert(user.username, s)),
      });
    },

    async getShortcut(request) {
      const { username, shortcutId } = parseShortcutName(request.name);
      const user = await requireOwner(ctx, username);
      const setting = await loadShortcuts(ctx, user.id);
      const shortcut = setting.shortcuts.find((s) => s.id === shortcutId);
      if (!shortcut) {
        throw new ConnectError("shortcut not found", Code.NotFound);
      }
      return convert(user.username, shortcut);
    },

    async createShortcut(request) {
      const match = /^users\/([^/]+)$/.exec(request.parent);
      if (!match || !match[1]) {
        throw new ConnectError(`invalid parent: ${request.parent}`, Code.InvalidArgument);
      }
      if (!request.shortcut) {
        throw new ConnectError("shortcut is required", Code.InvalidArgument);
      }
      const user = await requireOwner(ctx, match[1]);
      validateShortcutFilter(request.shortcut.filter);
      const setting = await loadShortcuts(ctx, user.id);
      const created = create(ShortcutsUserSetting_ShortcutSchema, {
        id: generateUid(),
        title: request.shortcut.title,
        filter: request.shortcut.filter,
      });
      setting.shortcuts.push(created);
      await saveShortcuts(ctx, user.id, setting);
      return convert(user.username, created);
    },

    async updateShortcut(request) {
      if (!request.shortcut) {
        throw new ConnectError("shortcut is required", Code.InvalidArgument);
      }
      const { username, shortcutId } = parseShortcutName(request.shortcut.name);
      const user = await requireOwner(ctx, username);
      const setting = await loadShortcuts(ctx, user.id);
      const existing = setting.shortcuts.find((s) => s.id === shortcutId);
      if (!existing) {
        throw new ConnectError("shortcut not found", Code.NotFound);
      }
      const paths = request.updateMask?.paths ?? ["title", "filter"];
      for (const path of paths) {
        if (path === "title") {
          existing.title = request.shortcut.title;
        } else if (path === "filter") {
          validateShortcutFilter(request.shortcut.filter);
          existing.filter = request.shortcut.filter;
        }
      }
      await saveShortcuts(ctx, user.id, setting);
      return convert(user.username, existing);
    },

    async deleteShortcut(request) {
      const { username, shortcutId } = parseShortcutName(request.name);
      const user = await requireOwner(ctx, username);
      const setting = await loadShortcuts(ctx, user.id);
      setting.shortcuts = setting.shortcuts.filter((s) => s.id !== shortcutId);
      await saveShortcuts(ctx, user.id, setting);
      return create(EmptySchema);
    },
  });
}
