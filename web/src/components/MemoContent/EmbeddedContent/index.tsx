import EmbeddedAttachment from "./EmbeddedAttachment";
import EmbeddedMemo from "./EmbeddedMemo";
import Error from "./Error";

interface Props {
  resourceName: string;
  params: string;
}

const extractResourceTypeAndId = (resourceName: string) => {
  const [resourceType, resourceId] = resourceName.split("/");
  return { resourceType, resourceId };
};

const EmbeddedContent = ({ resourceName, params }: Props) => {
  const { resourceType, resourceId } = extractResourceTypeAndId(resourceName);
  if (resourceType === "memos") {
    return <EmbeddedMemo resourceId={resourceId} params={params} />;
  } else if (resourceType === "attachments") {
    return <EmbeddedAttachment resourceId={resourceId} params={params} />;
  }
  return <Error message={`Unknown resource: ${resourceName}`} />;
};

export default EmbeddedContent;
