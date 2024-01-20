import { useEffect } from "react";
import MemoResourceListView from "@/components/MemoResourceListView";
import { useResourceStore } from "@/store/v1";

interface Props {
  resourceId: number;
}

const EmbeddedResource = ({ resourceId }: Props) => {
  const resourceStore = useResourceStore();
  const resource = resourceStore.getResourceById(resourceId);

  useEffect(() => {
    resourceStore.getOrFetchResourceById(resourceId);
  }, [resourceId]);

  if (!resource) {
    return null;
  }

  return <MemoResourceListView resources={[resource]} />;
};

export default EmbeddedResource;
