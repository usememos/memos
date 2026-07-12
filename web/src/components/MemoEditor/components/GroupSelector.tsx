import { CheckIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useGroups } from "@/hooks/useGroupQueries";
import { useTranslate } from "@/utils/i18n";

interface Props {
  selectedGroupNames: string[];
  onChange: (groupNames: string[]) => void;
}

const GroupSelector = (props: Props) => {
  const { selectedGroupNames, onChange } = props;
  const t = useTranslate();
  const { data: groups = [] } = useGroups();
  const [displayText, setDisplayText] = useState(t("group.select-groups"));

  useEffect(() => {
    if (!selectedGroupNames || selectedGroupNames.length === 0) {
      setDisplayText(t("group.select-groups"));
    } else {
      const group = groups.find((g) => g.name === selectedGroupNames[0]);
      setDisplayText(group?.displayName || t("group.selected"));
    }
  }, [selectedGroupNames, groups, t]);

  const toggleGroup = (name: string) => {
    const current = selectedGroupNames || [];
    if (current.includes(name)) {
      onChange([]);
    } else {
      onChange([name]);
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-zinc-800 rounded-md border border-gray-100 dark:border-zinc-700">
      <UsersIcon className="w-4 h-4 text-gray-500" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="text-sm text-gray-600 dark:text-gray-400 hover:opacity-80 transition-opacity flex items-center gap-1">
            {displayText}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          {groups.map((group) => (
            <DropdownMenuItem
              key={group.name}
              className="cursor-pointer flex items-center justify-between"
              onClick={(e) => {
                e.preventDefault();
                toggleGroup(group.name);
              }}
            >
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4 opacity-60" />
                <span>{group.displayName}</span>
              </div>
              {selectedGroupNames.includes(group.name) && <CheckIcon className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          {groups.length === 0 && <div className="p-2 text-sm text-gray-400">{t("group.no-groups-found")}</div>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default GroupSelector;
