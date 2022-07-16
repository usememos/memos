import { useEffect, useState } from "react";
import * as api from "../helpers/api";
import "../less/github-badge.less";

interface Props {}

const GitHubBadge: React.FC<Props> = () => {
  const [starCount, setStarCount] = useState(0);

  useEffect(() => {
    api.getRepoStarCount().then((data) => {
      setStarCount(data);
    });
  }, []);

  return (
    <a className="github-badge-container" href="https://github.com/usememos/memos">
      <div className="github-icon">
        <img className="icon-img" src="/github.webp" alt="" />
        Star
      </div>
      <div className="count-text">
        {starCount || ""}
        <span className="icon-text">🌟</span>
      </div>
    </a>
  );
};

export default GitHubBadge;
