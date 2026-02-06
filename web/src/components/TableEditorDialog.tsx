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
// Constants
// ---------------------------------------------------------------------------

const MONO_FONT = "'Fira Code', 'Fira Mono', 'JetBrains Mono', 'Cascadia Code', 'Consolas', ui-monospace, monospace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: TableData | null;
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

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const setInputRef = useCallback((key: string, el: HTMLInputElement | null) => {
    if (el) {
      inputRefs.current.set(key, el);
    } else {
      inputRefs.current.delete(key);
    }
  }, []);

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

  // ---- Add / Remove / Insert ----

  const addColumn = () => {
    setHeaders((prev) => [...prev, ""]);
    setRows((prev) => prev.map((r) => [...r, ""]));
    setAlignments((prev) => [...prev, "none"]);
    setSortState(null);
  };

  const insertColumnAt = (index: number) => {
    setHeaders((prev) => [...prev.slice(0, index), "", ...prev.slice(index)]);
    setRows((prev) => prev.map((r) => [...r.slice(0, index), "", ...r.slice(index)]));
    setAlignments((prev) => [...prev.slice(0, index), "none" as ColumnAlignment, ...prev.slice(index)]);
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

  const insertRowAt = (index: number) => {
    setRows((prev) => [...prev.slice(0, index), Array.from({ length: colCount }, () => ""), ...prev.slice(index)]);
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
        if (row < rowCount - 1) {
          nextRow = row + 1;
          focusCell(nextRow, 0);
        } else {
          addRow();
          setTimeout(() => focusCell(rowCount, 0), 0);
        }
      } else if (nextCol < 0) {
        if (row > 0) {
          nextRow = row - 1;
          focusCell(nextRow, colCount - 1);
        } else {
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
    return <ArrowUpDownIcon className="size-3 opacity-40" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full" className="p-0! w-[min(56rem,calc(100vw-2rem))] h-[min(44rem,calc(100vh-4rem))]" showCloseButton={false}>
        <VisuallyHidden>
          <DialogClose />
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogTitle>Table Editor</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogDescription>Edit table headers, rows, columns and sort data</DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col h-full">
          {/* Scrollable table area */}
          <div className="flex-1 overflow-auto p-4 pb-2">
            {/* Insert-column buttons row (above the table) */}
            <div className="relative w-full" style={{ height: 0 }}>
              {/* We position "+" buttons at each column border using the same grid layout */}
              <div className="flex items-start">
                {/* Offset for row-number column */}
                <div className="w-7 min-w-7 shrink-0" />
                {headers.map((_, col) => (
                  <div key={col} className="relative min-w-[140px] flex-1">
                    {/* "+" button on the left edge of each column (= between col-1 and col) */}
                    {col > 0 && (
                      <div className="absolute -left-2.5 -top-1 z-10 flex items-center justify-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center justify-center size-5 rounded-full bg-background border border-border text-muted-foreground opacity-0 hover:opacity-100 focus:opacity-100 hover:text-primary hover:border-primary transition-all shadow-sm [div:hover>&]:opacity-70"
                              onClick={() => insertColumnAt(col)}
                            >
                              <PlusIcon className="size-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Insert column</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <table className="w-full border-collapse text-sm">
              {/* Sticky header */}
              <thead className="sticky top-0 z-20 bg-background">
                <tr>
                  {/* Row number column */}
                  <th className="w-7 min-w-7" />
                  {headers.map((header, col) => (
                    <th key={col} className="p-0 min-w-[140px]">
                      <div className="flex items-center gap-0.5">
                        <input
                          ref={(el) => setInputRef(`-1:${col}`, el)}
                          style={{ fontFamily: MONO_FONT }}
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
                              className="flex items-center justify-center size-7 rounded hover:bg-accent transition-colors"
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
                                className="flex items-center justify-center size-7 rounded opacity-40 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                onClick={() => removeColumn(col)}
                              >
                                <TrashIcon className="size-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Remove column</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </th>
                  ))}
                  {/* Add column at end */}
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
                  <tr key={rowIdx} className="group/row relative">
                    {/* Row number */}
                    <td className="w-7 min-w-7 text-center align-middle">
                      <span className="text-xs text-muted-foreground">{rowIdx + 1}</span>
                    </td>

                    {/* Data cells */}
                    {row.map((cell, col) => (
                      <td key={col} className="p-0 relative">
                        <input
                          ref={(el) => setInputRef(`${rowIdx}:${col}`, el)}
                          style={{ fontFamily: MONO_FONT }}
                          className={cn(
                            "w-full px-2 py-1.5 text-sm bg-transparent border border-border focus:outline-none focus:ring-1 focus:ring-primary/40",
                            rowIdx === rowCount - 1 && "rounded-bl-md",
                          )}
                          value={cell}
                          onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, col)}
                        />
                        {/* Insert-row button: shown on the top border between rows */}
                        {rowIdx > 0 && col === 0 && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="flex items-center justify-center size-5 rounded-full bg-background border border-border text-muted-foreground opacity-0 hover:opacity-100 focus:opacity-100 hover:text-primary hover:border-primary transition-all shadow-sm [tr:hover>&]:opacity-70"
                                  onClick={() => insertRowAt(rowIdx)}
                                >
                                  <PlusIcon className="size-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Insert row</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </td>
                    ))}

                    {/* Row delete button (end of row) */}
                    <td className="w-8 min-w-8 align-middle">
                      {rowCount > 1 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center justify-center size-7 rounded opacity-40 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                              onClick={() => removeRow(rowIdx)}
                            >
                              <TrashIcon className="size-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Remove row</TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {colCount} {colCount === 1 ? "column" : "columns"} · {rowCount} {rowCount === 1 ? "row" : "rows"}
              </span>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={addRow}>
                <PlusIcon className="size-3.5" />
                Add row
              </Button>
            </div>
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
