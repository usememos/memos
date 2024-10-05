import AppearanceSelect from "@/components/AppearanceSelect";
import LocaleSelect from "@/components/LocaleSelect";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { useCommonContext } from "@/layouts/CommonContextProvider";
import { useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceGeneralSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";

const AdminSignIn = () => {
  const commonContext = useCommonContext();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const workspaceGeneralSetting =
    workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.GENERAL).generalSetting || WorkspaceGeneralSetting.fromPartial({});

  const handleLocaleSelectChange = (locale: Locale) => {
    commonContext.setLocale(locale);
  };

  const handleAppearanceSelectChange = (appearance: Appearance) => {
    commonContext.setAppearance(appearance);
  };

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-[100svh] mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-row justify-center items-center mb-6">
          <img className="h-14 w-auto rounded-full shadow" src={workspaceGeneralSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
          <p className="ml-2 text-5xl text-black opacity-80 dark:text-gray-200">
            {workspaceGeneralSetting.customProfile?.title || "Memos"}
          </p>
        </div>
        <p className="w-full text-xl font-medium dark:text-gray-500">Sign in with admin accounts</p>
        <PasswordSignInForm />
      </div>
      <div className="mt-4 flex flex-row items-center justify-center w-full gap-2">
        <LocaleSelect value={commonContext.locale} onChange={handleLocaleSelectChange} />
        <AppearanceSelect value={commonContext.appearance as Appearance} onChange={handleAppearanceSelectChange} />
      </div>
    </div>
  );
};

export default AdminSignIn;
