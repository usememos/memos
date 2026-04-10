import { Loader2Icon, PencilIcon, TrashIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMemoViewContext, useMemoViewDerived } from "@/components/MemoView/MemoViewContext";
import TableEditorDialog from "@/components/TableEditorDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import type { TableData } from "@/utils/markdown-table";
import { findAllTables, parseMarkdownTable, replaceNthTable } from "@/utils/markdown-table";
import type { ReactMarkdownProps } from "./markdown/types";

// ---------------------------------------------------------------------------
// Table (root wrapper with edit + delete buttons)
// ---------------------------------------------------------------------------

interface TableProps extends React.HTMLAttributes<HTMLTableElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const Table = ({ children, className, node, ...props }: TableProps) => {
  const t = useTranslate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableIndex, setTableIndex] = useState(-1);
  const [isDeleting, setIsDeleting] = useState(false);

  const { memo } = useMemoViewContext();
  const { readonly } = useMemoViewDerived();
  const { mutateAsync: updateMemo } = useUpdateMemo();

  const tables = useMemo(() => findAllTables(memo.content), [memo.content]);

  /** The index of the markdown table this rendered table corresponds to (from AST source positions). */
  const currentTableIndex = useMemo(() => {
    const nodeStart = node?.position?.start?.offset;
    if (nodeStart == null) return -1;

    for (let i = 0; i < tables.length; i++) {
      if (nodeStart >= tables[i].start && nodeStart < tables[i].end) return i;
    }
    return -1;
  }, [tables, node]);

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (currentTableIndex < 0 || currentTableIndex >= tables.length) return;

      const parsed = parseMarkdownTable(tables[currentTableIndex].text);
      if (!parsed) return;

      setTableData(parsed);
      setTableIndex(currentTableIndex);
      setDialogOpen(true);
    },
    [tables, currentTableIndex],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (currentTableIndex < 0) return;

      setTableIndex(currentTableIndex);
      setDeleteDialogOpen(true);
    },
    [currentTableIndex],
  );

  const handleConfirmEdit = useCallback(
    async (markdown: string) => {
      if (tableIndex < 0) return;
      const newContent = replaceNthTable(memo.content, tableIndex, markdown);
      try {
        await updateMemo({
          update: { name: memo.name, content: newContent },
          updateMask: ["content"],
        });
        setDialogOpen(false);
      } catch (error: unknown) {
        handleError(error, toast.error, {
          context: "Update table",
          fallbackMessage: t("message.failed-to-update-table"),
        });
      }
    },
    [memo.content, memo.name, tableIndex, updateMemo, t],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (tableIndex < 0) return;
    setIsDeleting(true);
    try {
      const tableToDelete = tables[tableIndex];
      if (!tableToDelete) return;

      // Replace the table with an empty string to delete it.
      let newContent = replaceNthTable(memo.content, tableIndex, "");

      // Normalize consecutive blank lines only around the deletion seam.
      // The replacement happens at tableToDelete.start, so check a small window
      // around that position for excessive whitespace.
      const seamStart = Math.max(0, tableToDelete.start - 2);
      const seamEnd = Math.min(newContent.length, tableToDelete.start + 2);
      const beforeSeam = newContent.slice(0, seamStart);
      const seamArea = newContent.slice(seamStart, seamEnd);
      const afterSeam = newContent.slice(seamEnd);

      // Normalize runs of 3+ newlines to 2 newlines in the seam area
      const normalizedSeam = seamArea.replace(/\n\n\n+/g, "\n\n");
      newContent = beforeSeam + normalizedSeam + afterSeam;

      await updateMemo({
        update: { name: memo.name, content: newContent },
        updateMask: ["content"],
      });
      setDeleteDialogOpen(false);
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: "Delete table",
        fallbackMessage: t("message.failed-to-delete-table"),
      });
    } finally {
      setIsDeleting(false);
    }
  }, [memo.content, memo.name, tableIndex, tables, updateMemo, t]);

  return (
    <>
      <div className="group/table relative w-full overflow-x-auto rounded-lg border border-border bg-muted/20">
        <table className={cn("w-full border-collapse text-sm", className)} {...props}>
          {children}
        </table>
        {!readonly && currentTableIndex >= 0 && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover/table:opacity-100 transition-all">
            <button
              type="button"
              className="p-1 rounded bg-accent/80 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
              onClick={handleDeleteClick}
              title={t("common.delete")}
              aria-label={t("common.delete")}
            >
              <TrashIcon className="size-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded bg-accent/80 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={handleEditClick}
              title={t("common.edit")}
              aria-label={t("common.edit")}
            >
              <PencilIcon className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <TableEditorDialog open={dialogOpen} onOpenChange={setDialogOpen} initialData={tableData} onConfirm={handleConfirmEdit} />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("editor.table.delete")}</DialogTitle>
            <DialogDescription>{t("editor.table.delete-confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isDeleting}>
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ---------------------------------------------------------------------------
// Sub-components (unchanged)
// ---------------------------------------------------------------------------

interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const TableHead = ({ children, className, node: _node, ...props }: TableHeadProps) => {
  return (
    <thead className={cn("border-b border-border bg-muted/30", className)} {...props}>
      {children}
    </thead>
  );
};

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const TableBody = ({ children, className, node: _node, ...props }: TableBodyProps) => {
  return (
    <tbody className={cn("divide-y divide-border", className)} {...props}>
      {children}
    </tbody>
  );
};

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const TableRow = ({ children, className, node: _node, ...props }: TableRowProps) => {
  return (
    <tr className={cn("transition-colors hover:bg-accent/20", className)} {...props}>
      {children}
    </tr>
  );
};

interface TableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const TableHeaderCell = ({ children, className, node: _node, ...props }: TableHeaderCellProps) => {
  return (
    <th className={cn("px-2 py-1 text-left align-middle text-sm font-medium text-muted-foreground", className)} {...props}>
      {children}
    </th>
  );
};

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const TableCell = ({ children, className, node: _node, ...props }: TableCellProps) => {
  return (
    <td className={cn("px-2 py-1 text-left align-middle text-sm", className)} {...props}>
      {children}
    </td>
  );
};
