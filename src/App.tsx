import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import DeckBuilder from "./pages/DeckBuilder";
import DeckViewer from "./pages/DeckViewer";
import DeckManager from "./pages/DeckManager";
import CampaignManager from "./pages/CampaignManager";
import CampaignEoaManager from "./pages/CampaignEoaManager";
import CampaignAnalytics from "./pages/CampaignAnalytics";
import CampaignDashboard from "./pages/CampaignDashboard";
import SharedDashboard from "./pages/SharedDashboard";
import QrDebugTool from "./pages/QrDebugTool";
import ShortUrlRedirect from "./pages/ShortUrlRedirect";
import Simulator from "./pages/Simulator";
import ViralityDashboard from "./pages/ViralityDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/deck/:slug" element={<DeckViewer />} />
            <Route path="/build" element={<DeckBuilder />} />
            <Route path="/manage" element={<DeckManager />} />
            <Route path="/campaigns" element={<CampaignManager />} />
            <Route path="/campaigns/:campaignId" element={<CampaignEoaManager />} />
            <Route path="/qr-debug" element={<QrDebugTool />} />
            <Route path="/s/:code" element={<ShortUrlRedirect />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/campaign-analytics" element={
              <ProtectedRoute requiredRole="admin">
                <CampaignAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/campaign-dashboard" element={
              <ProtectedRoute requiredRole="admin">
                <CampaignDashboard />
              </ProtectedRoute>
            } />
            <Route path="/shared-dashboard/:shareCode" element={<SharedDashboard />} />
            <Route path="/simulator" element={
              <ProtectedRoute requiredRole="admin">
                <Simulator />
              </ProtectedRoute>
            } />
            <Route 
              path="/settings"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/virality-dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ViralityDashboard />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
