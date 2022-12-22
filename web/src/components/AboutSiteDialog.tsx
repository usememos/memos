import { useTranslation } from "react-i18next";
import { useGlobalStore } from "../store/module";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import GitHubBadge from "./GitHubBadge";
import "../less/about-site-dialog.less";

type Props = DialogProps;

const AboutSiteDialog: React.FC<Props> = ({ destroy }: Props) => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const profile = globalStore.state.systemStatus.profile;

  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text flex items-center">
          <img className="w-7 h-auto mr-1" src="/logo.png" alt="" />
          {t("common.about")} memos
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <p>{t("slogan")}</p>
        <div className="border-t mt-1 pt-2 flex flex-row justify-start items-center">
          <span className=" text-gray-500 mr-2">Other projects:</span>
          <a href="https://github.com/boojack/sticky-notes" className="flex items-center underline text-blue-600 hover:opacity-80">
            <img
              className="w-5 h-auto mr-1"
              src="https://raw.githubusercontent.com/boojack/sticky-notes/main/public/sticky-notes.ico"
              alt=""
            />
            <span>Sticky notes</span>
          </a>
        </div>
        <div className="mt-4 flex flex-row text-sm justify-start items-center">
          <GitHubBadge />
          <span className="ml-2">
            {t("common.version")}:
            <span className="font-mono">
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
      dialogName: "about-site-dialog",
    },
    AboutSiteDialog
  );
}
