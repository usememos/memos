import { create } from "@bufbuild/protobuf";
import { Badge, Button, Checkbox, Field, Input, List, Tooltip } from "@usememos/ui";
import { isEqual } from "lodash-es";
import { EyeOffIcon, PaletteIcon, PlusIcon, TagIcon, TrashIcon } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTagCounts, useUpdateUserSetting } from "@/hooks/useUserQueries";
import { colorToHex } from "@/lib/color";
import { buildUserSettingName } from "@/lib/resource-names";
import { isValidTagPattern } from "@/lib/tag";
import { cn } from "@/lib/utils";
import {
  UserSetting_Key,
  UserSetting_TagMetadataSchema,
  UserSetting_TagsSettingSchema,
  UserSettingSchema,
} from "@/types/proto/api/user_service_pb";
import { ColorSchema } from "@/types/proto/google/type/color_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, SettingPanel } from "./SettingList";
import SettingSection from "./SettingSection";

const DEFAULT_TAG_COLOR = "#ffffff";

// Converts a CSS hex string to a google.type.Color message.
const hexToColor = (hex: string) =>
  create(ColorSchema, {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255,
  });

interface LocalTagMeta {
  color?: string;
  blur: boolean;
}

const toLocalTagMeta = (meta: {
  backgroundColor?: { red?: number; green?: number; blue?: number };
  blurContent: boolean;
}): LocalTagMeta => ({
  color: colorToHex(meta.backgroundColor),
  blur: meta.blurContent,
});

