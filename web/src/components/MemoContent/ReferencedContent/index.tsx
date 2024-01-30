import Error from "./Error";
import ReferencedMemo from "./ReferencedMemo";

interface Props {
  resourceName: string;
  params: string;
}

const extractResourceTypeAndId = (resourceName: string) => {
  const [resourceType, resourceId] = resourceName.split("/");
  return { resourceType, resourceId };
};

const ReferencedContent = ({ resourceName, params }: Props) => {
  const { resourceType, resourceId } = extractResourceTypeAndId(resourceName);
  if (resourceType === "memos") {
    return <ReferencedMemo resourceId={resourceId} params={params} />;
  }
  return <Error message={`Unknown resource: ${resourceName}`} />;
};

export default ReferencedContent;
