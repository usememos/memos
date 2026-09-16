import { timestampDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import dayjs from "dayjs";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import useCurrentUser from "@/hooks/useCurrentUser";
import { getErrorMessage } from "@/lib/error";
import { exportMemos, importStagedMemoArchive, type StagedMemoArchive, stageMemoArchive } from "@/lib/memo-archive";
import type { MemoImportIssue, MemoImportReport } from "@/types/proto/api/v1/user_service_pb";
import { ImportMemosRequest_ConflictPolicy } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, SettingListItem, StatRow } from "./SettingList";
import SettingSection from "./SettingSection";

const POLICIES = [
  {
    value: ImportMemosRequest_ConflictPolicy.SKIP,
    label: "setting.memo-archive.policy-skip",
    description: "setting.memo-archive.policy-skip-description",
  },
  {
    value: ImportMemosRequest_ConflictPolicy.REPLACE,
    label: "setting.memo-archive.policy-replace",
    description: "setting.memo-archive.policy-replace-description",
  },
  {
    value: ImportMemosRequest_ConflictPolicy.DUPLICATE,
    label: "setting.memo-archive.policy-duplicate",
    description: "setting.memo-archive.policy-duplicate-description",
  },
] as const;

// The import walks through three stages: pick a file, review what the server
// says the archive would do, then read the report. The conflict policy is only
// asked for in the review stage, and only when some memos already exist.
type ImportStage =
  | { kind: "idle" }
  | { kind: "review"; file: File; staged: StagedMemoArchive; policy: ImportMemosRequest_ConflictPolicy }
  | { kind: "done"; report: MemoImportReport };

const IssueList = ({ issues, tone }: { issues: MemoImportIssue[]; tone: "warning" | "failure" }) => {
  if (issues.length === 0) return null;
  return (
    <ul className={`flex flex-col gap-1 text-xs ${tone === "failure" ? "text-destructive" : "text-muted-foreground"}`}>
      {issues.map((issue, index) => (
        <li key={`${tone}-${index}`}>{issue.memo ? `${issue.memo}: ${issue.message}` : issue.message}</li>
      ))}
    </ul>
  );
};

const MemoArchiveSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<ImportStage>({ kind: "idle" });

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      await exportMemos(user.name, user.username);
      toast.success(t("setting.memo-archive.export-success"));
    } catch (error) {
      toast.error(getErrorMessage(error, t("setting.memo-archive.export-failed")));
    } finally {
      setExporting(false);
    }
  };

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    setBusy(true);
    try {
      const staged = await stageMemoArchive(user.name, file);
      setStage({ kind: "review", file, staged, policy: ImportMemosRequest_ConflictPolicy.SKIP });
    } catch (error) {
      toast.error(getErrorMessage(error, t("setting.memo-archive.import-failed")));
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (stage.kind !== "review" || !user) return;
    setBusy(true);
    try {
      const report = await importStagedMemoArchive(user.name, stage.staged, stage.policy);
      setStage({ kind: "done", report });
      toast.success(t("setting.memo-archive.import-success", { created: report.created, updated: report.updated }));
    } catch (error) {
      toast.error(getErrorMessage(error, t("setting.memo-archive.import-failed")));
      if (ConnectError.from(error).code === Code.NotFound) {
        // The staged upload expired; start over from the file picker.
        setStage({ kind: "idle" });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <SettingSection title={t("setting.memo-archive.label")} description={t("setting.memo-archive.description")}>
      <SettingGroup title={t("setting.memo-archive.export-title")} description={t("setting.memo-archive.export-description")}>
        <SettingList>
          <SettingListItem label={t("setting.memo-archive.export-label")} description={t("setting.memo-archive.export-detail")}>
            <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
              <DownloadIcon className="w-4 h-4 mr-1.5" />
              {exporting ? t("setting.memo-archive.exporting") : t("setting.memo-archive.export-action")}
            </Button>
          </SettingListItem>
        </SettingList>
      </SettingGroup>

      <SettingGroup showSeparator title={t("setting.memo-archive.import-title")} description={t("setting.memo-archive.import-description")}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip,application/vnd.usememos.archive+zip"
          className="hidden"
          onChange={handleFileChosen}
        />

        {stage.kind === "idle" && (
          <SettingList>
            <SettingListItem label={t("setting.memo-archive.import-label")} description={t("setting.memo-archive.import-detail")}>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                <UploadIcon className="w-4 h-4 mr-1.5" />
                {busy ? t("setting.memo-archive.reading") : t("setting.memo-archive.import-action")}
              </Button>
            </SettingListItem>
          </SettingList>
        )}

        {stage.kind === "review" && (
          <div className="flex flex-col gap-3">
            <SettingList>
              <StatRow label={t("setting.memo-archive.review-file")} value={stage.file.name} />
              <StatRow
                label={t("setting.memo-archive.review-exported")}
                value={`${stage.staged.plan.exporter} · ${
                  stage.staged.plan.exportTime ? dayjs(timestampDate(stage.staged.plan.exportTime)).format("YYYY-MM-DD HH:mm") : ""
                }`}
              />
              <StatRow label={t("setting.memo-archive.review-memos")} value={String(stage.staged.plan.memos)} />
              <StatRow label={t("setting.memo-archive.review-attachments")} value={String(stage.staged.plan.attachments)} />
              <StatRow label={t("setting.memo-archive.review-new")} value={String(stage.staged.plan.new + stage.staged.plan.renamed)} />
              <StatRow label={t("setting.memo-archive.review-existing")} value={String(stage.staged.plan.existing)} />
            </SettingList>

            {stage.staged.plan.existing > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="text-sm font-medium">
                  {t("setting.memo-archive.policy-question", { count: stage.staged.plan.existing })}
                </div>
                <RadioGroup
                  value={String(stage.policy)}
                  onValueChange={(value) => setStage({ ...stage, policy: Number(value) as ImportMemosRequest_ConflictPolicy })}
                  className="flex flex-col gap-2"
                >
                  {POLICIES.map((option) => (
                    <div key={option.value} className="flex items-start gap-2">
                      <RadioGroupItem value={String(option.value)} id={`memo-archive-policy-${option.value}`} className="mt-0.5" />
                      <Label
                        htmlFor={`memo-archive-policy-${option.value}`}
                        className="flex cursor-pointer flex-col items-start gap-1 font-normal leading-5"
                      >
                        <span className="text-sm text-foreground">{t(option.label)}</span>
                        <span className="text-xs text-muted-foreground">{t(option.description)}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            <IssueList issues={stage.staged.plan.warnings} tone="warning" />

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setStage({ kind: "idle" })}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" disabled={busy} onClick={handleImport}>
                {busy ? t("setting.memo-archive.importing") : t("setting.memo-archive.import-confirm", { count: stage.staged.plan.memos })}
              </Button>
            </div>
          </div>
        )}

        {stage.kind === "done" && (
          <div className="flex flex-col gap-3">
            <SettingList>
              <StatRow label={t("setting.memo-archive.report-created")} value={String(stage.report.created)} />
              <StatRow label={t("setting.memo-archive.report-updated")} value={String(stage.report.updated)} />
              <StatRow label={t("setting.memo-archive.report-skipped")} value={String(stage.report.skipped)} />
              <StatRow label={t("setting.memo-archive.report-failed")} value={String(stage.report.failed)} />
            </SettingList>
            <IssueList issues={stage.report.failures} tone="failure" />
            <IssueList issues={stage.report.warnings} tone="warning" />
            <div className="flex items-center justify-end">
              <Button variant="outline" size="sm" onClick={() => setStage({ kind: "idle" })}>
                {t("setting.memo-archive.import-another")}
              </Button>
            </div>
          </div>
        )}
      </SettingGroup>
    </SettingSection>
  );
};

export default MemoArchiveSection;
