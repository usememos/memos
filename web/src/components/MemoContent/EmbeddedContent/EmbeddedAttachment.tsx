import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import MemoAttachmentListView from "@/components/MemoAttachmentListView";
import useLoading from "@/hooks/useLoading";
import { cn } from "@/lib/utils";
import { attachmentStore } from "@/store";
import Error from "./Error";

interface Props {
  resourceId: string;
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

const EmbeddedAttachment = observer(({ resourceId: uid, params: paramsStr }: Props) => {
  const loadingState = useLoading();
  const attachment = attachmentStore.getAttachmentByName(uid);
  const params = new URLSearchParams(paramsStr);

  useEffect(() => {
    attachmentStore.fetchAttachmentByName(`attachments/${uid}`).finally(() => loadingState.setFinish());
  }, [uid]);

  if (loadingState.isLoading) {
    return null;
  }
  if (!attachment) {
    return <Error message={`Attachment not found: ${uid}`} />;
  }

  return (
    <div className={cn("max-w-full", getAdditionalClassNameWithParams(params))}>
      <MemoAttachmentListView attachments={[attachment]} />
    </div>
  );
});

export default EmbeddedAttachment;
