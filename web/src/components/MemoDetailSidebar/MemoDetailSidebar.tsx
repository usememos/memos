import clsx from "clsx";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import Icon from "../Icon";

interface Props {
  memo: Memo;
  className?: string;
}

const MemoDetailSidebar = ({ memo, className }: Props) => {
  const t = useTranslate();

  if (!memo.property) {
    return;
  }

  return (
    <aside
      className={clsx(
        "relative w-full h-auto max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start",
        className,
      )}
    >
      <div className="flex flex-col justify-start items-start w-full mt-1 px-1 h-auto shrink-0 flex-nowrap hide-scrollbar">
        <div className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-gray-400 select-none">
          <span>{t("common.tags")}</span>
          {memo.property.tags.length > 0 && <span className="shrink-0">({memo.property.tags.length})</span>}
        </div>
        <div className="w-full flex flex-row justify-start items-center relative flex-wrap gap-x-2 gap-y-1">
          {memo.property.tags.map((tag) => (
            <div
              key={tag}
              className="shrink-0 w-auto max-w-full text-sm rounded-md leading-6 flex flex-row justify-start items-center select-none hover:opacity-80 text-gray-600 dark:text-gray-400 dark:border-zinc-800"
            >
              <Icon.Hash className="group-hover:hidden w-4 h-auto shrink-0 opacity-40" />
              <div className={clsx("inline-flex flex-nowrap ml-0.5 gap-0.5 cursor-pointer max-w-[calc(100%-16px)]")}>
                <span className="truncate dark:opacity-80">{tag}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default MemoDetailSidebar;
