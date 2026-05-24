import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import DirectionWrapper from "@/components/DirectionWrapper";
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
