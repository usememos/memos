import { MEMOS_LOGO_URL } from "../helpers/consts";

interface Props {
  avatarUrl?: string;
  className?: string;
}

const UserAvatar = (props: Props) => {
  const { avatarUrl, className } = props;
  return (
    <div className={`${className ?? ""} w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800`}>
      <img className="w-full h-auto min-w-full min-h-full object-cover" src={avatarUrl || MEMOS_LOGO_URL} alt="" />
    </div>
  );
};

export default UserAvatar;
