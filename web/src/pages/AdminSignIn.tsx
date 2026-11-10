import AuthPageLayout, { AuthBackLink } from "@/components/AuthPageLayout";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { useTranslate } from "@/utils/i18n";

const AdminSignIn = () => {
  const t = useTranslate();

  return (
    <AuthPageLayout title={t("auth.admin-sign-in")}>
      <PasswordSignInForm />
      <AuthBackLink />
    </AuthPageLayout>
  );
};

export default AdminSignIn;
