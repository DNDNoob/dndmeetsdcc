import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthModal from "@/components/AuthModal";
import UsernameSetupModal from "@/components/UsernameSetupModal";
import Index from "./pages/Index";
import JoinCampaign from "./pages/JoinCampaign";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/join/:inviteCode" element={<JoinCampaign />} />
            <Route path="/*" element={<Index />} />
          </Routes>
        </BrowserRouter>
        <AuthModal />
        <UsernameSetupModal />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
