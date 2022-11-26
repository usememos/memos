import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import GitHubBadge from "./GitHubBadge";
import "../less/about-site-dialog.less";

type Props = DialogProps;

const AboutSiteDialog: React.FC<Props> = ({ destroy }: Props) => {
  const { t } = useTranslation();
  const profile = useAppSelector((state) => state.global.systemStatus.profile);

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
        <div className="addition-info-container">
          <GitHubBadge />
          <>
            {t("common.version")}:
            <span className="pre-text">
              {profile.version}-{profile.mode}
            </span>
            🎉
          </>
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
