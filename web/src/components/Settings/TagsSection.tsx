import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInstance } from "@/contexts/InstanceContext";
import { useTagCounts } from "@/hooks/useUserQueries";
import { colorToHex } from "@/lib/color";
import { handleError } from "@/lib/error";
import { isValidTagPattern } from "@/lib/tag";
import {
  InstanceSetting_Key,
  InstanceSetting_TagMetadataSchema,
  InstanceSetting_TagsSettingSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { ColorSchema } from "@/types/proto/google/type/color_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

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
  const { tagsSetting: originalSetting, updateSetting, fetchSetting } = useInstance();
  const { data: tagCounts = {} } = useTagCounts(false);

  // Local state: map of tagName → { color, blur } for editing.
  const [localTags, setLocalTags] = useState<Record<string, LocalTagMeta>>(() =>
    Object.fromEntries(Object.entries(originalSetting.tags).map(([name, meta]) => [name, toLocalTagMeta(meta)])),
  );
  const [newTagName, setNewTagName] = useState("");
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
        .map((name) => ({ name })),
    [localTags],
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
    if (localTags[name] !== undefined) {
      toast.error(t("setting.tags.tag-already-exists"));
      return;
    }
    if (!isValidTagPattern(name)) {
      toast.error(t("setting.tags.invalid-regex"));
      return;
    }
    setLocalTags((prev) => ({ ...prev, [name]: { color: newTagColor, blur: newTagBlur } }));
    setNewTagName("");
    setNewTagColor(undefined);
    setNewTagBlur(false);
  };

  const handleSave = async () => {
    try {
      const tags = Object.fromEntries(
        Object.entries(localTags).map(([name, meta]) => [
          name,
          create(InstanceSetting_TagMetadataSchema, {
            blurContent: meta.blur,
            ...(meta.color ? { backgroundColor: hexToColor(meta.color) } : {}),
          }),
        ]),
      );
      await updateSetting(
        create(InstanceSettingSchema, {
          name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.TAGS]}`,
          value: {
            case: "tagsSetting",
            value: create(InstanceSetting_TagsSettingSchema, { tags }),
          },
        }),
      );
      await fetchSetting(InstanceSetting_Key.TAGS);
      toast.success(t("message.update-succeed"));
    } catch (error: unknown) {
      handleError(error, toast.error, { context: "Update tags setting" });
    }
  };

  return (
    <SettingSection title={t("setting.tags.label")}>
      <SettingGroup title={t("setting.tags.title")} description={t("setting.tags.description")}>
        <SettingTable
          columns={[
            {
              key: "name",
              header: t("setting.tags.tag-name"),
              render: (_, row: { name: string }) => <span className="font-mono text-foreground">{row.name}</span>,
            },
            {
              key: "color",
              header: t("setting.tags.background-color"),
              render: (_, row: { name: string }) => (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-8 h-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                    value={localTags[row.name].color ?? DEFAULT_TAG_COLOR}
                    onChange={(e) => handleColorChange(row.name, e.target.value)}
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleClearColor(row.name)} disabled={!localTags[row.name].color}>
                    {t("common.clear")}
                  </Button>
                  {!localTags[row.name].color && (
                    <span className="text-xs text-muted-foreground">{t("setting.tags.using-default-color")}</span>
                  )}
                </div>
              ),
            },
            {
              key: "blur",
              header: t("setting.tags.blur-content"),
              render: (_, row: { name: string }) => (
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer"
                  checked={localTags[row.name].blur}
                  onChange={(e) => handleBlurChange(row.name, e.target.checked)}
                />
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (_, row: { name: string }) => (
                <Button variant="ghost" size="sm" onClick={() => handleRemoveTag(row.name)}>
                  <TrashIcon className="w-4 h-4 text-destructive" />
                </Button>
              ),
            },
          ]}
          data={configuredEntries}
          emptyMessage={t("setting.tags.no-tags-configured")}
          getRowKey={(row) => row.name}
        />

        <div className="flex items-center gap-2 pt-1">
          <Input
            className="w-48"
            placeholder={t("setting.tags.tag-name-placeholder")}
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
            list="known-tags"
          />
          <datalist id="known-tags">
            {allKnownTags
              .filter((tag) => !localTags[tag])
              .map((tag) => (
                <option key={tag} value={tag} />
              ))}
          </datalist>
          <input
            type="color"
            className="w-8 h-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
            value={newTagColor ?? DEFAULT_TAG_COLOR}
            onChange={(e) => setNewTagColor(e.target.value)}
          />
          <Button variant="ghost" size="sm" onClick={() => setNewTagColor(undefined)} disabled={!newTagColor}>
            {t("common.clear")}
          </Button>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="w-4 h-4 cursor-pointer"
              checked={newTagBlur}
              onChange={(e) => setNewTagBlur(e.target.checked)}
            />
            {t("setting.tags.blur-content")}
          </label>
          <Button variant="outline" onClick={handleAddTag} disabled={!newTagName.trim()}>
            <PlusIcon className="w-4 h-4 mr-1.5" />
            {t("common.add")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t("setting.tags.tag-pattern-hint")}</p>
        {!newTagColor && <p className="text-xs text-muted-foreground">{t("setting.tags.using-default-color")}</p>}
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button disabled={!hasChanges} onClick={handleSave}>
          {t("common.save")}
        </Button>
      </div>
    </SettingSection>
  );
};

export default TagsSection;
