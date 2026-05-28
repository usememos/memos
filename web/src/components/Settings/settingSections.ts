import {
  BarChart3Icon,
  CogIcon,
  DatabaseIcon,
  HeartHandshakeIcon,
  KeyIcon,
  LibraryIcon,
  type LucideIcon,
  MailIcon,
  Settings2Icon,
  TagsIcon,
  UserIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import { type ComponentType } from "react";
import AISection from "@/components/Settings/AISection";
import InstanceSection from "@/components/Settings/InstanceSection";
import MemberSection from "@/components/Settings/MemberSection";
import MemoRelatedSettings from "@/components/Settings/MemoRelatedSettings";
import MyAccountSection from "@/components/Settings/MyAccountSection";
import NotificationSection from "@/components/Settings/NotificationSection";
import PreferencesSection from "@/components/Settings/PreferencesSection";
import ResourceStatsSection from "@/components/Settings/ResourceStatsSection";
import SSOSection from "@/components/Settings/SSOSection";
import StorageSection from "@/components/Settings/StorageSection";
import TagsSection from "@/components/Settings/TagsSection";
import WebhookSection from "@/components/Settings/WebhookSection";
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";

export type SettingSectionKey =
  | "my-account"
  | "preference"
  | "webhook"
  | "member"
  | "system"
  | "memo"
  | "storage"
  | "notification"
  | "sso"
  | "tags"
  | "ai"
  | "resource-stats";

type SettingSectionScope = "basic" | "admin";

export interface SettingSectionDefinition {
  key: SettingSectionKey;
  scope: SettingSectionScope;
  labelKey: `setting.${SettingSectionKey}.label`;
  icon: LucideIcon;
  component: ComponentType;
  preloadSettingKeys?: InstanceSetting_Key[];
}

export const SETTINGS_SECTIONS: SettingSectionDefinition[] = [
  {
    key: "my-account",
    scope: "basic",
    labelKey: "setting.my-account.label",
    icon: UserIcon,
    component: MyAccountSection,
  },
  {
    key: "preference",
    scope: "basic",
    labelKey: "setting.preference.label",
    icon: CogIcon,
    component: PreferencesSection,
  },
  {
    key: "webhook",
    scope: "basic",
    labelKey: "setting.webhook.label",
    icon: WebhookIcon,
    component: WebhookSection,
  },
  {
    key: "member",
    scope: "admin",
    labelKey: "setting.member.label",
    icon: UsersIcon,
    component: MemberSection,
  },
  {
    key: "system",
    scope: "admin",
    labelKey: "setting.system.label",
    icon: Settings2Icon,
    component: InstanceSection,
  },
  {
    key: "memo",
    scope: "admin",
    labelKey: "setting.memo.label",
    icon: LibraryIcon,
    component: MemoRelatedSettings,
  },
  {
    key: "tags",
    scope: "admin",
    labelKey: "setting.tags.label",
    icon: TagsIcon,
    component: TagsSection,
    preloadSettingKeys: [InstanceSetting_Key.TAGS],
  },
  {
    key: "storage",
    scope: "admin",
    labelKey: "setting.storage.label",
    icon: DatabaseIcon,
    component: StorageSection,
    preloadSettingKeys: [InstanceSetting_Key.STORAGE],
  },
  {
    key: "notification",
    scope: "admin",
    labelKey: "setting.notification.label",
    icon: MailIcon,
    component: NotificationSection,
    preloadSettingKeys: [InstanceSetting_Key.NOTIFICATION],
  },
  {
    key: "sso",
    scope: "admin",
    labelKey: "setting.sso.label",
    icon: KeyIcon,
    component: SSOSection,
  },
  {
    key: "ai",
    scope: "admin",
    labelKey: "setting.ai.label",
    icon: HeartHandshakeIcon,
    component: AISection,
    preloadSettingKeys: [InstanceSetting_Key.AI],
  },
  {
    key: "resource-stats",
    scope: "admin",
    labelKey: "setting.resource-stats.label",
    icon: BarChart3Icon,
    component: ResourceStatsSection,
  },
];

export const DEFAULT_SETTING_SECTION: SettingSectionKey = "my-account";

export const isSettingSectionKey = (value: string): value is SettingSectionKey => {
  return SETTINGS_SECTIONS.some((section) => section.key === value);
};
