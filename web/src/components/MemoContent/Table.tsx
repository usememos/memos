import { PencilIcon, TrashIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import TableEditorDialog from "@/components/TableEditorDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import type { TableData } from "@/utils/markdown-table";
import { findAllTables, parseMarkdownTable, replaceNthTable } from "@/utils/markdown-table";
import { useMemoViewContext, useMemoViewDerived } from "../MemoView/MemoViewContext";
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

  const { memo } = useMemoViewContext();
  const { readonly } = useMemoViewDerived();
  const { mutate: updateMemo } = useUpdateMemo();

  /** Resolve which markdown table index this rendered table corresponds to using AST source positions. */
  const resolveTableIndex = useMemo(() => {
    const nodeStart = node?.position?.start?.offset;
    if (nodeStart == null) return -1;

    const tables = findAllTables(memo.content);
    for (let i = 0; i < tables.length; i++) {
      if (nodeStart >= tables[i].start && nodeStart < tables[i].end) return i;
    }
    return -1;
  }, [memo.content, node]);

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const tables = findAllTables(memo.content);
      if (resolveTableIndex < 0 || resolveTableIndex >= tables.length) return;

      const parsed = parseMarkdownTable(tables[resolveTableIndex].text);
      if (!parsed) return;

      setTableData(parsed);
      setTableIndex(resolveTableIndex);
      setDialogOpen(true);
    },
    [memo.content, resolveTableIndex],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (resolveTableIndex < 0) return;

      setTableIndex(resolveTableIndex);
      setDeleteDialogOpen(true);
    },
    [resolveTableIndex],
  );

  const handleConfirmEdit = useCallback(
    (markdown: string) => {
      if (tableIndex < 0) return;
      const newContent = replaceNthTable(memo.content, tableIndex, markdown);
      updateMemo({
        update: { name: memo.name, content: newContent },
        updateMask: ["content"],
      });
    },
    [memo.content, memo.name, tableIndex, updateMemo],
  );

  const handleConfirmDelete = useCallback(() => {
    if (tableIndex < 0) return;
    // Replace the table with an empty string to delete it.
    const newContent = replaceNthTable(memo.content, tableIndex, "");
    updateMemo({
      update: { name: memo.name, content: newContent },
      updateMask: ["content"],
    });
    setDeleteDialogOpen(false);
  }, [memo.content, memo.name, tableIndex, updateMemo]);

  return (
    <>
      <div className="group/table relative w-full overflow-x-auto rounded-lg border border-border bg-muted/20">
        <table className={cn("w-full border-collapse text-sm", className)} {...props}>
          {children}
        </table>
        {!readonly && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover/table:opacity-100 transition-all">
            <button
              type="button"
              className="p-1 rounded bg-accent/80 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
              onClick={handleDeleteClick}
              title={t("common.delete")}
            >
              <TrashIcon className="size-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded bg-accent/80 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={handleEditClick}
              title={t("common.edit")}
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
              <Button variant="ghost">{t("common.cancel")}</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>
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
