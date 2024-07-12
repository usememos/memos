import { Node, TableNode_Row } from "@/types/proto/api/v1/markdown_service";
import Renderer from "./Renderer";

interface Props {
  index: string;
  header: Node[];
  rows: TableNode_Row[];
}

const Table = ({ header, rows }: Props) => {
  return (
    <table className="w-auto max-w-full border border-gray-300 dark:border-zinc-600 divide-y divide-gray-300 dark:divide-zinc-600">
      <thead className="text-sm font-medium leading-5 text-left text-gray-900 dark:text-gray-400">
        <tr className="divide-x divide-gray-300 dark:divide-zinc-600">
          {header.map((h, i) => (
            <th key={i} className="py-1 px-2">
              <Renderer key={`${h.type}-${i}`} index={String(i)} node={h} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-300 dark:divide-zinc-600 text-sm leading-5 text-left text-gray-900 dark:text-gray-400">
        {rows.map((row, i) => (
          <tr key={i} className="divide-x divide-gray-300 dark:divide-zinc-600">
            {row.cells.map((r, j) => (
              <td key={j} className="py-1 px-2">
                <Renderer key={`${r.type}-${i}-${j}`} index={String(j)} node={r} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Table;
