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

  const handleClick = () => {
    window.location.href = "https://github.com/usememos/memos";
  };

  return (
    <div className="github-badge-container" onClick={handleClick}>
      <div className="github-icon">
        <img className="icon-img" src="/github.webp" alt="" />
        Star
      </div>
      <span className={`count-text ${starCount || "pulse"}`}>{starCount || "🌟"}</span>
    </div>
  );
};

export default GitHubBadge;
