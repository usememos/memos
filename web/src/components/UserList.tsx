import { IconButton } from "@mui/joy";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserStore } from "@/store/v1";
import { User } from "@/types/proto/api/v2/user_service";
import Icon from "./Icon";
import UserAvatar from "./UserAvatar";

const UserList = () => {
  const userStore = useUserStore();
  const [users, setUsers] = useState<User[]>([]);

  const fetchRecommendUsers = async () => {
    const users = await userStore.searchUsers(`random == true && limit == 5`);
    setUsers(users);
  };

  useEffect(() => {
    fetchRecommendUsers();
  }, []);

  return (
    <div className="w-full mt-2 flex flex-col p-2 bg-gray-50 dark:bg-black rounded-lg">
      <div className="w-full flex flex-row justify-between items-center">
        <span className="text-gray-400 font-medium text-sm pl-1">Users</span>
        <IconButton size="sm" onClick={fetchRecommendUsers}>
          <Icon.RefreshCcw className="text-gray-400 w-4 h-auto" />
        </IconButton>
      </div>
      {users.map((user) => (
        <div
          key={user.name}
          className="w-full flex flex-row justify-start items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg"
        >
          <Link className="w-full flex flex-row items-center" to={`/u/${encodeURIComponent(user.username)}`} unstable_viewTransition>
            <UserAvatar className="mr-2 shrink-0" avatarUrl={user.avatarUrl} />
            <div className="w-full flex flex-col justify-center items-start">
              <span className="text-gray-600 leading-tight max-w-[80%] truncate dark:text-gray-400">{user.nickname || user.username}</span>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
};

export default UserList;
