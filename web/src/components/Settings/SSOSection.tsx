import { MoreVerticalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { identityProviderServiceClient } from "@/grpcweb";
import { IdentityProvider } from "@/types/proto/api/v1/idp_service";
import { useTranslate } from "@/utils/i18n";
import showCreateIdentityProviderDialog from "../CreateIdentityProviderDialog";
import LearnMore from "../LearnMore";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

const SSOSection = () => {
  const t = useTranslate();
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);

  useEffect(() => {
    fetchIdentityProviderList();
  }, []);

  const fetchIdentityProviderList = async () => {
    const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
    setIdentityProviderList(identityProviders);
  };

  const handleDeleteIdentityProvider = async (identityProvider: IdentityProvider) => {
    const confirmed = window.confirm(t("setting.sso-section.confirm-delete", { name: identityProvider.title }));
    if (confirmed) {
      try {
        await identityProviderServiceClient.deleteIdentityProvider({ name: identityProvider.name });
      } catch (error: any) {
        console.error(error);
        toast.error(error.details);
      }
      await fetchIdentityProviderList();
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <div className="w-full flex flex-row justify-between items-center gap-1">
        <div className="flex flex-row items-center gap-1">
          <span className="font-mono text-muted-foreground">{t("setting.sso-section.sso-list")}</span>
          <LearnMore url="https://www.usememos.com/docs/advanced-settings/sso" />
        </div>
        <Button color="primary" onClick={() => showCreateIdentityProviderDialog(undefined, fetchIdentityProviderList)}>
          {t("common.create")}
        </Button>
      </div>
      <Separator />
      {identityProviderList.map((identityProvider) => (
        <div
          key={identityProvider.name}
          className="py-2 w-full border-b last:border-b border-border flex flex-row items-center justify-between"
        >
          <div className="flex flex-row items-center">
            <p className="ml-2">
              {identityProvider.title}
              <span className="text-sm ml-1 opacity-40">({identityProvider.type})</span>
            </p>
          </div>
          <div className="flex flex-row items-center">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-center p-1 hover:bg-popover rounded">
                  <MoreVerticalIcon className="w-4 h-auto" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={2}>
                <div className="flex flex-col gap-0.5 text-sm">
                  <button
                    onClick={() => showCreateIdentityProviderDialog(identityProvider, fetchIdentityProviderList)}
                    className="flex items-center gap-2 px-2 py-1 text-left text-foreground hover:bg-popover outline-none rounded"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleDeleteIdentityProvider(identityProvider)}
                    className="flex items-center gap-2 px-2 py-1 text-left text-destructive hover:bg-popover outline-none rounded"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      ))}
      {identityProviderList.length === 0 && (
        <div className="w-full mt-2 text-sm border-border opacity-60 flex flex-row items-center justify-between">
          <p className="">{t("setting.sso-section.no-sso-found")}</p>
        </div>
      )}

      <div className="w-full mt-4">
        <p className="text-sm">{t("common.learn-more")}:</p>
        <ul className="list-disc list-inside text-sm ml-4">
          <li>
            <Link className="text-sm text-primary hover:underline" to="https://www.usememos.com/docs/advanced-settings/sso" target="_blank">
              {t("setting.sso-section.single-sign-on")}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SSOSection;
