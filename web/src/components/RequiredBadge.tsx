interface Props {
  className?: string;
}

const RequiredBadge: React.FC<Props> = (props: Props) => {
  const { className } = props;

  return <span className={`mx-0.5 text-red-500 font-bold ${className ?? ""}`}>*</span>;
};

export default RequiredBadge;
