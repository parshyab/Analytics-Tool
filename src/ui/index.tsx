import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { PluginProvider } from "./hooks";
import "./styles.css";
import "./dashboard.css";

function mountApp() {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    document.body.innerHTML =
      '<div style="padding:24px;color:#b00020">Root element #root not found</div>';
    return;
  }

  createRoot(rootElement).render(
    <ErrorBoundary>
      <PluginProvider>
        <App />
      </PluginProvider>
    </ErrorBoundary>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountApp);
} else {
  mountApp();
}
