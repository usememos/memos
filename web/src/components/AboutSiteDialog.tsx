import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../helpers/api";
import Only from "./common/OnlyWhen";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import GitHubBadge from "./GitHubBadge";
import "../less/about-site-dialog.less";

type Props = DialogProps;

const AboutSiteDialog: React.FC<Props> = ({ destroy }: Props) => {
  const { t } = useTranslation();
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
          <span className="icon-text">🤠</span>
          {t("common.about")}
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <img className="logo-img" src="/logo-full.webp" alt="" />
        <p>{t("slogan")}</p>
        <br />
        <div className="addtion-info-container">
          <GitHubBadge />
          <Only when={profile !== undefined}>
            <>
              {t("common.version")}:
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
