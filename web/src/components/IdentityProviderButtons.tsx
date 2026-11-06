import { Button } from "@usememos/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { handleError } from "@/lib/error";
import { showErrorToast } from "@/lib/toast";
import { IdentityProvider } from "@/types/proto/api/idp_service_pb";
import { AUTH_AUTO_SIGN_IN_PARAM } from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";
import { getSSOConfig, signInWithSSO } from "@/utils/sso";

interface Props {
  identityProviderList: IdentityProvider[];
  redirectTarget?: string;
  autoSignIn?: boolean;
}

const IdentityProviderButtons = ({ identityProviderList, redirectTarget, autoSignIn = false }: Props) => {
  const t = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingProvider, setPendingProvider] = useState<IdentityProvider>();
  const pendingRef = useRef(false);
  const automaticAttemptedRef = useRef(false);

  const handleSignInWithIdentityProvider = useCallback(
    async (identityProvider: IdentityProvider) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPendingProvider(identityProvider);
      try {
        // Mark this history entry before leaving, so Back/reload offers manual sign-in.
        setSearchParams(
          (previous) => {
            const next = new URLSearchParams(previous);
            next.set(AUTH_AUTO_SIGN_IN_PARAM, "false");
            return next;
          },
          { replace: true },
        );
        await signInWithSSO(identityProvider, redirectTarget);
      } catch (error) {
        pendingRef.current = false;
        setPendingProvider(undefined);
        handleError(error, showErrorToast, {
          context: "Failed to initiate OAuth flow",
          fallbackMessage: "Failed to initiate sign-in. Please try again.",
        });
      }
    },
    [redirectTarget, setSearchParams],
  );

  useEffect(() => {
    const provider = identityProviderList[0];
    if (
      !autoSignIn ||
      identityProviderList.length !== 1 ||
      !provider ||
      !getSSOConfig(provider) ||
      searchParams.get(AUTH_AUTO_SIGN_IN_PARAM) === "false" ||
      automaticAttemptedRef.current
    ) {
      return;
    }
    automaticAttemptedRef.current = true;
    void handleSignInWithIdentityProvider(provider);
  }, [autoSignIn, identityProviderList, searchParams, handleSignInWithIdentityProvider]);

  useEffect(() => {
    // Back may restore the page from bfcache with React's pending state intact.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        pendingRef.current = false;
        setPendingProvider(undefined);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <div className="flex w-full flex-col gap-2">
      {identityProviderList.map((identityProvider) => (
        <Button
          key={identityProvider.name}
          variant="neutral"
          disabled={Boolean(pendingProvider)}
          loading={pendingProvider?.name === identityProvider.name}
          loadingLabel={t("auth.continue-with", { provider: identityProvider.title })}
          onClick={() => void handleSignInWithIdentityProvider(identityProvider)}
        >
          {t("auth.continue-with", { provider: identityProvider.title })}
        </Button>
      ))}
    </div>
  );
};

export default IdentityProviderButtons;
