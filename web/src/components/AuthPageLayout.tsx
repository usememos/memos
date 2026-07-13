import { ArrowRightIcon, CompassIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useInstance } from "@/contexts/InstanceContext";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import AuthFooter from "./AuthFooter";

interface Props {
  chip?: React.ReactNode;
  title: string;
  subtitle?: string;
  // Hide the explore band on pages that shouldn't offer an exit (e.g. first-run setup).
  hideExplore?: boolean;
  children: React.ReactNode;
}

export const AuthChip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-accent/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
    {children}
  </span>
);

// Centered icon + title + description block for states where a form cannot be shown.
export const AuthEmptyState = ({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center py-2 text-center">
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-muted-foreground">{icon}</div>
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    {children}
  </div>
);

// "Already have an account? Sign in" style prompt for hopping between auth pages.
export const AuthLinkPrompt = ({ prompt, to, label }: { prompt: string; to: string; label: string }) => (
  <p className="mt-5 text-center text-sm text-muted-foreground">
    {prompt}{" "}
    <Link to={to} className="text-primary hover:underline" viewTransition>
      {label}
    </Link>
  </p>
);

const AuthPageLayout = ({ chip, title, subtitle, hideExplore, children }: Props) => {
  const t = useTranslate();
  const { generalSetting, profile } = useInstance();
  const showExplore = Boolean(profile.instanceUrl) && !hideExplore;

  return (
    <div className="min-h-svh w-full flex flex-col items-center px-4 py-4 sm:py-8">
      <div className="w-full grow flex flex-col justify-center items-center">
        <div className="w-90 max-w-full rounded-xl border border-border bg-card p-7 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <img className="h-6 w-auto rounded-full" src={generalSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
            <span className="text-sm font-semibold text-foreground">{generalSetting.customProfile?.title || "Memos"}</span>
          </div>
          {chip && <div className="mb-2">{chip}</div>}
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6 w-full">{children}</div>
          {showExplore && (
            <div className="-mx-7 -mb-7 mt-6 rounded-b-xl border-t border-border bg-background/60">
              <Link
                to={ROUTES.EXPLORE}
                className="group flex items-center justify-center gap-2 px-7 py-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                viewTransition
              >
                <CompassIcon className="h-3.5 w-3.5" />
                {t("auth.explore-public-memos")}
                <ArrowRightIcon className="-ml-1 h-3.5 w-3.5 opacity-0 transition-all group-hover:ml-0 group-hover:opacity-100" />
              </Link>
            </div>
          )}
        </div>
      </div>
      <AuthFooter />
    </div>
  );
};

export default AuthPageLayout;
