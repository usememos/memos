interface Props {
  url: string;
  text?: string;
}

const Link: React.FC<Props> = ({ text, url }: Props) => {
  return (
    <a
      className="text-blue-600 dark:text-blue-400 cursor-pointer underline break-all hover:opacity-80 decoration-1"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {text || url}
    </a>
  );
};

export default Link;
