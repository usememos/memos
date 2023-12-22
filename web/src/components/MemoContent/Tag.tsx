interface Props {
  content: string;
}

const Tag: React.FC<Props> = ({ content }: Props) => {
  return (
    <span className="tag-container cursor-pointer inline-block w-auto text-blue-600 dark:text-blue-400 hover:opacity-80">#{content}</span>
  );
};

export default Tag;
