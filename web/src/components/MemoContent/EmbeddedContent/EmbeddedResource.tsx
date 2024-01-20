import classNames from "classnames";
import { useEffect } from "react";
import MemoResourceListView from "@/components/MemoResourceListView";
import { useResourceStore } from "@/store/v1";

interface Props {
  resourceId: number;
  params: string;
}

const getAdditionalClassNameWithParams = (params: URLSearchParams) => {
  const additionalClassNames = [];
  if (params.has("align")) {
    const align = params.get("align");
    if (align === "center") {
      additionalClassNames.push("mx-auto");
    }
  }
  if (params.has("size")) {
    const size = params.get("size");
    if (size === "lg") {
      additionalClassNames.push("w-full");
    } else if (size === "md") {
      additionalClassNames.push("w-2/3");
    } else if (size === "sm") {
      additionalClassNames.push("w-1/3");
    }
  }
  if (params.has("width")) {
    const width = params.get("width");
    additionalClassNames.push(`w-[${width}]`);
  }
  return additionalClassNames.join(" ");
};

const EmbeddedResource = ({ resourceId, params: paramsStr }: Props) => {
  const resourceStore = useResourceStore();
  const resource = resourceStore.getResourceById(resourceId);
  const params = new URLSearchParams(paramsStr);

  useEffect(() => {
    resourceStore.getOrFetchResourceById(resourceId);
  }, [resourceId]);

  if (!resource) {
    return null;
  }

  return (
    <div className={classNames("max-w-full", getAdditionalClassNameWithParams(params))}>
      <MemoResourceListView resources={[resource]} />
    </div>
  );
};

export default EmbeddedResource;
