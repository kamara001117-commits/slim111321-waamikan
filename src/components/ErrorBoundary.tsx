import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  isFirestorePermissionError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare setState: (state: Partial<State>) => void;

  public state: State = {
    hasError: false,
    errorMessage: '',
    isFirestorePermissionError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'An unexpected application error occurred.';
    let isPerm = false;

    try {
      const parsed = JSON.parse(message);
      if (parsed && parsed.operationType) {
        isPerm = parsed.error?.includes('permission-denied') || parsed.error?.includes('insufficient permissions');
        message = isPerm
          ? `Access restricted on "${parsed.path || 'database resource'}" (${parsed.operationType}). Ensure you are signed in with the required role.`
          : `Database operation failed (${parsed.operationType} on ${parsed.path}): ${parsed.error}`;
      }
    } catch {
      // Plain error string
    }

    return {
      hasError: true,
      errorMessage: message,
      isFirestorePermissionError: isPerm,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, errorMessage: '', isFirestorePermissionError: false });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7FAFC] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-lg w-full p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-[#0B3C5D]">
                {this.state.isFirestorePermissionError ? 'Permission or Session Required' : 'Something Went Wrong'}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed break-words">
                {this.state.errorMessage}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-3.5 px-6 rounded-2xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <Home size={18} />
                Return Home
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-[#0B3C5D] text-white font-bold hover:bg-[#1F7A8C] transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
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
