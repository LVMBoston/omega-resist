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
import DeckBuilder from "./pages/DeckBuilder";
import DeckViewer from "./pages/DeckViewer";
import DeckManager from "./pages/DeckManager";
import CampaignManager from "./pages/CampaignManager";
import CampaignEoaManager from "./pages/CampaignEoaManager";
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
            <Route 
              path="/build" 
              element={
                <ProtectedRoute>
                  <DeckBuilder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manage" 
              element={
                <ProtectedRoute>
                  <DeckManager />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/campaigns" 
              element={
                <ProtectedRoute>
                  <CampaignManager />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/campaigns/:campaignId" 
              element={
                <ProtectedRoute>
                  <CampaignEoaManager />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
