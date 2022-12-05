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
        <p className="title-text">{t("common.about")}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <p className="flex justify-start items-center">
          <img className="logo-img w-16 h-auto" src="/logo.webp" alt="" />
          <span className=" font-mono text-4xl">memos</span>
        </p>
        <p>{t("slogan")}</p>
        <br />
        <div className="addition-info-container">
          <GitHubBadge />
          <span className="ml-2">
            {t("common.version")}:
            <span className="pre-text">
              {profile.version}-{profile.mode}
            </span>
            🎉
          </span>
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
