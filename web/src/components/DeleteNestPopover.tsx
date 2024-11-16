import { Select, Option } from "@mui/joy";
import { Button } from "@usememos/mui";
import { TrashIcon } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { useCommonContext } from "@/layouts/CommonContextProvider";
import { useNestList, useNestStore, useUserStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import NestIcon from "./NestIcon";

interface Props {
  nest: string;
}

const DeleteNestPopover = (props: Props) => {
  const { nest } = props;
  const t = useTranslate();
  const nestStore = useNestStore();
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);
  const [newNestID, setNewNestID] = useState<string>("");
  const commonContext = useCommonContext();
  const nests = useNestList();
  const userStore = useUserStore();

  const deleteNest = async () => {
    if (nest == userStore.userSetting?.nest) {
      await userStore.updateUserSetting(
        {
          nest: newNestID,
        },
        ["nest"],
      );
    }
    await nestStore.deleteNest({
      id: nest,
      moveTo: newNestID,
    });
    await nestStore.fetchNests();
    commonContext.setNest(newNestID);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger className="w-9">
        <Button className="flex items-center justify-center text-red-600" size="sm" variant="plain" asChild>
          <TrashIcon className="w-5 h-5 mx-auto p-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center">
        <div className="w-full flex flex-row justify-between items-center">
          <span className="truncate">{t("nest.delete-nest-move-to-nest")}</span>
          <Select
            className="!min-w-fit"
            value={newNestID}
            startDecorator={<NestIcon />}
            onChange={(_, nest) => {
              if (nest) {
                setNewNestID(nest);
              }
            }}
          >
            {nests
              .filter((v) => v.id !== nest)
              .map((v) => (
                <Option key={v.id} value={v.id} className="whitespace-nowrap">
                  {v.name}
                </Option>
              ))}
          </Select>
        </div>
        <div className="mt-2 w-full flex flex-row justify-end items-center gap-2">
          <Button size="sm" color="primary" onClick={deleteNest}>
            {t("common.delete")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DeleteNestPopover;
