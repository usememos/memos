import { Dropdown, IconButton, Menu, MenuButton } from "@mui/joy";
import { useEffect } from "react";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";

const FloatingNavButton = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();

  useEffect(() => {
    handleScrollToTop();
  }, []);

  const handleScrollToTop = () => {
    document.body.querySelector("#root")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <Dropdown>
        <div className="fixed bottom-6 right-6">
          <MenuButton
            slots={{ root: IconButton }}
            slotProps={{
              root: { className: "!bg-white dark:!bg-zinc-900 drop-shadow", size: "sm", variant: "outlined", color: "neutral" },
            }}
          >
            <Icon.MoreVertical className="w-4 h-auto" />
          </MenuButton>
        </div>
        <Menu placement="top-end">
          <button
            className="w-full text-left text-sm flex flex-row justify-start items-center whitespace-nowrap leading-6 py-1 px-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-600"
            onClick={handleScrollToTop}
          >
            <Icon.ArrowUpToLine className="w-4 h-auto mr-1 opacity-70" />
            {t("router.back-to-top")}
          </button>
          <button
            className="w-full text-left text-sm flex flex-row justify-start items-center whitespace-nowrap leading-6 py-1 px-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-600"
            onClick={() => navigateTo("/")}
          >
            <Icon.Home className="w-4 h-auto mr-1 opacity-70" />
            {t("router.go-to-home")}
          </button>
        </Menu>
      </Dropdown>
    </>
  );
};

export default FloatingNavButton;
