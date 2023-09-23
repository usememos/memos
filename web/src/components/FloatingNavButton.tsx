import { Dropdown, IconButton, Menu, MenuButton } from "@mui/joy";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useTranslate } from "@/utils/i18n";
import Icon from "./Icon";

const FloatingNavButton = () => {
  const navigateTo = useNavigateTo();
  const t = useTranslate();

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
            className="w-full text-left text-sm whitespace-nowrap leading-6 py-1 px-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-600"
            onClick={() => navigateTo("/")}
          >
            {t("router.back-to-home")}
          </button>
        </Menu>
      </Dropdown>
    </>
  );
};

export default FloatingNavButton;
