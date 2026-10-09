import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/App";
import { envProblem } from "./services/supabase";
import { ErrorBoundary, SetupScreen } from "./components/ErrorScreen";
import { ThemeProvider } from "./theme/ThemeContext";
import { BrandingProvider } from "./branding/BrandingContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrandingProvider>
        <ErrorBoundary>{envProblem ? <SetupScreen problem={envProblem} /> : <App />}</ErrorBoundary>
      </BrandingProvider>
    </ThemeProvider>
  </StrictMode>
);

// Register the service worker (makes the app installable on phones). Production only.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

// Block two-finger touch gestures (pinch-zoom, two-finger pan). iOS Safari ignores the viewport setting, so enforce it here.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
