interface Props {
  content: string;
}

const Highlight: React.FC<Props> = ({ content }: Props) => {
  return <mark>{content}</mark>;
};

export default Highlight;
