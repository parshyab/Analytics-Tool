import React from "react";
import { postMessage } from "./hooks";

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("LUMI UI crashed", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    postMessage({ type: "RELOAD_UI" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>LUMI Analytics UI Error</h2>
          <p>The UI crashed before rendering.</p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>
            {this.state.error?.stack || this.state.error?.message}
          </pre>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
              Reload plugin UI
            </button>
          </div>
          <p className="session-footnote" style={{ marginTop: 12 }}>
            If this keeps happening, run <code>npm run build</code> and re-import the plugin in Figma.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
