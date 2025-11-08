import React from "react";
import { cn } from "@/lib/utils";

interface SettingTableColumn {
  key: string;
  header: string;
  className?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface SettingTableProps {
  columns: SettingTableColumn[];
  data: any[];
  emptyMessage?: string;
  className?: string;
  getRowKey?: (row: any, index: number) => string;
}

/**
 * Standardized table component for settings data lists
 * Provides consistent styling for tables in settings pages
 */
const SettingTable: React.FC<SettingTableProps> = ({ columns, data, emptyMessage = "No data", className, getRowKey }) => {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="inline-block min-w-full align-middle border border-border rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="text-sm font-semibold text-left text-foreground">
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cn("px-3 py-2", column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => {
                const rowKey = getRowKey ? getRowKey(row, rowIndex) : rowIndex.toString();
                return (
                  <tr key={rowKey}>
                    {columns.map((column) => {
                      const value = row[column.key];
                      const content = column.render ? column.render(value, row) : value;
                      return (
                        <td key={column.key} className={cn("whitespace-nowrap px-3 py-2 text-sm text-muted-foreground", column.className)}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SettingTable;
