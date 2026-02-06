import { PencilIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import TableEditorDialog from "@/components/TableEditorDialog";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import type { TableData } from "@/utils/markdown-table";
import { findAllTables, parseMarkdownTable, replaceNthTable } from "@/utils/markdown-table";
import { useMemoViewContext, useMemoViewDerived } from "../MemoView/MemoViewContext";
import type { ReactMarkdownProps } from "./markdown/types";

// ---------------------------------------------------------------------------
// Table (root wrapper with edit button)
// ---------------------------------------------------------------------------

interface TableProps extends React.HTMLAttributes<HTMLTableElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const Table = ({ children, className, node: _node, ...props }: TableProps) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableIndex, setTableIndex] = useState(-1);

  const { memo } = useMemoViewContext();
  const { readonly } = useMemoViewDerived();
  const { mutate: updateMemo } = useUpdateMemo();

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Determine which table this is in the memo content by walking the DOM.
      const container = tableRef.current?.closest('[class*="wrap-break-word"]');
      if (!container) return;

      const allTables = container.querySelectorAll("table");
      let idx = 0;
      for (let i = 0; i < allTables.length; i++) {
        if (tableRef.current?.contains(allTables[i])) {
          idx = i;
          break;
        }
      }

      // Find and parse the corresponding markdown table.
      const tables = findAllTables(memo.content);
      if (idx >= tables.length) return;

      const parsed = parseMarkdownTable(tables[idx].text);
      if (!parsed) return;

      setTableData(parsed);
      setTableIndex(idx);
      setDialogOpen(true);
    },
    [memo.content],
  );

  const handleConfirm = useCallback(
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

  return (
    <>
      <div ref={tableRef} className="group/table relative w-full overflow-x-auto rounded-lg border border-border my-2">
        <table className={cn("w-full border-collapse text-sm", className)} {...props}>
          {children}
        </table>
        {!readonly && (
          <button
            type="button"
            className="absolute top-1.5 right-1.5 p-1 rounded bg-accent/80 text-muted-foreground opacity-0 group-hover/table:opacity-100 hover:bg-accent hover:text-foreground transition-all"
            onClick={handleEditClick}
            title="Edit table"
          >
            <PencilIcon className="size-3.5" />
          </button>
        )}
      </div>
      <TableEditorDialog open={dialogOpen} onOpenChange={setDialogOpen} initialData={tableData} onConfirm={handleConfirm} />
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
