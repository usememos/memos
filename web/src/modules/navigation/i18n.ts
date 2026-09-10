/**
 * Module-local zh/en strings.
 *
 * Deliberately not added to `src/locales/*.json`: those files are the main
 * conflict surface on every upstream upgrade, and the navigation module owns
 * every string it renders. Only the active language is read from i18next.
 */

import { useTranslation } from "react-i18next";

export interface NavStrings {
  sidebarLabel: string;
  pageTitle: string;
  pageSubtitle: string;
  loading: string;
  emptyTitle: string;
  emptyBody: string;
  degradedTitle: string;
  degradedBody: string;
  seededNote: string;
  retry: string;
  saving: string;
  saveFailed: string;
  collapse: string;
  expand: string;
  emptyGroup: string;
  searchPlaceholder: string;
  searchEmptyTitle: string;
  searchEmptyBody: string;
  clearSearch: string;
  searchKeyboardHint: string;
  clipboardAdd: string;
  clipboardEmpty: string;
  clipboardFailed: string;
  clipboardHistory: string;
  clipboardHistoryEmpty: string;
  clipboardHistoryHint: string;
  clipboardCopy: string;
  clipboardUse: string;
  clipboardRemove: string;
  clipboardCopied: string;
  clipboardRich: string;
  addCard: string;
  editCard: string;
  deleteCard: string;
  addGroup: string;
  renameGroup: string;
  deleteGroup: string;
  fieldTitle: string;
  fieldUrl: string;
  fieldNote: string;
  fieldGroup: string;
  fieldName: string;
  save: string;
  cancel: string;
  delete: string;
  confirm: string;
  titleRequired: string;
  urlInvalid: string;
  urlDuplicate: string;
  nameRequired: string;
  deleteCardConfirm: string;
  deleteGroupConfirm: string;
  editActions: string;
}

const STRINGS: Record<"zh" | "en", NavStrings> = {
  zh: {
    sidebarLabel: "导航",
    pageTitle: "导航",
    pageSubtitle: "把常用站点收成一张可以拖拽整理的卡片墙。",
    loading: "正在加载导航配置…",
    emptyTitle: "还没有导航卡片",
    emptyBody: "配置文件缺失，点「重试」重新加载；若仍失败，可删除归档里的配置备忘后再次打开本页。",
    degradedTitle: "离线缓存模式",
    degradedBody: "无法连接服务，当前展示本地缓存的配置，改动不会保存。",
    seededNote: "首次访问已写入默认配置（一条归档 + 私密备忘）。",
    retry: "重试",
    saving: "保存中…",
    saveFailed: "保存失败：处于离线模式，改动未保存。",
    collapse: "折叠",
    expand: "展开",
    emptyGroup: "这个分组还没有卡片。",
    searchPlaceholder: "搜索标题、链接或备注…",
    searchEmptyTitle: "没有匹配的卡片",
    searchEmptyBody: "没有卡片匹配当前关键词，试试别的。",
    clearSearch: "清除搜索",
    searchKeyboardHint: "/ 聚焦搜索 · Ctrl+Q 快速搜索 · ↓↑ 移动 · Enter 打开 · Esc 清除",
    clipboardAdd: "从剪贴板添加",
    clipboardEmpty: "剪贴板是空的",
    clipboardFailed: "无法读取剪贴板",
    clipboardHistory: "剪贴板",
    clipboardHistoryEmpty: "暂无记录。复制或粘贴到搜索框后会出现在这里。",
    clipboardHistoryHint: "24 小时后自动清理",
    clipboardCopy: "复制",
    clipboardUse: "使用",
    clipboardRemove: "移除",
    clipboardCopied: "已复制",
    clipboardRich: "图文",
    addCard: "添加卡片",
    editCard: "编辑卡片",
    deleteCard: "删除卡片",
    addGroup: "添加分组",
    renameGroup: "重命名分组",
    deleteGroup: "删除分组",
    fieldTitle: "标题",
    fieldUrl: "链接",
    fieldNote: "备注",
    fieldGroup: "分组",
    fieldName: "分组名称",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    confirm: "确认",
    titleRequired: "请填写标题。",
    urlInvalid: "请输入有效的 http(s) 链接。",
    urlDuplicate: "该链接已存在。",
    nameRequired: "请填写分组名称。",
    deleteCardConfirm: "确定删除这张卡片？",
    deleteGroupConfirm: "确定删除该分组及其全部卡片？",
    editActions: "卡片操作",
  },
  en: {
    sidebarLabel: "Navigation",
    pageTitle: "Navigation",
    pageSubtitle: "Your bookmarks as a card wall you can drag into shape.",
    loading: "Loading navigation config…",
    emptyTitle: "No cards yet",
    emptyBody: "The config memo is missing. Retry to reload; if it still fails, delete the config memo in Archive and reopen this page.",
    degradedTitle: "Offline cache",
    degradedBody: "The service is unreachable; showing the locally cached config. Edits are not saved.",
    seededNote: "First visit: wrote the default config (an archived, private memo).",
    retry: "Retry",
    saving: "Saving…",
    saveFailed: "Save failed: offline mode, changes were not saved.",
    collapse: "Collapse",
    expand: "Expand",
    emptyGroup: "This group has no cards yet.",
    searchPlaceholder: "Search title, URL or note…",
    searchEmptyTitle: "No matching cards",
    searchEmptyBody: "No cards match the current query. Try another.",
    clearSearch: "Clear search",
    searchKeyboardHint: "/ to focus · Ctrl+Q quick search · ↓↑ move · Enter open · Esc clear",
    clipboardAdd: "Add from clipboard",
    clipboardEmpty: "Clipboard is empty",
    clipboardFailed: "Could not read clipboard",
    clipboardHistory: "Clipboard",
    clipboardHistoryEmpty: "No items yet. Copied text or pastes into search appear here.",
    clipboardHistoryHint: "Auto-clears after 24 hours",
    clipboardCopy: "Copy",
    clipboardUse: "Use",
    clipboardRemove: "Remove",
    clipboardCopied: "Copied",
    clipboardRich: "Rich",
    addCard: "Add card",
    editCard: "Edit card",
    deleteCard: "Delete card",
    addGroup: "Add group",
    renameGroup: "Rename group",
    deleteGroup: "Delete group",
    fieldTitle: "Title",
    fieldUrl: "URL",
    fieldNote: "Note",
    fieldGroup: "Group",
    fieldName: "Group name",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm: "Confirm",
    titleRequired: "Title is required.",
    urlInvalid: "Enter a valid http(s) URL.",
    urlDuplicate: "That URL already exists.",
    nameRequired: "Group name is required.",
    deleteCardConfirm: "Delete this card?",
    deleteGroupConfirm: "Delete this group and all of its cards?",
    editActions: "Card actions",
  },
};

const resolveLocale = (language?: string): "zh" | "en" => ((language ?? "").toLowerCase().startsWith("zh") ? "zh" : "en");

export const navStrings = (language?: string): NavStrings => STRINGS[resolveLocale(language)];

/** Re-renders on language change; safe to call from upstream components. */
export const useNavStrings = (): NavStrings => {
  const { i18n } = useTranslation();
  return navStrings(i18n.resolvedLanguage ?? i18n.language);
};
