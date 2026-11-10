import { Button, Field, Input, Tooltip } from "@usememos/ui";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "@/utils/i18n";

interface Props {
  idPrefix: string;
  username: string;
  password: string;
  passwordAutoComplete: "current-password" | "new-password";
  readOnly?: boolean;
  // Marks both fields, for a server answer that rejects the pair rather than one of them.
  invalid?: boolean;
  onUsernameChange: (username: string) => void;
  onPasswordChange: (password: string) => void;
}

// Username + password field pair shared by the sign-in and sign-up forms.
const CredentialFields = ({
  idPrefix,
  username,
  password,
  passwordAutoComplete,
  readOnly,
  invalid = false,
  onUsernameChange,
  onPasswordChange,
}: Props) => {
  const t = useTranslate();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const visibilityLabel = passwordVisible ? t("auth.hide-password") : t("auth.show-password");

  return (
    <>
      <Field.Root invalid={invalid}>
        <Field.Label>{t("common.username")}</Field.Label>
        <Input
          id={`${idPrefix}-username`}
          type="text"
          readOnly={readOnly}
          value={username}
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => onUsernameChange(e.target.value)}
          required
        />
      </Field.Root>
      <Field.Root invalid={invalid}>
        <Field.Label>{t("common.password")}</Field.Label>
        <Input
          id={`${idPrefix}-password`}
          type={passwordVisible ? "text" : "password"}
          readOnly={readOnly}
          value={password}
          autoComplete={passwordAutoComplete}
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          suffix={
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
                    aria-label={visibilityLabel}
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  />
                }
              />
              <Tooltip.Popup>{visibilityLabel}</Tooltip.Popup>
            </Tooltip.Root>
          }
        />
      </Field.Root>
    </>
  );
};

export default CredentialFields;
