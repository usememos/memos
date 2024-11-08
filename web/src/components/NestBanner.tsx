import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import clsx from "clsx";
import useCurrentUser from "@/hooks/useCurrentUser";
import NestIcon from "./NestIcon";
import { useCommonContext } from "@/layouts/CommonContextProvider";

interface Props {
  collapsed?: boolean;
}

const NestBanner = (props: Props) => {
  const { collapsed } = props;
  const user = useCurrentUser();
  const commonContext = useCommonContext();

  const handleNestChange = (nest: number) => {
    commonContext.setNest(nest)
  }

  return (
    <div className="relative w-full h-auto px-1 shrink-0">
      <Dropdown>
        <MenuButton disabled={!user} slots={{ root: "div" }}>
          <div
            className={clsx(
              "py-1 my-1 w-auto flex flex-row justify-start items-center cursor-pointer text-gray-800 dark:text-gray-400",
              collapsed ? "px-1" : "px-3",
            )}
          >
            <NestIcon />
            {!collapsed && <span className="ml-2 text-lg font-medium text-slate-800 dark:text-gray-300 shrink truncate">Nest{commonContext.nest}</span>}
          </div>
        </MenuButton>
        <Menu placement="bottom-start" style={{ zIndex: "9999" }}>
            {[0, 1].map((item) => (
              <MenuItem onClick={() => handleNestChange(item)} key={item}>
                <span className="truncate">Nest{item}</span>
              </MenuItem>
            ))}
        </Menu>
      </Dropdown>
    </div>
  );
};

export default NestBanner;
