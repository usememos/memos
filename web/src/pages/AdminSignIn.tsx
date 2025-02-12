import AuthFooter from "@/components/AuthFooter";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { workspaceStore } from "@/store/v2";

const AdminSignIn = () => {
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;

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
      <AuthFooter />
    </div>
  );
};

export default AdminSignIn;
