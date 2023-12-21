import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import MemoContentV1 from "@/components/MemoContentV1";
import MemoResourceListView from "@/components/MemoResourceListView";
import { getTimeString } from "@/helpers/datetime";
import { useMemoV1Store } from "@/store/v1";
import { MemoRelation, MemoRelation_Type } from "@/types/proto/api/v2/memo_relation_service";
import { Memo } from "@/types/proto/api/v2/memo_service";
import { Resource } from "@/types/proto/api/v2/resource_service";
import MemoRelationListViewV1 from "./MemoRelationListViewV1";

interface Props {
  memo: Memo;
}

const TimelineMemo = (props: Props) => {
  const { memo } = props;
  const memoStore = useMemoV1Store();
  const [resources, setResources] = useState<Resource[]>([]);
  const [relations, setRelations] = useState<MemoRelation[]>([]);

  useEffect(() => {
    memoStore.fetchMemoResources(memo.id).then((resources: Resource[]) => {
      setResources(resources);
    });
    memoStore.fetchMemoRelations(memo.id).then((relations: MemoRelation[]) => {
      setRelations(relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE));
    });
  }, [memo.id]);

  return (
    <div className="relative w-full flex flex-col justify-start items-start">
      <div className="w-full flex flex-row justify-start items-center mt-0.5 mb-1 text-sm font-mono text-gray-500 dark:text-gray-400">
        <span className="opacity-80">{getTimeString(memo.displayTime)}</span>
        <Icon.Dot className="w-5 h-auto opacity-60" />
        <span className="opacity-60">#{memo.id}</span>
      </div>
      <MemoContentV1 content={memo.content} nodes={memo.nodes} />
      <MemoResourceListView resourceList={resources} />
      <MemoRelationListViewV1 memo={memo} relationList={relations} />
    </div>
  );
};

export default TimelineMemo;
