import "../less/beta-badge.less";

interface Props {
  className?: string;
}

const BetaBadge: React.FC<Props> = (props: Props) => {
  const { className } = props;

  return <span className={`beta-badge ${className ?? ""}`}>beta</span>;
};

export default BetaBadge;
