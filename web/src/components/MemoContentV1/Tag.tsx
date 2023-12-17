interface Props {
  content: string;
}

const Tag: React.FC<Props> = ({ content }: Props) => {
  return <span className="inline-block w-auto text-blue-600 dark:text-blue-400">#{content}</span>;
};

export default Tag;
