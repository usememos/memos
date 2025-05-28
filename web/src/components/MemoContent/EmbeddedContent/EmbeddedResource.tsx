import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import MemoResourceListView from "@/components/MemoResourceListView";
import useLoading from "@/hooks/useLoading";
import { resourceStore } from "@/store/v2";
import { cn } from "@/utils";
import Error from "./Error";

interface Props {
  resourceId: string;
  params: string;
}

const getAdditionalClassNameWithParams = (params: URLSearchParams) => {
  const additionalClassNames = [];
  if (params.has("inline")) {
    additionalClassNames.push("inline-block");
  }
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

const EmbeddedResource = observer(({ resourceId: uid, params: paramsStr }: Props) => {
  const loadingState = useLoading();
  const resourceStore = useResourceStore();
  const resource = resourceStore.getResourceByName(`resources/${uid}`);
  const params = new URLSearchParams(paramsStr);

  useEffect(() => {
    resourceStore.fetchResourceByName(`resources/${uid}`).finally(() => loadingState.setFinish());
  }, [uid]);

  if (loadingState.isLoading) {
    return null;
  }
  if (!resource) {
    return <Error message={`Resource not found: ${uid}`} />;
  }

  return (
    <div className={cn("max-w-full", getAdditionalClassNameWithParams(params))}>
      <MemoResourceListView resources={[resource]} allowFullWidth={params.has("inline")} />
    </div>
  );
});

export default EmbeddedResource;
