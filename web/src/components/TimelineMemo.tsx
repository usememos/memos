import MemoContent from "@/components/MemoContent";
import MemoResourceListView from "@/components/MemoResourceListView";
import { getTimeString } from "@/helpers/datetime";
import { MemoRelation_Type } from "@/types/proto/api/v2/memo_relation_service";
import { Memo } from "@/types/proto/api/v2/memo_service";
import MemoRelationListView from "./MemoRelationListView";

interface Props {
  memo: Memo;
}

const TimelineMemo = (props: Props) => {
  const { memo } = props;
  const relations = memo.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);

  return (
    <div className="relative w-full flex flex-col justify-start items-start">
      <div className="w-full flex flex-row justify-start items-center mt-0.5 mb-1 text-sm font-mono text-gray-500 dark:text-gray-400">
        <span className="opacity-80">{getTimeString(memo.displayTime)}</span>
      </div>
      <MemoContent nodes={memo.nodes} />
      <MemoResourceListView resourceList={memo.resources} />
      <MemoRelationListView memo={memo} relationList={relations} />
    </div>
  );
};

export default TimelineMemo;
