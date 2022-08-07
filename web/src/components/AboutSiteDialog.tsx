import { useEffect, useState } from "react";
import * as api from "../helpers/api";
import useI18n from "../hooks/useI18n";
import Only from "./common/OnlyWhen";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import GitHubBadge from "./GitHubBadge";
import "../less/about-site-dialog.less";

interface Props extends DialogProps {}

const AboutSiteDialog: React.FC<Props> = ({ destroy }: Props) => {
  const [profile, setProfile] = useState<Profile>();
  const { t, setLocale } = useI18n();

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

    setTimeout(() => {
      setLocale("zh");
    }, 2333);
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🤠</span>
          {t("about")} <b>Memos</b>
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <p>
          Memos is an <i>open source</i>, <i>self-hosted</i> knowledge base that works with a SQLite db file.
        </p>
        <br />
        <div className="addtion-info-container">
          <GitHubBadge />
          <Only when={profile !== undefined}>
            <>
              version:
              <span className="pre-text">
                {profile?.version}-{profile?.mode}
              </span>
              🎉
            </>
          </Only>
        </div>
      </div>
    </>
  );
};

export default function showAboutSiteDialog(): void {
  generateDialog(
    {
      className: "about-site-dialog",
    },
    AboutSiteDialog
  );
}
