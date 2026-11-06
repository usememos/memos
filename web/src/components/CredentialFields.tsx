import { Field, Input } from "@usememos/ui";
import { useTranslate } from "@/utils/i18n";

interface Props {
  idPrefix: string;
  username: string;
  password: string;
  passwordAutoComplete: "current-password" | "new-password";
  readOnly?: boolean;
  onUsernameChange: (username: string) => void;
  onPasswordChange: (password: string) => void;
}

// Username + password field pair shared by the sign-in and sign-up forms.
const CredentialFields = ({ idPrefix, username, password, passwordAutoComplete, readOnly, onUsernameChange, onPasswordChange }: Props) => {
  const t = useTranslate();

  return (
    <>
      <Field.Root>
        <Field.Label>{t("common.username")}</Field.Label>
        <Input
          id={`${idPrefix}-username`}
          type="text"
          readOnly={readOnly}
          placeholder={t("common.username")}
          value={username}
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => onUsernameChange(e.target.value)}
          required
        />
      </Field.Root>
      <Field.Root>
        <Field.Label>{t("common.password")}</Field.Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          readOnly={readOnly}
          placeholder={t("common.password")}
          value={password}
          autoComplete={passwordAutoComplete}
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
        />
      </Field.Root>
    </>
  );
};

export default CredentialFields;
