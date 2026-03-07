import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { CockpitShell } from "./cockpit/components/shell/cockpit-shell";
import CockpitOverview from "./cockpit/pages/CockpitOverview";
import MissionsPage from "./cockpit/pages/MissionsPage";
import MissionDetailPage from "./cockpit/pages/MissionDetailPage";
import RunsPage from "./cockpit/pages/RunsPage";
import RunDetailPage from "./cockpit/pages/RunDetailPage";
import WorkflowPage from "./cockpit/pages/WorkflowPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/cockpit" replace />} />
          <Route path="/cockpit" element={<CockpitShell />}>
            <Route index element={<CockpitOverview />} />
            <Route path="missions" element={<MissionsPage />} />
            <Route path="missions/:missionId" element={<MissionDetailPage />} />
            <Route path="runs" element={<RunsPage />} />
            <Route path="runs/:runId" element={<RunDetailPage />} />
            <Route path="workflows/:workflowId" element={<WorkflowPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
