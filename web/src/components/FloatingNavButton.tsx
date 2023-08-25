import { Dropdown, IconButton, Menu, MenuButton, MenuItem } from "@mui/joy";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";

const FloatingNavButton = () => {
  const navigate = useNavigate();

  return (
    <>
      <Dropdown>
        <div className="fixed bottom-6 right-6">
          <MenuButton
            slots={{ root: IconButton }}
            slotProps={{ root: { className: "!bg-white dark:!bg-zinc-900  drop-shadow", variant: "outlined", color: "neutral" } }}
          >
            <Icon.MoreVertical className="w-5 h-auto" />
          </MenuButton>
        </div>
        <Menu placement="top-end">
          <MenuItem onClick={() => navigate("/")}>Back to home</MenuItem>
        </Menu>
      </Dropdown>
    </>
  );
};

export default FloatingNavButton;
