import { ReactNode, useEffect, useRef } from "react";
import useToggle from "../../hooks/useToggle";
import Icon from "../Icon";

interface Props {
  trigger?: ReactNode;
  actions?: ReactNode;
  className?: string;
  actionsClassName?: string;
  positionClassName?: string;
}

const Dropdown: React.FC<Props> = (props: Props) => {
  const { trigger, actions, className, actionsClassName, positionClassName } = props;
  const [dropdownStatus, toggleDropdownStatus] = useToggle(false);
  const dropdownWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dropdownStatus) {
      const handleClickOutside = (event: MouseEvent) => {
        if (!dropdownWrapperRef.current?.contains(event.target as Node)) {
          toggleDropdownStatus(false);
        }
      };
      window.addEventListener("click", handleClickOutside, {
        capture: true,
        once: true,
      });
    }
  }, [dropdownStatus]);

  return (
    <div
      ref={dropdownWrapperRef}
      className={`relative flex flex-col justify-start items-start select-none ${className ?? ""}`}
      onClick={() => toggleDropdownStatus()}
    >
      {trigger ? (
        trigger
      ) : (
        <button className="flex flex-row justify-center items-center border dark:border-zinc-700 p-1 rounded shadow text-gray-600 dark:text-gray-200 cursor-pointer hover:opacity-80">
          <Icon.MoreHorizontal className="w-4 h-auto" />
        </button>
      )}
      <div
        className={`w-auto absolute flex flex-col justify-start items-start bg-white dark:bg-zinc-700 z-10 p-1 rounded-md shadow ${
          actionsClassName ?? ""
        } ${dropdownStatus ? "" : "!hidden"} ${positionClassName ?? "top-full right-0 mt-1"}`}
      >
        {actions}
      </div>
    </div>
  );
};

export default Dropdown;
