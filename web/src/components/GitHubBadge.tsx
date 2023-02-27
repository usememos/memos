import { useEffect, useState } from "react";
import * as api from "../helpers/api";
import Icon from "./Icon";

const GitHubBadge = () => {
  const [starCount, setStarCount] = useState(0);

  useEffect(() => {
    api.getRepoStarCount().then((data) => {
      setStarCount(data);
    });
  }, []);

  return (
    <a
      className="h-7 flex flex-row justify-start items-center border dark:border-zinc-600 rounded cursor-pointer hover:opacity-80"
      href="https://github.com/usememos/memos"
      target="_blank"
      rel="noreferrer"
    >
      <div className="apply w-auto h-full px-2 flex flex-row justify-center items-center text-xs bg-gray-100 dark:bg-zinc-700">
        <Icon.Github className="mr-1 w-4 h-4" />
        Star
      </div>
      <div className="w-auto h-full flex flex-row justify-center items-center px-3 text-xs font-bold">{starCount || ""}</div>
    </a>
  );
};

export default GitHubBadge;
