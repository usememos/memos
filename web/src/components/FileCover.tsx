import Icon from "../components/Icon";

// todo optimize by useMemo.
interface FileCoverProps {
  resource: Resource;
}

const FileCover = ({ resource }: FileCoverProps) => {
  console.log(resource.type);
  return <Icon.FileImage className="w-32 h-32 ml-auto mr-auto" />;
};

export default FileCover;
