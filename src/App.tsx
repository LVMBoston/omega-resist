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
import LandingPage from "./pages/LandingPage";
import Explainer from "./pages/Explainer";
import DeckManagement from "./pages/DeckManagement";
import DeckBuilder from "./pages/DeckBuilder";
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
import LiveNumbersDemo from "./pages/LiveNumbersDemo";
import DevTools from "./pages/DevTools";
import GeoipTest from "./pages/GeoipTest";
import DataTemplateTestHarness from "./pages/DataTemplateTestHarness";
import MapDebugTest from "./pages/MapDebugTest";
import TemplateEditorPage from "./pages/TemplateEditorPage";
import EdgeFunctionHealth from "./pages/EdgeFunctionHealth";
import RepointQrTool from "./pages/RepointQrTool";
import RegressionTests from "./pages/RegressionTests";
import ParityHarness from "./pages/ParityHarness";
import FridgeLanding from "./pages/FridgeLanding";
import FridgeStory from "./pages/FridgeStory";
import FridgeShareRedirect from "./pages/FridgeShareRedirect";
import FridgePrint from "./pages/FridgePrint";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const LayoutWithSidebar = ({ children }: { children: React.ReactNode }) => (
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
          {children}
        </main>
      </div>
    </div>
  </SidebarProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Routes without sidebar */}
            <Route path="/deck/:slug?" element={<DeckViewer />} />
            <Route path="/r/:code" element={<ShortUrlRedirect />} />
            <Route path="/s/:code" element={<ShortUrlRedirect />} />
            <Route path="/fridge/:token" element={<FridgeLanding />} />
            <Route path="/fs/:token" element={<FridgeStory />} />
            <Route path="/fx/:token" element={<FridgeShareRedirect />} />
            <Route path="/fp/:token" element={<FridgePrint />} />
            <Route path="/shared/:shareCode" element={<SharedDashboard />} />
            <Route path="/template-editor/:id" element={<TemplateEditorPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/explainer" element={<Explainer />} />
            <Route path="/parity-harness" element={<ParityHarness />} />
            
            {/* Routes with sidebar */}
            <Route path="/" element={<LayoutWithSidebar><Navigate to="/campaign-config" replace /></LayoutWithSidebar>} />
            <Route path="/deck-management" element={<LayoutWithSidebar><DeckManagement /></LayoutWithSidebar>} />
            <Route path="/deck-builder" element={<LayoutWithSidebar><DeckBuilder /></LayoutWithSidebar>} />
            <Route path="/interactive-templates" element={<LayoutWithSidebar><InteractiveTemplates /></LayoutWithSidebar>} />
            <Route path="/auth" element={<LayoutWithSidebar><Auth /></LayoutWithSidebar>} />
            <Route path="/deck-editor/:slug" element={<LayoutWithSidebar><DeckEditor /></LayoutWithSidebar>} />
            <Route 
              path="/campaign/:campaignId" 
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <CampaignDetail />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route path="/qr-debug" element={<LayoutWithSidebar><QrDebugTool /></LayoutWithSidebar>} />
            <Route path="/activity-monitor" element={<LayoutWithSidebar><ActivityMonitor /></LayoutWithSidebar>} />
            <Route 
              path="/campaign-analytics" 
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <CampaignAnalytics />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/campaign-dashboard" 
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <CampaignDashboard />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/campaign-config" 
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <CampaignManager />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/simulator" 
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <Simulator />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/settings"
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <Settings />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/admin"
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <Admin />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/virality-dashboard"
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <ViralityDashboard />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/zip-code-importer"
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <ZipCodeImporter />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route path="/dev-tools" element={<LayoutWithSidebar><DevTools /></LayoutWithSidebar>} />
            <Route path="/geoip-test" element={<LayoutWithSidebar><GeoipTest /></LayoutWithSidebar>} />
            <Route path="/data-template-test" element={<LayoutWithSidebar><DataTemplateTestHarness /></LayoutWithSidebar>} />
            <Route path="/live-numbers-demo" element={<LiveNumbersDemo />} />
            <Route 
              path="/map-debug"
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <MapDebugTest />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/edge-health"
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <EdgeFunctionHealth />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/repoint-qr"
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <RepointQrTool />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route 
              path="/regression-tests"
              element={
                <LayoutWithSidebar>
                  <ProtectedRoute requiredRole="admin">
                    <RegressionTests />
                  </ProtectedRoute>
                </LayoutWithSidebar>
              } 
            />
            <Route path="*" element={<LayoutWithSidebar><NotFound /></LayoutWithSidebar>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
