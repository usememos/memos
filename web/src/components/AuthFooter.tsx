import { observer } from "mobx-react-lite";
import { cn } from "@/lib/utils";
import { workspaceStore } from "@/store";
import AppearanceSelect from "./AppearanceSelect";
import LocaleSelect from "./LocaleSelect";

interface Props {
  className?: string;
}

const AuthFooter = observer(({ className }: Props) => {
  const handleLocaleSelectChange = (locale: Locale) => {
    workspaceStore.state.setPartial({ locale });
  };

  const handleAppearanceSelectChange = (appearance: Appearance) => {
    workspaceStore.state.setPartial({ appearance });
  };

  return (
    <div className={cn("mt-4 flex flex-row items-center justify-center w-full gap-2", className)}>
      <LocaleSelect value={workspaceStore.state.locale} onChange={handleLocaleSelectChange} />
      <AppearanceSelect value={workspaceStore.state.appearance as Appearance} onChange={handleAppearanceSelectChange} />
    </div>
  );
});

export default AuthFooter;
