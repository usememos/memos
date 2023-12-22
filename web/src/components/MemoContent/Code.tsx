interface Props {
  content: string;
}

const Code: React.FC<Props> = ({ content }: Props) => {
  return <code>{content}</code>;
};

export default Code;
