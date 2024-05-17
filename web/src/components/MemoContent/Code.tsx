interface Props {
  content: string;
}

const Code: React.FC<Props> = ({ content }: Props) => {
  return <code className="inline break-all px-1 font-mono text-sm rounded opacity-80 bg-gray-100 dark:bg-zinc-700">{content}</code>;
};

export default Code;
