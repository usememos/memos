import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import clsx from "clsx";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useCommonContext } from "@/layouts/CommonContextProvider";
import { useNestList, useNestStore } from "@/store/v1";
import AddNestPopover from "./AddNestPopover";
import NestIcon from "./NestIcon";

interface Props {
  collapsed?: boolean;
}

const NestBanner = (props: Props) => {
  const { collapsed } = props;
  const user = useCurrentUser();
  const nests = useNestList();
  const nestStore = useNestStore();
  const commonContext = useCommonContext();

  const handleNestChange = (nest: string) => {
    commonContext.setNest(nest);
  };

  return (
    <div className="flex flex-row justify-between items-center">
      <Dropdown>
        <MenuButton disabled={!user} slots={{ root: "div" }}>
          <div
            className={clsx(
              "py-1 my-1 w-auto flex flex-row justify-start items-center cursor-pointer text-gray-800 dark:text-gray-400",
              collapsed ? "px-1" : "px-3",
            )}
          >
            <NestIcon />
            {!collapsed && (
              <span className="ml-2 text-lg font-medium text-slate-800 dark:text-gray-300 shrink truncate">
                {nestStore.getNestById(commonContext.nest)?.name}
              </span>
            )}
          </div>
        </MenuButton>
        <Menu placement="bottom-start" style={{ zIndex: "9999" }}>
          {nests.map((nest) => (
            <MenuItem onClick={() => handleNestChange(nest.id)} key={nest.id}>
              <span className="truncate">{nest.name}</span>
            </MenuItem>
          ))}
        </Menu>
      </Dropdown>
      <AddNestPopover />
    </div>
  );
};

export default NestBanner;
