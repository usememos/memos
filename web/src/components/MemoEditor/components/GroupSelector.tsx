import { CheckIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useGroups } from "@/hooks/useGroupQueries";

interface Props {
  selectedGroupNames: string[];
  onChange: (groupNames: string[]) => void;
}

const GroupSelector = (props: Props) => {
  const { selectedGroupNames, onChange } = props;
  const { data: groups = [] } = useGroups();
  const [displayText, setDisplayText] = useState("Select Groups");

  useEffect(() => {
    if (!selectedGroupNames || selectedGroupNames.length === 0) {
      setDisplayText("Select Groups");
    } else if (selectedGroupNames.length === 1) {
      const group = groups.find((g) => g.name === selectedGroupNames[0]);
      setDisplayText(group?.displayName || "Selected");
    } else {
      setDisplayText(`${selectedGroupNames.length} Groups`);
    }
  }, [selectedGroupNames, groups]);

  const toggleGroup = (name: string) => {
    const current = selectedGroupNames || [];
    if (current.includes(name)) {
      onChange(current.filter((n) => n !== name));
    } else {
      onChange([...current, name]);
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
          {groups.length === 0 && <div className="p-2 text-sm text-gray-400">No groups found</div>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default GroupSelector;
