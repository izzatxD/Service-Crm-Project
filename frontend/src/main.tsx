import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ToastProvider } from "./hooks/useToast";
import { WorkspaceSelectionProvider } from "./hooks/WorkspaceSelectionProvider";
import { ToastContainer } from "./components/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { queryClient } from "./lib/queryClient";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <WorkspaceSelectionProvider>
                  <App />
                  <ToastContainer />
                </WorkspaceSelectionProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </BrowserRouter>
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
