import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/App";
import { envProblem } from "./services/supabase";
import { ErrorBoundary, SetupScreen } from "./components/ErrorScreen";
import { ThemeProvider } from "./theme/ThemeContext";
import { BrandingProvider } from "./branding/BrandingContext";

const rootEl = document.getElementById("root")!;
createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrandingProvider>
          {envProblem ? <SetupScreen problem={envProblem} /> : <App />}
        </BrandingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
rootEl.setAttribute("data-ready", "1"); // tells the start-up safety net that the app is running

// After a new deploy, an open tab may ask for a file that no longer exists: reload once to pick up the new version.
window.addEventListener("vite:preloadError", () => {
  if (!sessionStorage.getItem("reloaded_after_deploy")) { sessionStorage.setItem("reloaded_after_deploy", "1"); location.reload(); }
});

// Register the service worker (makes the app installable on phones). Production only.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

// Block two-finger touch gestures (pinch-zoom, two-finger pan). iOS Safari ignores the viewport setting, so enforce it here.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
