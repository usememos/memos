import { Button } from "@usememos/ui";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useRouteError } from "react-router-dom";
import { translate } from "@/utils/i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-mu-canvas">
          <div className="max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-mu-danger">
              <AlertCircle className="mu-icon w-8 h-8" />
              <h1 className="mu-heading">{translate("error.title")}</h1>
            </div>

            <p className="text-mu-text/70">{translate("error.description")}</p>

            {this.state.error && (
              <details className="bg-mu-well p-3 rounded-mu-md mu-body">
                <summary className="cursor-pointer font-medium mb-2">{translate("error.details")}</summary>
                <pre className="whitespace-pre-wrap break-words mu-caption text-mu-text/60">{this.state.error.message}</pre>
              </details>
            )}

            <Button variant="primary" onClick={this.handleReset} className="w-full" icon={<RefreshCw />}>
              {translate("error.reload")}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// React Router errorElement for route-level errors (e.g., failed chunk loads after redeployment).
export function ChunkLoadErrorFallback() {
  const error = useRouteError() as Error | undefined;

  return (
    <div className="flex items-center justify-center min-h-screen bg-mu-canvas">
      <div className="max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3 text-mu-danger">
          <AlertCircle className="mu-icon w-8 h-8" />
          <h1 className="mu-heading">{translate("error.title")}</h1>
        </div>

        <p className="text-mu-text/70">{translate("error.description-update")}</p>

        {error?.message && (
          <details className="bg-mu-well p-3 rounded-mu-md mu-body">
            <summary className="cursor-pointer font-medium mb-2">{translate("error.details")}</summary>
            <pre className="whitespace-pre-wrap break-words mu-caption text-mu-text/60">{error.message}</pre>
          </details>
        )}

        <Button variant="primary" onClick={() => window.location.reload()} className="w-full" icon={<RefreshCw />}>
          {translate("error.reload")}
        </Button>
      </div>
    </div>
  );
}
