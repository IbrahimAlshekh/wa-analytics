import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Direction as DirectionPrimitive } from "radix-ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import App from "./App";
import "./i18n/index";
import "./index.css";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function DirectionWrapper({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <DirectionPrimitive.Provider dir={i18n.dir() as "ltr" | "rtl"}>
      {children}
    </DirectionPrimitive.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <DirectionWrapper>
          <TooltipProvider>
            <App />
            <Toaster />
          </TooltipProvider>
        </DirectionWrapper>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
