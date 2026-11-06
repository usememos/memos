import { Skeleton } from "@usememos/ui";
import { ArrowRightIcon, CompassIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useInstance } from "@/contexts/InstanceContext";
import { ROUTES } from "@/router/routes";
import { InstanceAccessMode } from "@/types/proto/api/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import AuthFooter from "./AuthFooter";
import MemosLogo from "./MemosLogo";

interface Props {
  chip?: React.ReactNode;
  title: string;
  subtitle?: string;
  // Hide the explore band on pages that shouldn't offer an exit (e.g. first-run setup).
  hideExplore?: boolean;
  children: React.ReactNode;
}

export const AuthChip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-mu-line bg-mu-hover/50 px-2.5 py-0.5 mu-label-sm uppercase tracking-widest text-mu-ink-muted">
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
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-mu-hover text-mu-ink-muted">{icon}</div>
    <p className="mu-label text-mu-ink">{title}</p>
    <p className="mt-1 mu-body text-mu-ink-muted">{description}</p>
    {children}
  </div>
);

// "Already have an account? Sign in" style prompt for hopping between auth pages.
export const AuthLinkPrompt = ({ prompt, to, label }: { prompt: string; to: string; label: string }) => (
  <p className="mt-5 text-center mu-body text-mu-ink-muted">
    {prompt}{" "}
    <Link to={to} className="text-mu-accent hover:underline" viewTransition>
      {label}
    </Link>
  </p>
);

export const AuthOptionsLoading = () => <Skeleton height={32} />;

const AuthPageLayout = ({ chip, title, subtitle, hideExplore, children }: Props) => {
  const t = useTranslate();
  const { profile } = useInstance();
  const showExplore = profile.accessMode === InstanceAccessMode.PUBLIC && !hideExplore;

  return (
    <div className="min-h-svh w-full flex flex-col items-center px-4 py-4 sm:py-8">
      <div className="w-full grow flex flex-col justify-center items-center">
        <div className="w-90 max-w-full rounded-mu-xl border border-mu-line bg-mu-surface p-7">
          <MemosLogo size="lg" className="mb-8" />
          {chip && <div className="mb-2">{chip}</div>}
          <h1 className="mu-heading text-mu-ink">{title}</h1>
          {subtitle && <p className="mt-1 mu-body text-mu-ink-muted">{subtitle}</p>}
          <div className="mt-6 w-full">{children}</div>
          {showExplore && (
            <div className="-mx-7 -mb-7 mt-6 rounded-b-mu-xl border-t border-mu-line bg-mu-canvas/60">
              <Link
                to={ROUTES.EXPLORE}
                className="group flex items-center justify-center gap-2 px-7 py-3 mu-caption text-mu-ink-muted transition-colors hover:text-mu-ink"
                viewTransition
              >
                <CompassIcon className="mu-icon-sm" />
                {t("auth.explore-public-memos")}
                <ArrowRightIcon className="mu-icon-sm -ms-1 opacity-0 transition-all group-hover:ms-0 group-hover:opacity-100 rtl:rotate-180" />
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
