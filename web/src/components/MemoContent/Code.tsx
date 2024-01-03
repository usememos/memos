interface Props {
  content: string;
}

const Code: React.FC<Props> = ({ content }: Props) => {
  return <code className="text-sm">`{content}`</code>;
};

export default Code;
