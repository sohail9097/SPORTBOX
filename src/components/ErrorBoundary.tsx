import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught rendering error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-surface border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center mx-auto text-brand">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase italic tracking-tight text-white">
                Something Went Wrong
              </h2>
              <p className="text-text-muted text-xs font-medium leading-relaxed">
                An unexpected error occurred while loading this section. You can try refreshing the page or return to home.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-left overflow-auto max-h-32">
                <p className="text-[10px] font-mono text-red-400 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-6 py-3 bg-brand text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-brand-hover transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </button>
              
              <button
                onClick={() => { window.location.href = '/'; }}
                className="w-full sm:w-auto px-6 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-3.5 h-3.5" />
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
