interface Props {
  className?: string;
}

const RequiredBadge: React.FC<Props> = (props: Props) => {
  const { className } = props;

  return <span className={`mx-0.5 text-destructive font-bold ${className ?? ""}`}>*</span>;
};

export default RequiredBadge;
