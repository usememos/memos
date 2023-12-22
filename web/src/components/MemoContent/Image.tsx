interface Props {
  altText: string;
  url: string;
}

const Image: React.FC<Props> = ({ altText, url }: Props) => {
  return <img alt={altText} src={url} />;
};

export default Image;
