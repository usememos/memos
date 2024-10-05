import clsx from "clsx";
import { isEqual } from "lodash-es";
import { CheckCircleIcon, Code2Icon, HashIcon, LinkIcon } from "lucide-react";
import { Memo, MemoProperty } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  memo: Memo;
  className?: string;
}

const MemoDetailSidebar = ({ memo, className }: Props) => {
  const t = useTranslate();
  const property = MemoProperty.fromPartial(memo.property || {});
  const hasSpecialProperty = property.hasLink || property.hasTaskList || property.hasCode || property.hasIncompleteTasks;

  return (
    <aside
      className={clsx(
        "relative w-full h-auto max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start",
        className,
      )}
    >
      <div className="flex flex-col justify-start items-start w-full mt-1 px-1 gap-2 h-auto shrink-0 flex-nowrap hide-scrollbar">
        <div className="w-full flex flex-col">
          <p className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-gray-400 dark:text-gray-500 select-none">
            <span>Created at</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{memo.createTime?.toLocaleString()}</p>
        </div>
        {!isEqual(memo.createTime, memo.updateTime) && (
          <div className="w-full flex flex-col">
            <p className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-gray-400 dark:text-gray-500 select-none">
              <span>Last updated at</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{memo.updateTime?.toLocaleString()}</p>
          </div>
        )}
        {hasSpecialProperty && (
          <div className="w-full flex flex-col">
            <p className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-gray-400 dark:text-gray-500 select-none">
              <span>Properties</span>
            </p>
            <div className="w-full flex flex-row justify-start items-center gap-x-2 gap-y-1 flex-wrap text-gray-500 dark:text-gray-400">
              {property.hasLink && (
                <div className="w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center">
                  <div className="w-auto flex justify-start items-center mr-1">
                    <LinkIcon className="w-4 h-auto mr-1" />
                    <span className="block text-sm">{t("memo.links")}</span>
                  </div>
                </div>
              )}
              {property.hasTaskList && (
                <div className="w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center">
                  <div className="w-auto flex justify-start items-center mr-1">
                    <CheckCircleIcon className="w-4 h-auto mr-1" />
                    <span className="block text-sm">{t("memo.to-do")}</span>
                  </div>
                </div>
              )}
              {property.hasCode && (
                <div className="w-auto border dark:border-zinc-800 pl-1 pr-1.5 rounded-md flex justify-between items-center">
                  <div className="w-auto flex justify-start items-center mr-1">
                    <Code2Icon className="w-4 h-auto mr-1" />
                    <span className="block text-sm">{t("memo.code")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {property.tags.length > 0 && (
          <>
            <div className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-gray-400 dark:text-gray-500 select-none">
              <span>{t("common.tags")}</span>
              <span className="shrink-0">({property.tags.length})</span>
            </div>
            <div className="w-full flex flex-row justify-start items-center relative flex-wrap gap-x-2 gap-y-1">
              {property.tags.map((tag) => (
                <div
                  key={tag}
                  className="shrink-0 w-auto max-w-full text-sm rounded-md leading-6 flex flex-row justify-start items-center select-none hover:opacity-80 text-gray-600 dark:text-gray-400 dark:border-zinc-800"
                >
                  <HashIcon className="group-hover:hidden w-4 h-auto shrink-0 opacity-40" />
                  <div className={clsx("inline-flex flex-nowrap ml-0.5 gap-0.5 cursor-pointer max-w-[calc(100%-16px)]")}>
                    <span className="truncate dark:opacity-80">{tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

export default MemoDetailSidebar;
