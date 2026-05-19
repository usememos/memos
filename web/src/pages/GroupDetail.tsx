import { Edit3Icon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import CreateGroupDialog from "@/components/CreateGroupDialog";
import MobileHeader from "@/components/MobileHeader";
import { useGroups, useDeleteGroup } from "@/hooks/useGroupQueries";
import { handleError } from "@/lib/error";
import { Group } from "@/types/proto/api/v1/group_service_pb";
import { useTranslate } from "@/utils/i18n";

const GroupDetail = () => {
  const t = useTranslate();
  const { data: groups, isLoading } = useGroups();
  const deleteGroup = useDeleteGroup();
  const navigate = useNavigate();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | undefined>(undefined);

  const handleCreateGroup = () => {
    setSelectedGroup(undefined);
    setCreateDialogOpen(true);
  };

  const handleEditGroup = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    setSelectedGroup(group);
    setCreateDialogOpen(true);
  };

  const handleDeleteGroup = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteGroup = async () => {
    if (selectedGroup) {
      try {
        await deleteGroup.mutateAsync(selectedGroup.name);
      } catch (error: unknown) {
        handleError(error, toast.error, {
          context: "Delete group",
        });
        throw error;
      }
    }
  };

  return (
    <section className="w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <UsersIcon className="w-8 h-8 mr-3 text-gray-500" />
            <h1 className="text-3xl font-bold">Groups</h1>
          </div>
          <button 
            onClick={handleCreateGroup}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Group
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            <p className="text-gray-500">Loading groups...</p>
          ) : (
            groups?.map((group) => (
              <div 
                key={group.name} 
                onClick={() => navigate(`/groups/${encodeURIComponent(group.name)}`)}
                className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-zinc-700 hover:shadow-md transition-shadow cursor-pointer block"
              >
                <h3 className="text-xl font-semibold mb-2">{group.displayName}</h3>
                <p className="text-gray-500 dark:text-gray-400">{group.description}</p>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-700 flex items-center justify-between">
                  <div className="text-sm text-primary flex items-center">
                    View Timeline <span className="ml-1">&rarr;</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={(e) => handleEditGroup(e, group)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-400"
                    >
                      <Edit3Icon className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteGroup(e, group)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400"
                    >
                      <Trash2Icon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        group={selectedGroup}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Group"
        description="Are you sure you want to delete this group?"
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteGroup}
        confirmVariant="destructive"
      />
    </section>
  );
};

export default GroupDetail;
