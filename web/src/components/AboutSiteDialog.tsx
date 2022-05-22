import { useEffect, useState } from "react";
import * as api from "../helpers/api";
import Only from "./common/OnlyWhen";
import { showDialog } from "./Dialog";
import "../less/about-site-dialog.less";

interface Props extends DialogProps {}

const AboutSiteDialog: React.FC<Props> = ({ destroy }: Props) => {
  const [profile, setProfile] = useState<Profile>();

  useEffect(() => {
    try {
      api.getSystemStatus().then(({ data }) => {
        const {
          data: { profile },
        } = data;
        setProfile(profile);
      });
    } catch (error) {
      setProfile({
        mode: "dev",
        version: "0.0.0",
      });
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
          Memos is an <i>open source</i>, <i>self-hosted</i> knowledge base that works with a SQLite db file.
        </p>
        <br />
        <p>
          <a href="https://github.com/usememos/memos">🏗 Source code</a>, and built by <a href="https://github.com/boojack">Steven 🐯</a>.
        </p>
        <Only when={profile !== undefined}>
          <p className="updated-time-text">
            version: <span className="pre-text">{profile?.version}</span> 🎉
          </p>
        </Only>
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
