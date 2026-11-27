import { Table } from "@usememos/ui";
import type React from "react";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface SettingTableColumn<T = Record<string, unknown>> {
  key: string;
  header: React.ReactNode;
  /** Layout classes for the column's cells. */
  className?: string;
  /** Lines the column's cells up at the end edge, like a Table's numeric column (actions, counts). */
  alignEnd?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface SettingTableProps<T = Record<string, unknown>> {
  columns: SettingTableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  getRowKey?: (row: T, index: number) => string;
  /** `info-flow` lets cells wrap and align to the top, for rows of mixed content. */
  variant?: "default" | "info-flow";
}

/** A settings list with columns: a bordered md Table, so it reads as one block among the page's other sections and its text lines up with a List row's. */
const SettingTable = <T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage,
  getRowKey,
  variant = "default",
}: SettingTableProps<T>) => {
  const t = useTranslate();
  return (
    <Table.Root bordered>
      <Table.Header>
        <Table.Row>
          {columns.map((column) => (
            <Table.Head key={column.key} num={column.alignEnd} className={column.className}>
              {column.header}
            </Table.Head>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {data.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={columns.length} muted className="text-center">
              {emptyMessage ?? t("message.no-data")}
            </Table.Cell>
          </Table.Row>
        ) : (
          data.map((row, rowIndex) => {
            const rowKey = getRowKey ? getRowKey(row, rowIndex) : rowIndex.toString();
            return (
              <Table.Row key={rowKey}>
                {columns.map((column) => {
                  const value = row[column.key as keyof T] as T[keyof T];
                  const content = column.render ? column.render(value, row) : (value as React.ReactNode);
                  return (
                    <Table.Cell
                      key={column.key}
                      num={column.alignEnd}
                      className={cn(variant === "default" ? "whitespace-nowrap" : "whitespace-normal align-top", column.className)}
                    >
                      {content}
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            );
          })
        )}
      </Table.Body>
    </Table.Root>
  );
};

export default SettingTable;
