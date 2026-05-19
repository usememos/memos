import { create } from "@bufbuild/protobuf";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateGroup, useUpdateGroup } from "@/hooks/useGroupQueries";
import useLoading from "@/hooks/useLoading";
import { handleError } from "@/lib/error";
import { Group, GroupSchema } from "@/types/proto/api/v1/group_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: Group;
  onConfirm?: () => void;
}

function CreateGroupDialog({ open, onOpenChange, group: initialGroup, onConfirm }: Props) {
  const t = useTranslate();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const requestState = useLoading(false);

  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");

  const isCreating = !initialGroup;

  useEffect(() => {
    if (initialGroup) {
      setDisplayName(initialGroup.displayName);
      setDescription(initialGroup.description);
    } else {
      setDisplayName("");
      setDescription("");
    }
  }, [initialGroup, open]);

  const handleConfirm = async () => {
    if (!displayName.trim()) {
      toast.error("Group name cannot be empty");
      return;
    }

    try {
      requestState.setLoading();
      if (isCreating) {
        await createGroup.mutateAsync({ displayName, description });
        toast.success("Create group successfully");
      } else {
        const updateMask: string[] = [];
        const groupToUpdate = create(GroupSchema, {
          name: initialGroup.name,
          displayName,
          description,
        });

        if (displayName !== initialGroup.displayName) {
          updateMask.push("display_name");
        }
        if (description !== initialGroup.description) {
          updateMask.push("description");
        }

        if (updateMask.length > 0) {
          await updateGroup.mutateAsync({
            group: groupToUpdate,
            updateMask,
          });
        }
        toast.success("Update group successfully");
      }
      requestState.setFinish();
      onConfirm?.();
      onOpenChange(false);
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: isCreating ? "Create group" : "Update group",
        onError: () => requestState.setError(),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{`${isCreating ? t("common.create") : t("common.edit")} ${t("common.groups")}`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Group Name</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Enter group name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter group description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={requestState.isLoading} onClick={handleConfirm}>
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateGroupDialog;
