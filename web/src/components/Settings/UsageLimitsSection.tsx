import { Badge, Button, Menu, Tooltip } from "@usememos/ui";
import { ArrowDownIcon, ArrowUpIcon, MoreVerticalIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserAvatar from "@/components/UserAvatar";
import { isFieldManaged, useManagedResource } from "@/hooks/useConfigurationQueries";
import { type UsageLimitEntry, useSaveUsageLimits, useUsageLimits } from "@/hooks/useUsageLimitQueries";
import { useListUsers } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { extractUsernameFromName } from "@/lib/resource-names";
import { showErrorToast, toast } from "@/lib/toast";
import { InstanceSetting_Key } from "@/types/proto/api/instance_service_pb";
import type { User } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import ManagedByConfigurationChip from "./ManagedByConfigurationChip";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";
import UsageLimitDialog from "./UsageLimitDialog";
import { formatLimitValue, isLimited, type UsageMetric } from "./usageLimitValues";
import { buildInstanceSettingName } from "./useInstanceSettingUpdater";

/** A table row: one entry and its position in the list. */
type LimitRow = { index: number; entry: UsageLimitEntry; shadowed: boolean } & Record<string, unknown>;

const metricColumns: {
  key: string;
  metric: UsageMetric;
  headerKey:
    | "setting.usage-limits.memos"
    | "setting.usage-limits.content-size-column"
    | "setting.usage-limits.storage-column"
    | "setting.usage-limits.file-size-column";
}[] = [
  { key: "memos", metric: "memoCount", headerKey: "setting.usage-limits.memos" },
  { key: "contentSize", metric: "memoContentBytes", headerKey: "setting.usage-limits.content-size-column" },
  { key: "storage", metric: "storageBytes", headerKey: "setting.usage-limits.storage-column" },
  { key: "fileSize", metric: "uploadBytes", headerKey: "setting.usage-limits.file-size-column" },
];

/**
 * Edits the usage limits as the ordered list the server checks: the first
 * entry that names a user is that user's limit set, and the last entry, for
 * all users, is the default. Every change replaces the whole list.
 */
const UsageLimitsSection = () => {
  const t = useTranslate();
  const managed = useManagedResource(buildInstanceSettingName(InstanceSetting_Key.USAGE_LIMITS));
  const locked = isFieldManaged(managed, "usageLimitsSetting");
  const { limits, isLoading } = useUsageLimits();
  const { data: users = [] } = useListUsers();
  const save = useSaveUsageLimits();
  const [dialog, setDialog] = useState<{ open: boolean; index?: number }>({ open: false });
  const [removeIndex, setRemoveIndex] = useState<number | undefined>();

  const usersByName = useMemo(() => new Map(users.map((user) => [user.name, user])), [users]);
  const rows = useMemo<LimitRow[]>(() => {
    const seen = new Set<string>();
    return (limits ?? []).map((entry, index) => {
      const shadowed = entry.users.length > 0 && entry.users.every((name) => seen.has(name));
      for (const name of entry.users) seen.add(name);
      return { index, entry, shadowed };
    });
  }, [limits]);
  const defaults = limits?.find((entry) => entry.allUsers);
  const lastMovable = (limits?.length ?? 1) - 2;

  const replace = async (next: UsageLimitEntry[], successKey: "setting.usage-limits.saved" | "setting.usage-limits.removed") => {
    try {
      await save.mutateAsync(next);
      toast.add({ title: t(successKey), type: "success" });
      return true;
    } catch (error) {
      handleError(error, showErrorToast, { context: "Update usage limits" });
      return false;
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    if (!limits) return;
    const target = index + direction;
    if (target < 0 || target > lastMovable) return;
    const next = [...limits];
    [next[index], next[target]] = [next[target], next[index]];
    void replace(next, "setting.usage-limits.saved");
  };

  const handleSave = async (entry: UsageLimitEntry) => {
    if (!limits) return;
    const next = [...limits];
    if (dialog.index === undefined) {
      // A new entry goes right above the default, where it is checked last
      // among the named entries; the admin moves it up if it should win.
      next.splice(next.length - 1, 0, entry);
    } else {
      next[dialog.index] = entry;
    }
    if (await replace(next, "setting.usage-limits.saved")) {
      setDialog({ open: false });
    }
  };

  const handleRemove = async () => {
    if (!limits || removeIndex === undefined) return;
    await replace(
      limits.filter((_, index) => index !== removeIndex),
      "setting.usage-limits.removed",
    );
    setRemoveIndex(undefined);
  };

  const renderUser = (name: string, user: User | undefined) => {
    const label = user?.displayName || user?.username || extractUsernameFromName(name);
    return (
      <li key={name} className="flex items-center gap-1.5 rounded-full border border-mu-line bg-mu-well/40 py-0.5 pr-2 pl-0.5 mu-caption">
        <UserAvatar className="h-5 w-5 shrink-0" avatarUrl={user?.avatarUrl} name={label} />
        <span className="max-w-40 truncate">{label}</span>
      </li>
    );
  };

  const renderLimit = (metric: UsageMetric) => (_: unknown, row: LimitRow) => {
    const value = row.entry[metric];
    return (
      <span className={isLimited(value) ? "text-mu-text" : "text-mu-text-secondary/70"}>
        {isLimited(value) ? formatLimitValue(metric, value) : t("setting.usage-limits.unlimited")}
      </span>
    );
  };

  return (
    <SettingSection
      title={t("setting.usage-limits.title")}
      description={t("setting.usage-limits.description")}
      actions={
        <>
          {locked ? <ManagedByConfigurationChip resource={managed} /> : null}
          <Button
            variant="primary"
            disabled={locked || isLoading || !defaults}
            onClick={() => setDialog({ open: true })}
            icon={<PlusIcon />}
          >
            {t("setting.usage-limits.add-entry")}
          </Button>
        </>
      }
    >
      <p className="mu-body text-mu-text-secondary">{t("setting.usage-limits.order-note")}</p>
      <SettingTable
        columns={[
          {
            key: "position",
            header: t("setting.usage-limits.position"),
            className: "w-px font-mono text-mu-text-secondary",
            render: (_, row: LimitRow) => <span className="font-mono text-mu-text-secondary">{row.index + 1}</span>,
          },
          {
            key: "users",
            header: t("setting.usage-limits.applies-to"),
            render: (_, row: LimitRow) =>
              row.entry.allUsers ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mu-well">
                    <UsersIcon className="mu-icon text-mu-text-secondary" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="mu-label text-mu-text">{t("setting.usage-limits.all-users")}</span>
                    <span className="mu-caption text-mu-text-secondary">{t("setting.usage-limits.all-users-description")}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <ul className="flex flex-wrap gap-1.5">{row.entry.users.map((name) => renderUser(name, usersByName.get(name)))}</ul>
                  {row.shadowed && (
                    <Badge tone="warning" className="w-fit" title={t("setting.usage-limits.never-applies-description")}>
                      {t("setting.usage-limits.never-applies")}
                    </Badge>
                  )}
                </div>
              ),
          },
          ...metricColumns.map(({ key, metric, headerKey }) => ({ key, header: t(headerKey), render: renderLimit(metric) })),
          {
            key: "actions",
            header: "",
            className: "w-px",
            alignEnd: true,
            render: (_, row: LimitRow) => {
              const name = row.entry.allUsers ? t("setting.usage-limits.all-users") : String(row.index + 1);
              return (
                <Menu.Root modal={false}>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Menu.Trigger
                          render={
                            <Button
                              variant="ghost"
                              disabled={locked || isLoading || save.isPending}
                              aria-label={t("setting.usage-limits.row-actions", { name })}
                              icon={<MoreVerticalIcon />}
                            />
                          }
                        />
                      }
                    />
                    <Tooltip.Popup>{t("common.more")}</Tooltip.Popup>
                  </Tooltip.Root>
                  <Menu.Popup align="end">
                    {!row.entry.allUsers && (
                      <>
                        <Menu.Item disabled={row.index === 0} onClick={() => move(row.index, -1)} icon={<ArrowUpIcon />}>
                          {t("setting.usage-limits.move-up")}
                        </Menu.Item>
                        <Menu.Item disabled={row.index >= lastMovable} onClick={() => move(row.index, 1)} icon={<ArrowDownIcon />}>
                          {t("setting.usage-limits.move-down")}
                        </Menu.Item>
                        <Menu.Separator />
                      </>
                    )}
                    <Menu.Item onClick={() => setDialog({ open: true, index: row.index })}>{t("common.edit")}</Menu.Item>
                    {!row.entry.allUsers && (
                      <Menu.Item onClick={() => setRemoveIndex(row.index)} danger>
                        {t("setting.usage-limits.remove")}
                      </Menu.Item>
                    )}
                  </Menu.Popup>
                </Menu.Root>
              );
            },
          },
        ]}
        data={rows}
        getRowKey={(row) => (row.entry.allUsers ? "all-users" : `${row.index}:${row.entry.users.join(",")}`)}
      />

      {defaults && (
        <UsageLimitDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
          entry={dialog.index === undefined ? undefined : limits?.[dialog.index]}
          defaults={defaults}
          users={users}
          saving={save.isPending}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={removeIndex !== undefined}
        onOpenChange={(open) => !open && setRemoveIndex(undefined)}
        title={t("setting.usage-limits.remove-title")}
        description={t("setting.usage-limits.remove-description")}
        confirmLabel={t("setting.usage-limits.remove")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleRemove}
        confirmVariant="danger"
      />
    </SettingSection>
  );
};

export default UsageLimitsSection;
