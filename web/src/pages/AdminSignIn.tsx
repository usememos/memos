import { observer } from "mobx-react-lite";
import AuthFooter from "@/components/AuthFooter";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { workspaceStore } from "@/store";

const AdminSignIn = observer(() => {
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-svh mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-row justify-center items-center mb-6">
          <img className="h-14 w-auto rounded-full shadow" src={workspaceGeneralSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
          <p className="ml-2 text-5xl text-foreground opacity-80">{workspaceGeneralSetting.customProfile?.title || "Memos"}</p>
        </div>
        <p className="w-full text-xl font-medium text-muted-foreground">Sign in with admin accounts</p>
        <PasswordSignInForm />
      </div>
      <AuthFooter />
    </div>
  );
});

export default AdminSignIn;
