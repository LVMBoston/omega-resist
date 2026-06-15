import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Short label shown in the error UI, e.g. "Template Editor" */
  area?: string;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Catches render-time exceptions inside the wrapped subtree so the page
 * doesn't go blank (which causes Lovable's preview harness to redirect
 * away). Shows the error message + stack so we can diagnose crashes.
 */
export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in console so it shows up in dev logs too
    // eslint-disable-next-line no-console
    console.error(`[${this.props.area ?? "EditorErrorBoundary"}] crashed:`, error, info);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-2xl w-full rounded-lg border border-destructive/50 bg-destructive/5 p-6 space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-semibold">
              {this.props.area ?? "Editor"} crashed
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Something threw an error while rendering. The page would normally go
            blank and bounce you back &mdash; this screen catches it so we can see
            what went wrong.
          </p>
          <div className="rounded bg-background border p-3">
            <p className="text-sm font-mono font-medium text-destructive break-all">
              {this.state.error.name}: {this.state.error.message}
            </p>
            {this.state.error.stack && (
              <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-64 overflow-auto">
                {this.state.error.stack}
              </pre>
            )}
            {this.state.info?.componentStack && (
              <pre className="mt-2 text-xs text-muted-foreground/80 whitespace-pre-wrap break-all max-h-48 overflow-auto">
                Component stack:{this.state.info.componentStack}
              </pre>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleReset}>
              Try to recover
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
