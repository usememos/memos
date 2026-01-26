import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./markdown/types";

interface TableProps extends React.HTMLAttributes<HTMLTableElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const Table = ({ children, className, node: _node, ...props }: TableProps) => {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border my-2">
      <table className={cn("w-full border-collapse text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
};

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
