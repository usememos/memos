import { UsersIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useGroups } from "@/hooks/useGroupQueries";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";

const GroupsSection = () => {
  const t = useTranslate();
  const { data: groups = [] } = useGroups();

  if (groups.length === 0) {
    return (
      <div className="w-full flex flex-col justify-start items-start px-2 py-4">
        <div className="w-full flex flex-row justify-between items-center px-1 mb-2">
          <div className="flex flex-row items-center gap-1.5 text-sm font-medium text-gray-400 uppercase tracking-wider">
            <UsersIcon className="w-4 h-auto" />
            {t("common.groups")}
          </div>
          <Link to={Routes.GROUPS} className="text-xs text-primary hover:opacity-80">
            {t("common.create")}
          </Link>
        </div>
        <p className="px-1 text-xs text-gray-400">No groups joined yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col justify-start items-start px-2 py-4">
      <div className="w-full flex flex-row justify-between items-center px-1 mb-2">
        <div className="flex flex-row items-center gap-1.5 text-sm font-medium text-gray-400 uppercase tracking-wider">
          <UsersIcon className="w-4 h-auto" />
          {t("common.groups")}
        </div>
        <Link to={Routes.GROUPS} className="text-xs text-primary hover:opacity-80">
          {t("common.admin")}
        </Link>
      </div>
      <div className="w-full flex flex-col gap-1">
        {groups.map((group) => (
          <Link
            key={group.name}
            to={`/groups/${encodeURIComponent(group.name)}`}
            className="w-full px-2 py-1.5 flex flex-row items-center gap-2 text-sm text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-primary/40 shrink-0" />
            <span className="truncate">{group.displayName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default GroupsSection;
