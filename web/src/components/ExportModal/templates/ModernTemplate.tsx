import MemoContent from "@/components/MemoContent";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { formatDate } from "@/utils/date";

interface ModernTemplateProps {
  memo: Memo;
}

const ModernTemplate = ({ memo }: ModernTemplateProps) => {
  const { createTime } = memo;
  const createTimeString = createTime?.toISOString();

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-lg border border-gray-100 dark:border-zinc-800">
      {/* Header with gradient */}
      <div className="h-16 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
        <div className="absolute -bottom-6 left-6">
          <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-md">
            <svg
              className="w-6 h-6 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              ></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-10 px-6 pb-6">
        <div className="mb-6">
          <MemoContent memoName={memo.name} nodes={memo.nodes} readonly={true} compact={false} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-zinc-800">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              {createTimeString && (
                <time dateTime={createTimeString} className="text-xs">
                  {formatDate(createTimeString)}
                </time>
              )}
            </div>
          </div>

          {/* Badge */}
          <div className="flex items-center">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                  clipRule="evenodd"
                ></path>
              </svg>
              memo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernTemplate;
