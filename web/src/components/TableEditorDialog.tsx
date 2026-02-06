import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ColumnAlignment, TableData } from "@/utils/markdown-table";
import { createEmptyTable, serializeMarkdownTable } from "@/utils/markdown-table";
import { Button } from "./ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { VisuallyHidden } from "./ui/visually-hidden";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial table data when editing an existing table. */
  initialData?: TableData | null;
  /** Called with the formatted markdown table string on confirm. */
  onConfirm: (markdown: string) => void;
}

type SortState = { col: number; dir: "asc" | "desc" } | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TableEditorDialog = ({ open, onOpenChange, initialData, onConfirm }: TableEditorDialogProps) => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [alignments, setAlignments] = useState<ColumnAlignment[]>([]);
  const [sortState, setSortState] = useState<SortState>(null);

  // Ref grid for Tab navigation: inputRefs[row][col] (row -1 = headers).
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const setInputRef = useCallback((key: string, el: HTMLInputElement | null) => {
    if (el) {
      inputRefs.current.set(key, el);
    } else {
      inputRefs.current.delete(key);
    }
  }, []);

  // Initialize state when dialog opens.
  useEffect(() => {
    if (open) {
      if (initialData) {
        setHeaders([...initialData.headers]);
        setRows(initialData.rows.map((r) => [...r]));
        setAlignments([...initialData.alignments]);
      } else {
        const empty = createEmptyTable(3, 2);
        setHeaders(empty.headers);
        setRows(empty.rows);
        setAlignments(empty.alignments);
      }
      setSortState(null);
    }
  }, [open, initialData]);

  const colCount = headers.length;
  const rowCount = rows.length;

  // ---- Cell editing ----

  const updateHeader = (col: number, value: string) => {
    setHeaders((prev) => {
      const next = [...prev];
      next[col] = value;
      return next;
    });
  };

  const updateCell = (row: number, col: number, value: string) => {
    setRows((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });
  };

  // ---- Add / Remove ----

  const addColumn = () => {
    setHeaders((prev) => [...prev, ""]);
    setRows((prev) => prev.map((r) => [...r, ""]));
    setAlignments((prev) => [...prev, "none"]);
    setSortState(null);
  };

  const removeColumn = (col: number) => {
    if (colCount <= 1) return;
    setHeaders((prev) => prev.filter((_, i) => i !== col));
    setRows((prev) => prev.map((r) => r.filter((_, i) => i !== col)));
    setAlignments((prev) => prev.filter((_, i) => i !== col));
    setSortState(null);
  };

  const addRow = () => {
    setRows((prev) => [...prev, Array.from({ length: colCount }, () => "")]);
  };

  const removeRow = (row: number) => {
    if (rowCount <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== row));
  };

  // ---- Sorting ----

  const sortByColumn = (col: number) => {
    let newDir: "asc" | "desc" = "asc";
    if (sortState && sortState.col === col && sortState.dir === "asc") {
      newDir = "desc";
    }
    setSortState({ col, dir: newDir });

    setRows((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const va = (a[col] || "").toLowerCase();
        const vb = (b[col] || "").toLowerCase();
        // Try numeric comparison first.
        const na = Number(va);
        const nb = Number(vb);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) {
          return newDir === "asc" ? na - nb : nb - na;
        }
        const cmp = va.localeCompare(vb);
        return newDir === "asc" ? cmp : -cmp;
      });
      return sorted;
    });
  };

  // ---- Tab / keyboard navigation ----

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const nextCol = e.shiftKey ? col - 1 : col + 1;
      let nextRow = row;

      if (nextCol >= colCount) {
        // Move to first cell of next row.
        if (row < rowCount - 1) {
          nextRow = row + 1;
          focusCell(nextRow, 0);
        } else {
          // At last cell – add a new row and focus it.
          addRow();
          // Need to wait for state update; use setTimeout.
          setTimeout(() => focusCell(rowCount, 0), 0);
        }
      } else if (nextCol < 0) {
        // Move to last cell of previous row.
        if (row > 0) {
          nextRow = row - 1;
          focusCell(nextRow, colCount - 1);
        } else {
          // Move to header row.
          focusCell(-1, colCount - 1);
        }
      } else {
        focusCell(nextRow, nextCol);
      }
    }
  };

  const focusCell = (row: number, col: number) => {
    const key = `${row}:${col}`;
    const el = inputRefs.current.get(key);
    el?.focus();
  };

  // ---- Confirm ----

  const handleConfirm = () => {
    const data: TableData = { headers, rows, alignments };
    const md = serializeMarkdownTable(data);
    onConfirm(md);
    onOpenChange(false);
  };

  // ---- Sort indicator ----

  const SortIndicator = ({ col }: { col: number }) => {
    if (sortState?.col === col) {
      return sortState.dir === "asc" ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />;
    }
    return <ArrowUpDownIcon className="size-3 opacity-0 group-hover/sort:opacity-60" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="p-0!" showCloseButton={false}>
        <VisuallyHidden>
          <DialogClose />
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogTitle>Table Editor</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogDescription>Edit table headers, rows, columns and sort data</DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col gap-0">
          {/* Scrollable table area */}
          <div className="overflow-auto max-h-[60vh] p-4 pb-2">
            <table className="w-full border-collapse text-sm">
              {/* Header row */}
              <thead>
                <tr>
                  {/* Row number column */}
                  <th className="w-8 min-w-8" />
                  {headers.map((header, col) => (
                    <th key={col} className="p-0 min-w-[120px]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-0.5">
                          <input
                            ref={(el) => setInputRef(`-1:${col}`, el)}
                            className="flex-1 min-w-0 px-2 py-1.5 font-semibold text-xs uppercase tracking-wide bg-accent/50 border border-border rounded-tl-md focus:outline-none focus:ring-1 focus:ring-primary/40"
                            value={header}
                            onChange={(e) => updateHeader(col, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, -1, col)}
                            placeholder={`Col ${col + 1}`}
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="group/sort flex items-center justify-center size-7 rounded hover:bg-accent transition-colors"
                                onClick={() => sortByColumn(col)}
                              >
                                <SortIndicator col={col} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Sort column</TooltipContent>
                          </Tooltip>
                          {colCount > 1 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="flex items-center justify-center size-7 rounded opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-60 hover:bg-destructive/10 hover:text-destructive transition-all"
                                  onClick={() => removeColumn(col)}
                                >
                                  <TrashIcon className="size-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Remove column</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                  {/* Add column button */}
                  <th className="w-8 min-w-8 align-middle">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-center size-7 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                          onClick={addColumn}
                        >
                          <PlusIcon className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Add column</TooltipContent>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              {/* Data rows */}
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="group">
                    {/* Row number + remove */}
                    <td className="w-8 min-w-8 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <span className="text-xs text-muted-foreground group-hover:hidden">{rowIdx + 1}</span>
                        {rowCount > 1 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="hidden group-hover:flex items-center justify-center size-6 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                                onClick={() => removeRow(rowIdx)}
                              >
                                <TrashIcon className="size-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Remove row</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    {row.map((cell, col) => (
                      <td key={col} className="p-0">
                        <input
                          ref={(el) => setInputRef(`${rowIdx}:${col}`, el)}
                          className={cn(
                            "w-full px-2 py-1.5 text-sm bg-transparent border border-border focus:outline-none focus:ring-1 focus:ring-primary/40",
                            rowIdx === rowCount - 1 && "rounded-bl-md",
                          )}
                          value={cell}
                          onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, col)}
                          placeholder="..."
                        />
                      </td>
                    ))}
                    <td className="w-8 min-w-8" />
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add row button */}
            <div className="flex justify-center mt-2">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={addRow}>
                <PlusIcon className="size-3.5" />
                Add row
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {colCount} {colCount === 1 ? "column" : "columns"} · {rowCount} {rowCount === 1 ? "row" : "rows"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>Confirm</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TableEditorDialog;
