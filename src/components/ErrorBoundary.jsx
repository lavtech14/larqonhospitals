import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
            <div className="text-5xl mb-4">😵</div>
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-slate-600 text-sm mb-4">
              The page crashed. Try reloading — if it keeps happening, contact
              support.
            </p>
            <pre className="text-xs bg-slate-100 p-3 rounded text-left overflow-auto mb-4 max-h-32">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
