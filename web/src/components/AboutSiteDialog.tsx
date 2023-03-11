import { useTranslation } from "react-i18next";
import { useGlobalStore } from "../store/module";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import GitHubBadge from "./GitHubBadge";

type Props = DialogProps;

const AboutSiteDialog: React.FC<Props> = ({ destroy }: Props) => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const profile = globalStore.state.systemStatus.profile;
  const customizedProfile = globalStore.state.systemStatus.customizedProfile;

  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text flex items-center">
          {t("common.about")} {customizedProfile.name}
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="flex flex-col justify-start items-start max-w-full w-96">
        <p className="text-sm">{customizedProfile.description || "No description"}</p>
        <div className="mt-4 w-full flex flex-row text-sm justify-start items-center">
          <div className="flex flex-row justify-start items-center mr-2">
            Powered by
            <a href="https://usememos.com" target="_blank" className="flex flex-row justify-start items-center mr-1 hover:underline">
              <img className="w-6 h-auto" src="/logo.png" alt="" />
              memos
            </a>
            <span>v{profile.version}</span>
          </div>
          <GitHubBadge />
        </div>
        <div className="border-t w-full mt-3 pt-2 text-sm flex flex-row justify-start items-center space-x-2">
          <span className="text-gray-500">Other projects:</span>
          <a
            href="https://github.com/boojack/sticky-notes"
            target="_blank"
            className="flex items-center underline text-blue-600 hover:opacity-80"
          >
            <img
              className="w-4 h-auto mr-1"
              src="https://raw.githubusercontent.com/boojack/sticky-notes/main/public/sticky-notes.ico"
              alt=""
            />
            <span>Sticky notes</span>
          </a>
          <a href="https://star-history.com" target="_blank" className="flex items-center underline text-blue-600 hover:opacity-80">
            <img className="w-4 h-auto mr-1" src="https://star-history.com/icon.png" alt="" />
            <span>Star history</span>
          </a>
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
