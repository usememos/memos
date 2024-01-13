interface Props {
  altText: string;
  url: string;
}

const Image: React.FC<Props> = ({ altText, url }: Props) => {
  return <img src={url} alt={altText} decoding="async" loading="lazy" />;
};

export default Image;
