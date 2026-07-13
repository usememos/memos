import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import { Link } from "react-router-dom";
import AuthPageLayout, { AuthChip } from "@/components/AuthPageLayout";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";

const AdminSignIn = () => {
  const t = useTranslate();

  return (
    <AuthPageLayout
      chip={
        <AuthChip>
          <ShieldCheckIcon className="h-3 w-3" />
          {t("common.admin")}
        </AuthChip>
      }
      title={t("auth.admin-sign-in")}
      subtitle={t("auth.admin-sign-in-tip")}
    >
      <PasswordSignInForm />
      <p className="mt-5 text-center text-sm">
        <Link to={ROUTES.AUTH} className="inline-flex items-center gap-1 text-primary hover:underline" viewTransition>
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {t("auth.back-to-sign-in")}
        </Link>
      </p>
    </AuthPageLayout>
  );
};

export default AdminSignIn;
