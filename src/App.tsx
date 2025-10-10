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
import QrDebugTool from "./pages/QrDebugTool";
import ShortUrlRedirect from "./pages/ShortUrlRedirect";
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
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Settings />
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
