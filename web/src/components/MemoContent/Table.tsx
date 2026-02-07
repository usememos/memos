import { PencilIcon, TrashIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import TableEditorDialog from "@/components/TableEditorDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
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

export const Table = ({ children, className, node: _node, ...props }: TableProps) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableIndex, setTableIndex] = useState(-1);

  const { memo } = useMemoViewContext();
  const { readonly } = useMemoViewDerived();
  const { mutate: updateMemo } = useUpdateMemo();

  /** Resolve which markdown table index this rendered table corresponds to. */
  const resolveTableIndex = useCallback(() => {
    const container = tableRef.current?.closest('[class*="wrap-break-word"]');
    if (!container) return -1;

    const allTables = container.querySelectorAll("table");
    for (let i = 0; i < allTables.length; i++) {
      if (tableRef.current?.contains(allTables[i])) return i;
    }
    return -1;
  }, []);

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const idx = resolveTableIndex();
      const tables = findAllTables(memo.content);
      if (idx < 0 || idx >= tables.length) return;

      const parsed = parseMarkdownTable(tables[idx].text);
      if (!parsed) return;

      setTableData(parsed);
      setTableIndex(idx);
      setDialogOpen(true);
    },
    [memo.content, resolveTableIndex],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const idx = resolveTableIndex();
      if (idx < 0) return;

      setTableIndex(idx);
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
      <div ref={tableRef} className="group/table relative w-full overflow-x-auto rounded-lg border border-border my-2">
        <table className={cn("w-full border-collapse text-sm", className)} {...props}>
          {children}
        </table>
        {!readonly && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover/table:opacity-100 transition-all">
            <button
              type="button"
              className="p-1 rounded bg-accent/80 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
              onClick={handleDeleteClick}
              title="Delete table"
            >
              <TrashIcon className="size-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded bg-accent/80 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={handleEditClick}
              title="Edit table"
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
            <DialogTitle>Delete table</DialogTitle>
            <DialogDescription>Are you sure you want to delete this table? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
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
    <thead className={cn("bg-accent/50", className)} {...props}>
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
    <tr className={cn("transition-colors hover:bg-muted/30", className)} {...props}>
      {children}
    </tr>
  );
};

interface TableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const TableHeaderCell = ({ children, className, node: _node, ...props }: TableHeaderCellProps) => {
  return (
    <th
      className={cn(
        "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        "border-b-2 border-border",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
};

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const TableCell = ({ children, className, node: _node, ...props }: TableCellProps) => {
  return (
    <td className={cn("px-3 py-2 text-left", className)} {...props}>
      {children}
    </td>
  );
};
