import MemoContent from "@/components/MemoContent";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { formatDate } from "@/utils/date";

interface NoteTemplateProps {
  memo: Memo;
}

const NoteTemplate = ({ memo }: NoteTemplateProps) => {
  const { createTime } = memo;
  const createTimeString = createTime?.toISOString();

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className="bg-amber-50 dark:bg-amber-900 rounded-sm p-6 shadow-md transform rotate-[0.5deg] border border-amber-200 dark:border-amber-800 max-w-full overflow-hidden"
        style={{
          fontFamily: "'Indie Flower', cursive, sans-serif",
          width: "calc(100% - 24px)", // Add some padding to prevent overflow due to rotation
          margin: "12px auto",
        }}
      >
        {/* Paper texture */}
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1IiBoZWlnaHQ9IjUiPgo8cmVjdCB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPC9zdmc+')]"></div>

        {/* Pin */}
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full bg-red-500 shadow-md z-10"></div>

        <div className="relative z-1">
          <div className="text-gray-800 dark:text-amber-100 leading-relaxed">
            <MemoContent memoName={memo.name} nodes={memo.nodes} readonly={true} compact={false} />
          </div>

          <div className="mt-6 text-right text-sm text-gray-600 dark:text-amber-200/70 italic">
            {createTimeString && formatDate(createTimeString)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteTemplate;
