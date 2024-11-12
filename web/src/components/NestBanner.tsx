import { Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";
import clsx from "clsx";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useCommonContext } from "@/layouts/CommonContextProvider";
import NestIcon from "./NestIcon";
import { useNestList, useNestStore } from "@/store/v1";
import { Nest } from "@/types/proto/api/v1/nest_service";

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
            {!collapsed && (
              <span className="ml-2 text-lg font-medium text-slate-800 dark:text-gray-300 shrink truncate">{nestStore.getNestByName(commonContext.nest)?.uid}</span>
            )}
          </div>
        </MenuButton>
        <Menu placement="bottom-start" style={{ zIndex: "9999" }}>
          {nests.map((nest) => (
            <MenuItem onClick={() => handleNestChange(nest.name)} key={nest.uid}>
              <span className="truncate">{nest.uid}</span>
            </MenuItem>
          ))}
        </Menu>
      </Dropdown>
    </div>
  );
};

export default NestBanner;
