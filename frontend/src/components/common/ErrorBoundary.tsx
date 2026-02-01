/**
 * Global Error Boundary for React
 * 
 * Catches unhandled React errors and displays a friendly fallback UI
 * instead of a white screen. Logs errors for debugging.
 * 
 * PRODUCTION READINESS:
 * - Prevents white-screen-of-death from uncaught React errors
 * - Provides user-friendly recovery options
 * - Logs error details in development mode
 * 
 * @module components/common/ErrorBoundary
 * @version 1.0.0
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error details (in production, send to error tracking service)
    console.error('🔴 ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // TODO: In production, send to Sentry/Datadog/etc.
    // errorTrackingService.captureException(error, { extra: errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.hash = 'dashboard';
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-500 mb-6">
              An unexpected error occurred. This has been logged and our team will investigate.
            </p>

            {/* Error details (dev only) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600">
                  Technical Details
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-red-600 overflow-auto max-h-40 border">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Recovery Actions */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleGoHome}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Go to Dashboard
              </button>
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
