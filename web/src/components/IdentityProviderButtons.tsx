import { LoaderIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { handleError } from "@/lib/error";
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
        handleError(error, toast.error, {
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
      {pendingProvider && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderIcon className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t("auth.redirecting-to-provider", { provider: pendingProvider.title })}
        </p>
      )}
      {identityProviderList.map((identityProvider) => (
        <Button
          key={identityProvider.name}
          variant="outline"
          disabled={Boolean(pendingProvider)}
          onClick={() => void handleSignInWithIdentityProvider(identityProvider)}
        >
          {t("auth.continue-with", { provider: identityProvider.title })}
        </Button>
      ))}
    </div>
  );
};

export default IdentityProviderButtons;
