import { Input } from "@mui/joy";
import { Button } from "@usememos/mui";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { useCommonContext } from "@/layouts/CommonContextProvider";
import { useNestStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

const AddNestPopover = () => {
  const t = useTranslate();
  const nestStore = useNestStore();
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);
  const [nestUID, setNestUID] = useState<string>("");
  const commonContext = useCommonContext();

  const addNest = async () => {
    const nest = await nestStore.createNest({
      uid: nestUID,
    });
    if (nest) {
      await nestStore.fetchNests();
      commonContext.setNest(nest.name);
    }
    setPopoverOpen(false);
    setNestUID("");
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger className="w-9">
        <Button className="flex items-center justify-center" size="sm" variant="plain" asChild>
          <PlusIcon className="w-5 h-5 mx-auto p-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center">
        <div className="w-[16rem] flex flex-col justify-start items-start">
          <Input
            className="w-full"
            size="md"
            placeholder={t("nest.add-nest")}
            value={nestUID}
            onChange={(e) => setNestUID(e.target.value.trim())}
          />
          <div className="mt-2 w-full flex flex-row justify-end items-center gap-2">
            <Button size="sm" color="primary" onClick={addNest} disabled={nestUID.length === 0}>
              {t("common.add")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AddNestPopover;
