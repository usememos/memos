interface Props {
  content: string;
}

const Code: React.FC<Props> = ({ content }: Props) => {
  return <code className="inline break-all px-1 font-mono text-sm rounded bg-muted text-muted-foreground">{content}</code>;
};

export default Code;