const TagsSection = () => {
  const t = useTranslate();
  const configuredRulesId = useId();
  const { currentUser, userTagsSetting, refetchSettings } = useAuth();
  const { mutateAsync: updateUserSetting } = useUpdateUserSetting();
  const { data: tagCounts = {} } = useTagCounts(true);
  const originalSetting = useMemo(() => userTagsSetting ?? create(UserSetting_TagsSettingSchema, {}), [userTagsSetting]);

  // Local state: map of tagName → { color, blur } for editing.
  const [localTags, setLocalTags] = useState<Record<string, LocalTagMeta>>(() =>
    Object.fromEntries(Object.entries(originalSetting.tags).map(([name, meta]) => [name, toLocalTagMeta(meta)])),
  );
  const [newTagName, setNewTagName] = useState("");
  const [newTagError, setNewTagError] = useState<string>();
  const [newTagColor, setNewTagColor] = useState<string | undefined>(undefined);
  const [newTagBlur, setNewTagBlur] = useState(false);

  // Sync local state when the fetched setting arrives (the fetch is async and
  // completes after mount, so localTags would be empty without this sync).
  useEffect(() => {
    setLocalTags(Object.fromEntries(Object.entries(originalSetting.tags).map(([name, meta]) => [name, toLocalTagMeta(meta)])));
  }, [originalSetting.tags]);

  // All known tag names: union of saved entries and tags used in memos.
  const allKnownTags = useMemo(
    () => Array.from(new Set([...Object.keys(localTags), ...Object.keys(tagCounts)])).sort(),
    [localTags, tagCounts],
  );

  // Only show rows for tags that have metadata configured.
  const configuredEntries = useMemo(
    () =>
      Object.keys(localTags)
        .sort()
        .map((name) => ({ name, count: Object.hasOwn(tagCounts, name) ? tagCounts[name] : 0 })),
    [localTags, tagCounts],
  );

  const originalMetaMap = useMemo(
    () => Object.fromEntries(Object.entries(originalSetting.tags).map(([name, meta]) => [name, toLocalTagMeta(meta)])),
    [originalSetting.tags],
  );
  const hasChanges = !isEqual(localTags, originalMetaMap);

  const handleColorChange = (tagName: string, hex: string) => {
    setLocalTags((prev) => ({ ...prev, [tagName]: { ...prev[tagName], color: hex } }));
  };

  const handleBlurChange = (tagName: string, blur: boolean) => {
    setLocalTags((prev) => ({ ...prev, [tagName]: { ...prev[tagName], blur } }));
  };

  const handleClearColor = (tagName: string) => {
    setLocalTags((prev) => ({ ...prev, [tagName]: { ...prev[tagName], color: undefined } }));
  };

  const handleRemoveTag = (tagName: string) => {
    setLocalTags((prev) => {
      const next = { ...prev };
      delete next[tagName];
      return next;
    });
  };

  const handleAddTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    if (Object.hasOwn(localTags, name)) {
      setNewTagError(t("setting.tags.tag-already-exists"));
      return;
    }
    if (!isValidTagPattern(name)) {
      setNewTagError(t("setting.tags.invalid-regex"));
      return;
    }
    setLocalTags((prev) => ({ ...prev, [name]: { color: newTagColor, blur: newTagBlur } }));
    setNewTagName("");
    setNewTagColor(undefined);
    setNewTagBlur(false);
  };

  const handleSave = async () => {
    const tags = Object.fromEntries(
      Object.entries(localTags).map(([name, meta]) => [
        name,
        create(UserSetting_TagMetadataSchema, {
          blurContent: meta.blur,
          ...(meta.color ? { backgroundColor: hexToColor(meta.color) } : {}),
        }),
      ]),
    );

    if (!currentUser) {
      return;
    }

    await updateUserSetting({
      setting: create(UserSettingSchema, {
        name: buildUserSettingName(currentUser.name, UserSetting_Key.TAGS),
        value: {
          case: "tagsSetting",
          value: create(UserSetting_TagsSettingSchema, { tags }),
        },
      }),
      updateMask: ["tags"],
    });
    await refetchSettings();
  };

  return (
    <SettingSection title={t("setting.tags.label")}>
      <SettingGroup title={t("setting.tags.title")} description={t("setting.tags.description")}>
        <SettingPanel footer={<span className="mu-caption text-mu-text-secondary">{t("setting.tags.tag-pattern-hint")}</span>}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 mu-label text-mu-text">
                <PlusIcon className="mu-icon-sm" />
                <span>{t("setting.tags.add-rule")}</span>
              </div>
              <Button variant="neutral" onClick={handleAddTag} disabled={!newTagName.trim()} icon={<PlusIcon />}>
                {t("common.add")}
              </Button>
            </div>

            <div className="grid gap-2 lg:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:items-center">
              <Field.Root className="min-w-0" invalid={!!newTagError}>
                <Input
                  className="font-mono"
                  aria-label={t("setting.tags.label")}
                  placeholder={t("setting.tags.tag-name-placeholder")}
                  value={newTagName}
                  onChange={(e) => {
                    setNewTagName(e.target.value);
                    setNewTagError(undefined);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  list="known-tags"
                />
                <datalist id="known-tags">
                  {allKnownTags
                    .filter((tag) => !Object.hasOwn(localTags, tag))
                    .map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                </datalist>
                {newTagError && <Field.Error match>{newTagError}</Field.Error>}
              </Field.Root>

              <div className="flex h-8 items-center gap-2 rounded-mu-md border border-mu-line bg-mu-canvas px-2 mu-body text-mu-text-secondary">
                <PaletteIcon className="mu-icon" />
                <span>{t("setting.tags.background-color")}</span>
                <input
                  type="color"
                  className="size-6 cursor-pointer rounded border border-mu-line bg-transparent p-0.5"
                  value={newTagColor ?? DEFAULT_TAG_COLOR}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  aria-label={t("setting.tags.background-color")}
                />
                <Button variant="ghost" size="xs" onClick={() => setNewTagColor(undefined)} disabled={!newTagColor}>
                  {t("common.clear")}
                </Button>
              </div>

              <Field.Root>
                <Field.Label>
                  <Checkbox checked={newTagBlur} onCheckedChange={setNewTagBlur} />
                  <EyeOffIcon className="mu-icon text-mu-text-secondary" />
                  {t("setting.tags.blur-content")}
                </Field.Label>
              </Field.Root>
            </div>
          </div>
        </SettingPanel>

        <div className="flex items-center justify-between gap-3">
          <h4 id={configuredRulesId} className="mu-label text-mu-text-secondary">
            {t("setting.tags.configured-rules")}
          </h4>
          <Badge tone="outline">{configuredEntries.length}</Badge>
        </div>

        {configuredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-mu-lg border border-dashed border-mu-line px-4 py-8 text-center">
            <TagIcon className="mu-icon size-5 text-mu-text-secondary" />
            <p className="mu-body text-mu-text-secondary">{t("setting.tags.no-tags-configured")}</p>
          </div>
        ) : (
          <SettingList aria-labelledby={configuredRulesId}>
            {configuredEntries.map((row) => (
              <List.Item key={row.name} className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <TagIcon className="mu-icon shrink-0 text-mu-text-secondary" />
                    <span className="truncate font-mono mu-body text-mu-text">{row.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-6 mu-caption text-mu-text-secondary">
                    <span>{t("setting.tags.matching-rule")}</span>
                    <span className="text-mu-line">/</span>
                    <span>{t("setting.tags.used-count", { count: row.count })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mu-body text-mu-text-secondary">
                  <span
                    className={cn("size-5 rounded-mu-md border border-mu-line", !localTags[row.name].color && "bg-mu-canvas")}
                    style={{ backgroundColor: localTags[row.name].color ?? DEFAULT_TAG_COLOR }}
                    aria-hidden
                  />
                  <input
                    type="color"
                    className="size-8 cursor-pointer rounded-mu-md border border-mu-line bg-transparent p-0.5"
                    value={localTags[row.name].color ?? DEFAULT_TAG_COLOR}
                    onChange={(e) => handleColorChange(row.name, e.target.value)}
                    aria-label={t("setting.tags.background-color")}
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleClearColor(row.name)} disabled={!localTags[row.name].color}>
                    {localTags[row.name].color ?? t("setting.tags.default-color")}
                  </Button>
                </div>

                <Field.Root>
                  <Field.Label>
                    <Checkbox checked={localTags[row.name].blur} onCheckedChange={(checked) => handleBlurChange(row.name, checked)} />
                    <EyeOffIcon className="mu-icon text-mu-text-secondary" />
                    {t("setting.tags.blur-content")}
                  </Field.Label>
                </Field.Root>

                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRemoveTag(row.name)}
                        aria-label={t("common.delete")}
                        icon={<TrashIcon />}
                      />
                    }
                  />
                  <Tooltip.Popup>{t("common.delete")}</Tooltip.Popup>
                </Tooltip.Root>
              </List.Item>
            ))}
          </SettingList>
        )}
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button variant="primary" disabled={!hasChanges || !currentUser} onClick={handleSave}>
          {t("common.save")}
        </Button>
      </div>
    </SettingSection>
  );
};

export default TagsSection;
