import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { findUsageLimit, USAGE_LIMIT_METRICS, useSetUsageLimit, useUsageLimits } from "@/hooks/useUsageLimitQueries";
import { handleError } from "@/lib/error";
import { UsageLimit_Metric } from "@/types/proto/api/instance_service_pb";
import type { User } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import { parseLimitInput, toLimitInput } from "./usageLimitValues";

type Inputs = Record<UsageLimit_Metric, string>;

/** Which row the dialog edits: the limits for all users, one user's limits, or a user still to pick. */
export type UsageLimitDialogTarget = { kind: "all" } | { kind: "user"; user: User } | { kind: "add" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: UsageLimitDialogTarget;
  /** The users that can be added, which are those without limits of their own. */
  candidates: User[];
}

const userLabel = (user: User) => (user.displayName ? `${user.displayName} (@${user.username})` : `@${user.username}`);

/**
 * Edits one row of the usage limits table. For all users, an empty field
 * means no limit. For one user, an empty field means the all-users limit
 * applies, and 0 means no limit for that user.
 */
function UsageLimitDialog({ open, onOpenChange, target, candidates }: Props) {
  const t = useTranslate();
  const { data: limits } = useUsageLimits({ enabled: open });
  const [pickedName, setPickedName] = useState("");
  const setUsageLimit = useSetUsageLimit();

  useEffect(() => {
    if (open) setPickedName("");
  }, [open]);

  const forAll = target.kind === "all";
  const user = target.kind === "user" ? target.user : candidates.find((candidate) => candidate.name === pickedName);
  // The user the limits belong to: empty for all users, undefined until a user is picked.
  const owner = forAll ? "" : user?.name;

  const savedInputs = useMemo(
    () =>
      Object.fromEntries(
        USAGE_LIMIT_METRICS.map((metric) => {
          const value = owner === undefined ? undefined : findUsageLimit(limits, metric, owner)?.value;
          // For a user, empty means "use the all-users limit", so a user limit of 0 (no limit) shows as 0.
          return [metric, !forAll && value === 0n ? "0" : toLimitInput(metric, value)];
        }),
      ) as Inputs,
    [limits, owner, forAll],
  );
  const [inputs, setInputs] = useState<Inputs>(savedInputs);
  useEffect(() => setInputs(savedInputs), [savedInputs]);

  /** The value to save: undefined removes the limit. */
  const savedValue = (metric: UsageLimit_Metric): bigint | undefined => {
    const value = parseLimitInput(metric, inputs[metric]);
    // A limit of 0 for all users is the same as none, so it is removed.
    if (forAll) return value ? value : undefined;
    return inputs[metric].trim() === "" ? undefined : value;
  };
  const isInvalid = (metric: UsageLimit_Metric) => parseLimitInput(metric, inputs[metric]) === undefined;
  const placeholder = (metric: UsageLimit_Metric) => {
    if (forAll) return t("setting.usage-limits.unlimited");
    const value = findUsageLimit(limits, metric)?.value;
    return t("setting.usage-limits.all-users-placeholder", {
      value: value ? toLimitInput(metric, value) : t("setting.usage-limits.unlimited"),
    });
  };
  const warning = (metric: UsageLimit_Metric) => (isInvalid(metric) ? t("setting.usage-limits.invalid") : undefined);

  const hasChanges = USAGE_LIMIT_METRICS.some((metric) => inputs[metric] !== savedInputs[metric]);
  const isValid = USAGE_LIMIT_METRICS.every((metric) => !isInvalid(metric));

  const handleSave = async () => {
    if (owner === undefined) return;
    try {
      for (const metric of USAGE_LIMIT_METRICS) {
        if (inputs[metric] === savedInputs[metric]) continue;
        await setUsageLimit.mutateAsync({
          metric,
          user: owner,
          value: savedValue(metric),
          existing: findUsageLimit(limits, metric, owner),
        });
      }
      toast.success(t("setting.usage-limits.saved"));
      onOpenChange(false);
    } catch (error) {
      handleError(error, toast.error, { context: "Update usage limits" });
    }
  };

  const fields = [
    { metric: UsageLimit_Metric.MEMO_COUNT, label: t("setting.usage-limits.memos"), help: t("setting.usage-limits.memos-description") },
    {
      metric: UsageLimit_Metric.MEMO_CONTENT_BYTES,
      label: t("setting.usage-limits.content-size"),
      help: t("setting.usage-limits.content-size-description"),
    },
    {
      metric: UsageLimit_Metric.STORAGE_BYTES,
      label: t("setting.usage-limits.storage"),
      help: t("setting.usage-limits.storage-description"),
    },
    { metric: UsageLimit_Metric.UPLOAD_BYTES, label: t("setting.usage-limits.file-size"), help: undefined },
  ];
  const userItems = candidates.map((candidate) => ({ value: candidate.name, label: userLabel(candidate) }));
  const title =
    target.kind === "all"
      ? t("setting.usage-limits.all-users-title")
      : target.kind === "user"
        ? t("setting.usage-limits.user-title", { user: target.user.displayName || target.user.username })
        : t("setting.usage-limits.add-user");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {target.kind === "add" && (
            <div className="grid gap-2">
              <Label>{t("setting.usage-limits.user")}</Label>
              <Select value={pickedName} items={userItems} onValueChange={setPickedName}>
                <SelectTrigger className="w-full" aria-label={t("setting.usage-limits.user")}>
                  <SelectValue placeholder={t("setting.usage-limits.select-user")} />
                </SelectTrigger>
                <SelectContent>
                  {userItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {userItems.length === 0 && <p className="text-xs text-muted-foreground">{t("setting.usage-limits.no-candidates")}</p>}
            </div>
          )}
          {fields.map(({ metric, label, help }) => {
            const message = warning(metric) ?? help;
            return (
              <div key={metric} className="grid gap-2">
                <Label htmlFor={`usage-limit-${metric}`}>{label}</Label>
                <Input
                  id={`usage-limit-${metric}`}
                  className="font-mono"
                  inputMode="decimal"
                  disabled={owner === undefined}
                  placeholder={placeholder(metric)}
                  value={inputs[metric]}
                  aria-invalid={isInvalid(metric)}
                  aria-describedby={message ? `usage-limit-help-${metric}` : undefined}
                  onChange={(event) => setInputs((current) => ({ ...current, [metric]: event.target.value }))}
                />
                {message && (
                  <p id={`usage-limit-help-${metric}`} className="text-xs text-muted-foreground">
                    {message}
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {forAll ? t("setting.usage-limits.all-users-hint") : t("setting.usage-limits.user-hint")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={owner === undefined || !hasChanges || !isValid || setUsageLimit.isPending} onClick={handleSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UsageLimitDialog;
