interface Props {
  symbol: string;
}

const EscapingCharacter: React.FC<Props> = ({ symbol }: Props) => {
  return <span>{symbol}</span>;
};

export default EscapingCharacter;
