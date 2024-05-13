import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserStore } from "@/store/v1";
import { User } from "@/types/proto/api/v1/user_service";
import Icon from "../Icon";
import UserAvatar from "../UserAvatar";

const UsersSection = () => {
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
    users.length > 0 && (
      <div className="w-full border mt-2 flex flex-col p-2 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800 rounded-lg">
        <div className="w-full mb-1 flex flex-row justify-between items-center px-1">
          <span className="text-gray-400 font-medium text-sm select-none">Users</span>
          <Icon.RefreshCcw onClick={fetchRecommendUsers} className="text-gray-400 w-4 h-auto cursor-pointer hover:opacity-80" />
        </div>
        {users.map((user) => (
          <div
            key={user.name}
            className="w-full flex flex-row justify-start items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <Link className="w-full flex flex-row items-center" to={`/u/${encodeURIComponent(user.username)}`} unstable_viewTransition>
              <UserAvatar className="!w-6 !h-6 !rounded-lg mr-2 shrink-0" avatarUrl={user.avatarUrl} />
              <span className="text-gray-600 truncate dark:text-gray-400">{user.nickname || user.username}</span>
            </Link>
          </div>
        ))}
      </div>
    )
  );
};

export default UsersSection;
