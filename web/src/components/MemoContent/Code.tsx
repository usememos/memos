interface Props {
  content: string;
}

const Code: React.FC<Props> = ({ content }: Props) => {
  return <code className="inline break-all px-1 py-0.5 leading-none text-sm rounded bg-gray-100 dark:bg-zinc-700">{content}</code>;
};

export default Code;
