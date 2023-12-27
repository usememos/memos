interface Props {
  url: string;
}

const AutoLink: React.FC<Props> = ({ url }: Props) => {
  return (
    <a
      className="text-blue-600 dark:text-blue-400 cursor-pointer underline break-all hover:opacity-80 decoration-1"
      href={url}
      target="_blank"
    >
      {url}
    </a>
  );
};

export default AutoLink;
