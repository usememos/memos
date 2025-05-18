import EmbeddedResource from "../EmbeddedContent/EmbeddedResource";

interface Props {
  resourceId: string;
  params: string;
}

const ReferencedResource = ({ resourceId: uid, params }: Props) => {
  return <EmbeddedResource resourceId={uid} params={`inline&${params}`} />;
};

export default ReferencedResource;
