import { useQueryClient } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { memoServiceClient } from "@/connect";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { getErrorMessage } from "@/lib/error";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import {
  buildDeadlineMemo,
  DEADLINE_IMPORT_SAMPLE_CSV,
  formatDeadlineForDisplay,
  getVisibilityLabel,
  type ParsedDeadlineImportEntry,
  parseDeadlineCsv,
} from "@/utils/deadline-import";
import { useTranslate } from "@/utils/i18n";
import SettingTable from "./Settings/SettingTable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImportDeadlineCsvDialog = ({ open, onOpenChange }: Props) => {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [entries, setEntries] = useState<ParsedDeadlineImportEntry[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importFailures, setImportFailures] = useState<string[]>([]);
  const [defaultVisibility, setDefaultVisibility] = useState<Visibility>(Visibility.PRIVATE);
  const [isImporting, setIsImporting] = useState(false);

  const previewRows = useMemo(
    () =>
      entries.map((entry) => ({
        rowNumber: entry.rowNumber,
        title: entry.title,
        deadline: formatDeadlineForDisplay(entry.deadline),
        description: entry.description || "—",
        visibility: getVisibilityLabel(entry.visibility ?? defaultVisibility),
        tags: entry.tags.length > 0 ? entry.tags.join(", ") : "—",
      })),
    [defaultVisibility, entries],
  );

  const resetState = () => {
    setSelectedFileName("");
    setEntries([]);
    setParseErrors([]);
    setImportFailures([]);
    setDefaultVisibility(Visibility.PRIVATE);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImportFailures([]);

    if (!file) {
      setSelectedFileName("");
      setEntries([]);
      setParseErrors([]);
      return;
    }

    try {
      const content = await file.text();
      const result = parseDeadlineCsv(content);
      setSelectedFileName(file.name);
      setEntries(result.entries);
      setParseErrors(result.errors);
    } catch (error) {
      setSelectedFileName(file.name);
      setEntries([]);
      setParseErrors([getErrorMessage(error, "Failed to read CSV file.")]);
    }
  };

  const handleImport = async () => {
    if (entries.length === 0) {
      toast.error(t("setting.account-section.csv-import.empty-preview"));
      return;
    }

    setIsImporting(true);
    setImportFailures([]);

    const failures: string[] = [];
    let importedCount = 0;

    for (const entry of entries) {
      try {
        await memoServiceClient.createMemo({
          memo: buildDeadlineMemo(entry, defaultVisibility),
        });
        importedCount += 1;
      } catch (error) {
        failures.push(`Row ${entry.rowNumber}: ${getErrorMessage(error, "Failed to import memo.")}`);
      }
    }

    if (importedCount > 0) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: memoKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: userKeys.stats() }),
      ]);
    }

    setIsImporting(false);

    if (failures.length === 0) {
      toast.success(t("setting.account-section.csv-import.imported", { count: importedCount }));
      onOpenChange(false);
      return;
    }

    setImportFailures(failures);

    if (importedCount > 0) {
      toast.error(
        t("setting.account-section.csv-import.imported-with-failures", {
          successCount: importedCount,
          failureCount: failures.length,
        }),
      );
    } else {
      toast.error(t("setting.account-section.csv-import.import-failed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>{t("setting.account-section.csv-import.title")}</DialogTitle>
          <DialogDescription>{t("setting.account-section.csv-import.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid gap-2">
              <Label htmlFor="deadline-csv-file">{t("common.file")}</Label>
              <Input ref={fileInputRef} id="deadline-csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} />
              <p className="text-xs text-muted-foreground">{t("setting.account-section.csv-import.required-columns")}</p>
              {selectedFileName ? (
                <p className="text-xs text-muted-foreground">
                  {t("setting.account-section.csv-import.selected-file", { filename: selectedFileName })}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deadline-csv-visibility">{t("setting.account-section.csv-import.default-visibility")}</Label>
              <Select value={defaultVisibility.toString()} onValueChange={(value) => setDefaultVisibility(Number(value) as Visibility)}>
                <SelectTrigger id="deadline-csv-visibility" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Visibility.PRIVATE.toString()}>{t("memo.visibility.private")}</SelectItem>
                  <SelectItem value={Visibility.PROTECTED.toString()}>{t("memo.visibility.protected")}</SelectItem>
                  <SelectItem value={Visibility.PUBLIC.toString()}>{t("memo.visibility.public")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("setting.account-section.csv-import.default-visibility-note")}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-medium text-foreground">{t("setting.account-section.csv-import.sample")}</h4>
              <p className="text-xs text-muted-foreground">{t("setting.account-section.csv-import.sample-note")}</p>
            </div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs text-muted-foreground">
              {DEADLINE_IMPORT_SAMPLE_CSV}
            </pre>
          </div>

          {parseErrors.length > 0 ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <h4 className="text-sm font-medium text-destructive">{t("setting.account-section.csv-import.validation-errors")}</h4>
              <div className="mt-2 flex flex-col gap-1 text-sm text-destructive/90">
                {parseErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            </div>
          ) : null}

          {importFailures.length > 0 ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <h4 className="text-sm font-medium text-destructive">{t("setting.account-section.csv-import.import-errors")}</h4>
              <div className="mt-2 flex flex-col gap-1 text-sm text-destructive/90">
                {importFailures.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-medium text-foreground">{t("common.preview")}</h4>
              <p className="text-xs text-muted-foreground">
                {previewRows.length > 0
                  ? t("setting.account-section.csv-import.preview-ready", { count: previewRows.length })
                  : t("setting.account-section.csv-import.empty-preview")}
              </p>
            </div>

            <SettingTable
              columns={[
                {
                  key: "rowNumber",
                  header: t("setting.account-section.csv-import.row"),
                  className: "w-16",
                },
                {
                  key: "title",
                  header: t("common.title"),
                  className: "whitespace-normal min-w-[180px]",
                },
                {
                  key: "deadline",
                  header: t("setting.account-section.csv-import.deadline"),
                  className: "min-w-[160px]",
                },
                {
                  key: "visibility",
                  header: t("common.visibility"),
                  className: "min-w-[130px]",
                },
                {
                  key: "tags",
                  header: t("setting.account-section.csv-import.tags"),
                  className: "whitespace-normal min-w-[140px]",
                },
                {
                  key: "description",
                  header: t("common.description"),
                  className: "whitespace-normal min-w-[260px]",
                },
              ]}
              data={previewRows}
              emptyMessage={t("setting.account-section.csv-import.empty-preview")}
              getRowKey={(row) => row.rowNumber.toString()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={isImporting} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={isImporting || previewRows.length === 0} onClick={handleImport}>
            <UploadIcon className="w-4 h-4" />
            {t("setting.account-section.csv-import.import-action", { count: previewRows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDeadlineCsvDialog;
