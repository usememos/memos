import { ReactNode, useEffect, useRef } from "react";
import useToggle from "../../hooks/useToggle";
import Icon from "../Icon";
import "../../less/common/dropdown.less";

interface DropdownProps {
  children?: ReactNode;
  className?: string;
}

const Dropdown: React.FC<DropdownProps> = (props: DropdownProps) => {
  const { children, className } = props;
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
    <div ref={dropdownWrapperRef} className={`dropdown-wrapper ${className ?? ""}`} onClick={() => toggleDropdownStatus()}>
      <span className="trigger-button">
        <Icon.MoreHorizontal className="icon-img" />
      </span>
      <div className={`action-buttons-container ${dropdownStatus ? "" : "!hidden"}`}>{children}</div>
    </div>
  );
};

export default Dropdown;
