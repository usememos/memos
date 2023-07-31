import { useGlobalStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import GitHubBadge from "./GitHubBadge";
import Icon from "./Icon";

type Props = DialogProps;

const AboutSiteDialog: React.FC<Props> = ({ destroy }: Props) => {
  const t = useTranslate();
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
        <p className="text-xs">{t("about.memos-description")}</p>
        <p className="text-sm mt-2 ">{customizedProfile.description || t("about.no-server-description")}</p>
        <div className="mt-4 w-full flex flex-row text-sm justify-start items-center">
          <div className="flex flex-row justify-start items-center mr-2">
            {t("about.powered-by")}
            <a href="https://usememos.com" target="_blank" className="flex flex-row justify-start items-center mx-1 hover:underline">
              <img className="w-6 h-auto rounded-full mr-1" src="/logo.webp" alt="" />
              memos
            </a>
            <span>v{profile.version}</span>
          </div>
          <GitHubBadge />
        </div>
        <div className="border-t w-full mt-3 pt-2 text-sm flex flex-row justify-start items-center space-x-4">
          <span className="text-gray-500">{t("about.other-projects")}:</span>
          <a href="https://github.com/boojack/slash" target="_blank" className="flex items-center underline text-blue-600 hover:opacity-80">
            <img className="w-4 h-auto mr-1" src="https://github.com/boojack/slash/raw/main/resources/logo.png" alt="" />
            <span>Slash</span>
          </a>
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
