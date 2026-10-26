import { ArrowDownIcon, ArrowUpIcon, MoreVerticalIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserAvatar from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type UsageLimitEntry, useSaveUsageLimits, useUsageLimits } from "@/hooks/useUsageLimitQueries";
import { useListUsers } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { extractUsernameFromName } from "@/lib/resource-names";
import type { User } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";
import UsageLimitDialog from "./UsageLimitDialog";
import { formatLimitValue, isLimited, type UsageMetric } from "./usageLimitValues";

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
      toast.success(t(successKey));
      return true;
    } catch (error) {
      handleError(error, toast.error, { context: "Update usage limits" });
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
      <li key={name} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-0.5 pr-2 pl-0.5 text-xs">
        <UserAvatar className="h-5 w-5 shrink-0" avatarUrl={user?.avatarUrl} name={label} />
        <span className="max-w-40 truncate">{label}</span>
      </li>
    );
  };

  const renderLimit = (metric: UsageMetric) => (_: unknown, row: LimitRow) => {
    const value = row.entry[metric];
    return (
      <span className={isLimited(value) ? "text-foreground" : "text-muted-foreground/70"}>
        {isLimited(value) ? formatLimitValue(metric, value) : t("setting.usage-limits.unlimited")}
      </span>
    );
  };

  return (
    <SettingSection
      title={t("setting.usage-limits.title")}
      description={t("setting.usage-limits.description")}
      actions={
        <Button disabled={isLoading || !defaults} onClick={() => setDialog({ open: true })}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("setting.usage-limits.add-entry")}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">{t("setting.usage-limits.order-note")}</p>
      <SettingTable
        columns={[
          {
            key: "position",
            header: t("setting.usage-limits.position"),
            className: "w-px font-mono text-muted-foreground",
            render: (_, row: LimitRow) => <span className="font-mono text-muted-foreground">{row.index + 1}</span>,
          },
          {
            key: "users",
            header: t("setting.usage-limits.applies-to"),
            render: (_, row: LimitRow) =>
              row.entry.allUsers ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UsersIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">{t("setting.usage-limits.all-users")}</span>
                    <span className="text-xs text-muted-foreground">{t("setting.usage-limits.all-users-description")}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <ul className="flex flex-wrap gap-1.5">{row.entry.users.map((name) => renderUser(name, usersByName.get(name)))}</ul>
                  {row.shadowed && (
                    <Badge variant="warning" shape="pill" className="w-fit" title={t("setting.usage-limits.never-applies-description")}>
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
            className: "w-px text-right",
            render: (_, row: LimitRow) => {
              const name = row.entry.allUsers ? t("setting.usage-limits.all-users") : String(row.index + 1);
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading || save.isPending}
                        aria-label={t("setting.usage-limits.row-actions", { name })}
                      />
                    }
                  >
                    <MoreVerticalIcon className="w-4 h-auto" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={2}>
                    {!row.entry.allUsers && (
                      <>
                        <DropdownMenuItem disabled={row.index === 0} onClick={() => move(row.index, -1)}>
                          <ArrowUpIcon className="mr-2 h-4 w-4" />
                          {t("setting.usage-limits.move-up")}
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={row.index >= lastMovable} onClick={() => move(row.index, 1)}>
                          <ArrowDownIcon className="mr-2 h-4 w-4" />
                          {t("setting.usage-limits.move-down")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setDialog({ open: true, index: row.index })}>{t("common.edit")}</DropdownMenuItem>
                    {!row.entry.allUsers && (
                      <DropdownMenuItem onClick={() => setRemoveIndex(row.index)} className="text-destructive focus:text-destructive">
                        {t("setting.usage-limits.remove")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
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
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

export default UsageLimitsSection;
