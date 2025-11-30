import { AlertCircle } from "lucide-react";
import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for MemoEditor
 * Catches JavaScript errors anywhere in the editor component tree,
 * logs the error, and displays a fallback UI instead of crashing the entire app.
 */
class MemoEditorErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console for debugging
    console.error("MemoEditor Error:", error, errorInfo);
    // You can also log the error to an error reporting service here
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="w-full flex flex-col justify-center items-center bg-card px-4 py-8 rounded-lg border border-destructive/50">
          <AlertCircle className="w-8 h-8 text-destructive mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Editor Error</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
            Something went wrong with the memo editor. Please try refreshing the page.
          </p>
          {this.state.error && (
            <details className="text-xs text-muted-foreground mb-4 max-w-md">
              <summary className="cursor-pointer hover:text-foreground">Error details</summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">{this.state.error.toString()}</pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MemoEditorErrorBoundary;
