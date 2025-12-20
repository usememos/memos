import { type LinkPreview, LinkPreviewCard } from "@/components/memo-metadata";

interface LinkPreviewBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  node?: any;
}

const LinkPreviewBlock = ({ node, ...rest }: LinkPreviewBlockProps) => {
  const props = node?.properties || {};
  const preview: LinkPreview = {
    id: props["data-id"] || props["dataId"] || cryptoId(),
    url: props["data-url"] || props.dataUrl || "",
    title: props["data-title"] || props.dataTitle || "Link preview",
    description: props["data-description"] || props.dataDescription || "",
    imageUrl: props["data-image"] || props.dataImage || "",
    siteName: props["data-site"] || props.dataSite || props["data-site-name"],
  };

  return (
    <div {...rest}>
      <LinkPreviewCard preview={preview} mode="view" />
    </div>
  );
};

export const isLinkPreviewNode = (node: any): boolean => {
  return node?.properties?.["data-memo-link-preview"] === "true" || node?.properties?.dataMemoLinkPreview === "true";
};

function cryptoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
}

export default LinkPreviewBlock;
