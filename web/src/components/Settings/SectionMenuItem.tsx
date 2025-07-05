import { LucideIcon } from "lucide-react";
import React from "react";

interface SettingMenuItemProps {
  text: string;
  icon: LucideIcon;
  isSelected: boolean;
  onClick: () => void;
}

const SectionMenuItem: React.FC<SettingMenuItemProps> = ({ text, icon: IconComponent, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`w-auto max-w-full px-3 leading-8 flex flex-row justify-start items-center cursor-pointer rounded-lg select-none hover:opacity-80 ${
        isSelected ? "bg-accent shadow" : ""
      }`}
    >
      <IconComponent className="w-4 h-auto mr-2 opacity-80 shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  );
};

export default SectionMenuItem;
