import EmbeddedMemo from "./EmbeddedMemo";

interface Props {
  resourceName: string;
}

const extractResourceTypeAndId = (resourceName: string) => {
  const [resourceType, resourceId] = resourceName.split("/");
  return { resourceType, resourceId };
};

const EmbeddedContent = ({ resourceName }: Props) => {
  const { resourceType, resourceId } = extractResourceTypeAndId(resourceName);
  if (resourceType === "memos") {
    return <EmbeddedMemo memoId={Number(resourceId)} />;
  }
  return <p>Unknown resource: {resourceName}</p>;
};

export default EmbeddedContent;
