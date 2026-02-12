import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
    if (el) inputRefs.current.set(key, el);
    else inputRefs.current.delete(key);
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
    if (sortState && sortState.col === col && sortState.dir === "asc") newDir = "desc";
    setSortState({ col, dir: newDir });
    setRows((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const va = (a[col] || "").toLowerCase();
        const vb = (b[col] || "").toLowerCase();
        const na = Number(va);
        const nb = Number(vb);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return newDir === "asc" ? na - nb : nb - na;
        const cmp = va.localeCompare(vb);
        return newDir === "asc" ? cmp : -cmp;
      });
      return sorted;
    });
  };

  // ---- Tab / keyboard navigation ----

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key !== "Tab") return;
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
  };

  const focusCell = (row: number, col: number) => {
    inputRefs.current.get(`${row}:${col}`)?.focus();
  };

  const handleConfirm = () => {
    const md = serializeMarkdownTable({ headers, rows, alignments });
    onConfirm(md);
    onOpenChange(false);
  };

  const SortIndicator = ({ col }: { col: number }) => {
    if (sortState?.col === col) {
      return sortState.dir === "asc" ? <ArrowUpIcon className="size-3 text-primary" /> : <ArrowDownIcon className="size-3 text-primary" />;
    }
    return <ArrowUpDownIcon className="size-3 opacity-40" />;
  };

  const totalColSpan = colCount + 2;

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
          <div className="flex-1 overflow-auto px-4 pb-2">
            {/* Clip wrapper: ensures blue highlight lines don't extend beyond the table */}
            <div className="relative overflow-hidden">
              <table className="w-full border-collapse text-sm">
                {/* ============ STICKY HEADER ============ */}
                <thead className="sticky top-0 z-20">
                  {/* Mask row: solid background that hides content scrolling behind the header */}
                  <tr>
                    <th colSpan={totalColSpan} className="h-4 bg-background p-0 border-0" />
                  </tr>

                  {/* Header row */}
                  <tr>
                    {/* Row-number spacer */}
                    <th className="w-7 min-w-7 bg-background" />

                    {headers.map((header, col) => (
                      <th key={col} className="p-0 min-w-[140px] relative bg-background">
                        {/* ---- Insert-column zone (between col-1 and col) ---- */}
                        {col > 0 && (
                          <div
                            className="group/cins absolute -left-4 top-0 bottom-0 w-8 z-30 cursor-pointer"
                            onClick={() => insertColumnAt(col)}
                          >
                            {/* Blue vertical line through the entire table */}
                            <div
                              className="absolute left-1/2 -translate-x-1/2 top-0 w-0 group-hover/cins:w-[3px] bg-blue-500/70 transition-all pointer-events-none"
                              style={{ bottom: "-200rem" }}
                            />
                            {/* + button — absolutely centered on the column border */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center size-5 rounded-full bg-background border border-border text-muted-foreground cursor-pointer opacity-0 group-hover/cins:opacity-100 hover:text-primary hover:border-primary transition-all shadow-sm"
                                >
                                  <PlusIcon className="size-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Insert column</TooltipContent>
                            </Tooltip>
                          </div>
                        )}

                        {/* Header cell — bg covers input + sort + delete */}
                        <div className="flex items-center bg-accent/50 border border-border">
                          <input
                            ref={(el) => setInputRef(`-1:${col}`, el)}
                            style={{ fontFamily: MONO_FONT }}
                            className="flex-1 min-w-0 px-2 py-1.5 font-semibold text-xs uppercase tracking-wide bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/40"
                            value={header}
                            onChange={(e) => updateHeader(col, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, -1, col)}
                            placeholder={`Col ${col + 1}`}
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center justify-center size-7 rounded cursor-pointer hover:bg-accent transition-colors"
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
                                  className="flex items-center justify-center size-7 ml-1 rounded cursor-pointer opacity-40 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
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
                    <th className="w-8 min-w-8 align-middle bg-background">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center justify-center size-7 rounded cursor-pointer hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
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

                {/* ============ DATA ROWS ============ */}
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <React.Fragment key={rowIdx}>
                      <tr>
                        {/* Row number — with insert-row zone on top border */}
                        <td className="w-7 min-w-7 text-center align-middle relative">
                          {rowIdx > 0 && (
                            <div
                              className="group/rins absolute -top-[10px] -left-1 right-0 h-5 z-10 cursor-pointer"
                              onClick={() => insertRowAt(rowIdx)}
                            >
                              {/* Blue horizontal line extending across the table */}
                              <div
                                className="absolute top-1/2 -translate-y-1/2 left-0 h-0 group-hover/rins:h-[3px] bg-blue-500/70 transition-all pointer-events-none"
                                style={{ width: "200rem" }}
                              />
                              {/* + button at intersection of row border and first-column border */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 flex items-center justify-center size-5 rounded-full bg-background border border-border text-muted-foreground cursor-pointer opacity-0 group-hover/rins:opacity-100 hover:text-primary hover:border-primary transition-all shadow-sm"
                                  >
                                    <PlusIcon className="size-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Insert row</TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground">{rowIdx + 1}</span>
                        </td>

                        {/* Data cells */}
                        {row.map((cell, col) => (
                          <td key={col} className="p-0">
                            <input
                              ref={(el) => setInputRef(`${rowIdx}:${col}`, el)}
                              style={{ fontFamily: MONO_FONT }}
                              className="w-full px-2 py-1.5 text-sm bg-transparent border border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
                              value={cell}
                              onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIdx, col)}
                            />
                          </td>
                        ))}

                        {/* Row delete button */}
                        <td className="w-8 min-w-8 align-middle">
                          {rowCount > 1 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="flex items-center justify-center size-7 rounded cursor-pointer opacity-40 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
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
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add row button below the table */}
            <div className="flex justify-center mt-2">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground cursor-pointer" onClick={addRow}>
                <PlusIcon className="size-3.5" />
                Add row
              </Button>
            </div>
          </div>

          {/* ============ FOOTER ============ */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {colCount} {colCount === 1 ? "column" : "columns"} · {rowCount} {rowCount === 1 ? "row" : "rows"}
              </span>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground cursor-pointer" onClick={addRow}>
                <PlusIcon className="size-3.5" />
                Add row
              </Button>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground cursor-pointer" onClick={addColumn}>
                <PlusIcon className="size-3.5" />
                Add column
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="cursor-pointer" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="cursor-pointer" onClick={handleConfirm}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TableEditorDialog;
