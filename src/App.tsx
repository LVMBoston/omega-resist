import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import DeckManagement from "./pages/DeckManagement";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import DeckViewer from "./pages/DeckViewer";
import DeckEditor from "./pages/DeckEditor";
import CampaignManager from "./pages/CampaignManager";
import CampaignEoaManager from "./pages/CampaignEoaManager";
import CampaignAnalytics from "./pages/CampaignAnalytics";
import CampaignDashboard from "./pages/CampaignDashboard";
import CampaignDetail from "./pages/CampaignDetail";
import SharedDashboard from "./pages/SharedDashboard";
import QrDebugTool from "./pages/QrDebugTool";
import ShortUrlRedirect from "./pages/ShortUrlRedirect";
import Simulator from "./pages/Simulator";
import ViralityDashboard from "./pages/ViralityDashboard";
import ZipCodeImporter from "./pages/ZipCodeImporter";
import ActivityMonitor from "./pages/ActivityMonitor";
import InteractiveTemplates from "./pages/InteractiveTemplates";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SidebarProvider>
            <div className="flex min-h-screen w-full">
              <AppSidebar />
              <div className="flex-1 flex flex-col">
                <header className="sticky top-0 z-10 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="flex h-14 items-center px-4">
                    <SidebarTrigger />
                  </div>
                </header>
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Navigate to="/campaign-config" replace />} />
                    <Route path="/deck-management" element={<DeckManagement />} />
                    <Route path="/interactive-templates" element={<InteractiveTemplates />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/deck/:slug?" element={<DeckViewer />} />
                    <Route path="/deck-editor/:slug" element={<DeckEditor />} />
                    <Route 
                      path="/campaign/:campaignId" 
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <CampaignDetail />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="/qr-debug" element={<QrDebugTool />} />
                    <Route path="/s/:code" element={<ShortUrlRedirect />} />
                    <Route path="/activity-monitor" element={<ActivityMonitor />} />
                    <Route path="/shared/:shareCode" element={<SharedDashboard />} />
                    <Route 
                      path="/campaign-analytics" 
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <CampaignAnalytics />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/campaign-dashboard" 
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <CampaignDashboard />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/campaign-config" 
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <CampaignManager />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/simulator" 
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <Simulator />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/settings"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <Settings />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/admin"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <Admin />
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
                    <Route 
                      path="/zip-code-importer"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <ZipCodeImporter />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
              </div>
            </div>
          </SidebarProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
