import { sortBy } from "lodash-es";
import { MoreVerticalIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { findUsageLimit, USAGE_LIMIT_METRICS, useSetUsageLimit, useUsageLimits } from "@/hooks/useUsageLimitQueries";
import { useListUsers } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import { UsageLimit_Metric } from "@/types/proto/api/instance_service_pb";
import { User } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";
import UsageLimitDialog, { type UsageLimitDialogTarget } from "./UsageLimitDialog";
import { formatLimitValue } from "./usageLimitValues";

/**
 * A table row: name is empty for the all-users row, otherwise users/{user}.
 * The user is missing when the user list has not loaded.
 */
type LimitRow = { name: string; user?: User } & Record<string, unknown>;

/**
 * Edits the usage limits as one table. The first row holds the limits for all
 * users; each further row holds one user's own limits, which replace them.
 */
const UsageLimitsSection = () => {
  const t = useTranslate();
  const { data: limits, isLoading } = useUsageLimits();
  const { data: users = [] } = useListUsers();
  const setUsageLimit = useSetUsageLimit();
  const [dialog, setDialog] = useState<{ open: boolean; target: UsageLimitDialogTarget }>({ open: false, target: { kind: "all" } });
  const [removeTarget, setRemoveTarget] = useState<LimitRow | undefined>();

  const userRows = useMemo<LimitRow[]>(() => {
    const names = [...new Set((limits ?? []).filter((limit) => limit.user).map((limit) => limit.user))];
    return sortBy(
      names.map((name) => ({ name, user: users.find((user) => user.name === name) })),
      (row) => row.user?.username ?? row.name,
    );
  }, [limits, users]);
  const candidates = useMemo(
    () =>
      sortBy(
        users.filter((user) => !userRows.some((row) => row.name === user.name)),
        "username",
      ),
    [users, userRows],
  );

  const openDialog = (target: UsageLimitDialogTarget) => setDialog({ open: true, target });

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      for (const metric of USAGE_LIMIT_METRICS) {
        const existing = findUsageLimit(limits, metric, removeTarget.name);
        if (existing) await setUsageLimit.mutateAsync({ metric, user: removeTarget.name, value: undefined, existing });
      }
      toast.success(t("setting.usage-limits.removed"));
    } catch (error) {
      handleError(error, toast.error, { context: "Remove usage limits" });
    }
    setRemoveTarget(undefined);
  };

  const usernameOf = (row: LimitRow) => row.user?.username ?? row.name.replace(/^users\//, "");

  // A user row shows its own limit, or the all-users limit in gray when it has none.
  const renderLimit = (metric: UsageLimit_Metric) => (_: unknown, row: LimitRow) => {
    const own = findUsageLimit(limits, metric, row.name);
    const value = (own ?? findUsageLimit(limits, metric))?.value ?? 0n;
    const inherited = row.name !== "" && !own;
    return (
      <span className={cn(inherited ? "text-muted-foreground/70" : "text-foreground")}>
        {value > 0n ? formatLimitValue(metric, value) : t("setting.usage-limits.unlimited")}
      </span>
    );
  };

  const rows: LimitRow[] = [{ name: "" }, ...userRows];

  return (
    <SettingSection
      title={t("setting.usage-limits.title")}
      description={t("setting.usage-limits.description")}
      actions={
        <Button disabled={isLoading} onClick={() => openDialog({ kind: "add" })}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("setting.usage-limits.add-user")}
        </Button>
      }
    >
      <SettingTable
        columns={[
          {
            key: "user",
            header: t("setting.usage-limits.user"),
            render: (_, row: LimitRow) =>
              row.name === "" ? (
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
                <div className="flex items-center gap-3">
                  <UserAvatar
                    className="h-8 w-8 shrink-0"
                    avatarUrl={row.user?.avatarUrl}
                    name={row.user?.displayName || usernameOf(row)}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">{row.user?.displayName || usernameOf(row)}</span>
                    <span className="text-xs text-muted-foreground">@{usernameOf(row)}</span>
                  </div>
                </div>
              ),
          },
          { key: "memos", header: t("setting.usage-limits.memos"), render: renderLimit(UsageLimit_Metric.MEMO_COUNT) },
          {
            key: "contentSize",
            header: t("setting.usage-limits.content-size-column"),
            render: renderLimit(UsageLimit_Metric.MEMO_CONTENT_BYTES),
          },
          { key: "storage", header: t("setting.usage-limits.storage-column"), render: renderLimit(UsageLimit_Metric.STORAGE_BYTES) },
          { key: "fileSize", header: t("setting.usage-limits.file-size-column"), render: renderLimit(UsageLimit_Metric.UPLOAD_BYTES) },
          {
            key: "actions",
            header: "",
            className: "w-px text-right",
            render: (_, row: LimitRow) => {
              const name = row.name === "" ? t("setting.usage-limits.all-users") : usernameOf(row);
              const user = row.user;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        aria-label={t("setting.usage-limits.row-actions", { name })}
                      />
                    }
                  >
                    <MoreVerticalIcon className="w-4 h-auto" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={2}>
                    {row.name === "" ? (
                      <DropdownMenuItem onClick={() => openDialog({ kind: "all" })}>{t("common.edit")}</DropdownMenuItem>
                    ) : (
                      <>
                        {user && <DropdownMenuItem onClick={() => openDialog({ kind: "user", user })}>{t("common.edit")}</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => setRemoveTarget(row)} className="text-destructive focus:text-destructive">
                          {t("setting.usage-limits.remove")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            },
          },
        ]}
        data={rows}
        getRowKey={(row) => row.name || "all-users"}
      />

      <UsageLimitDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        target={dialog.target}
        candidates={candidates}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(undefined)}
        title={removeTarget ? t("setting.usage-limits.remove-title", { username: usernameOf(removeTarget) }) : ""}
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
