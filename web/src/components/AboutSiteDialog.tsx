import { useEffect, useState } from "react";
import utils from "../helpers/utils";
import { showDialog } from "./Dialog";
import "../less/about-site-dialog.less";

interface Props extends DialogProps {}

const AboutSiteDialog: React.FC<Props> = ({ destroy }: Props) => {
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  useEffect(() => {
    try {
      fetch("https://api.github.com/repos/justmemos/memos/commits/main").then(async (res) => {
        const data = (await res.json()) as any;
        setLastUpdatedAt(utils.getDateTimeString(new Date(data.commit.committer.date)));
      });
    } catch (error) {
      setLastUpdatedAt("2017/12/31");
    }
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🤠</span>About <b>Memos</b>
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        <p>
          Memos is an open source, self-hosted alternative to <a href="https://flomoapp.com">flomo</a>.
        </p>
        <p>Built with `Golang` and `React`.</p>
        <br />
        <p>
          🏗 <a href="https://github.com/justmemos/memos">This project</a> is working in progress, and very pleasure to your{" "}
          <a href="https://github.com/justmemos/memos/issues">issues</a>.
        </p>
        <p className="updated-time-text">
          Last updated on <span className="pre-text">{lastUpdatedAt}</span> 🎉
        </p>
      </div>
    </>
  );
};

export default function showAboutSiteDialog(): void {
  showDialog(
    {
      className: "about-site-dialog",
    },
    AboutSiteDialog
  );
}
