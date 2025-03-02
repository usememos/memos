import MemoContent from "@/components/MemoContent";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { formatDate } from "@/utils/date";

interface DefaultTemplateProps {
  memo: Memo;
}

const DefaultTemplate = ({ memo }: DefaultTemplateProps) => {
  const { createTime } = memo;
  const createTimeString = createTime?.toISOString();

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg p-5 shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-700/50">
      <MemoContent memoName={memo.name} nodes={memo.nodes} readonly={true} compact={false} />
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        {createTimeString && <time dateTime={createTimeString}>{formatDate(createTimeString)}</time>}
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />
      </div>
    </div>
  );
};

export default DefaultTemplate;
