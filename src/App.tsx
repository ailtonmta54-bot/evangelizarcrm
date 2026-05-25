import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Crm from "./pages/Crm";
import Robos from "./pages/Robos";
import Automacoes from "./pages/Automacoes";
import FlowEditor from "./pages/FlowEditor";
import Produtos from "./pages/Produtos";
import Settings from "./pages/Settings";
import Contatos from "./pages/Contatos";
import NotFound from "./pages/NotFound";
import DataDeletion from "./pages/DataDeletion";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/contatos" element={<Contatos />} />
                <Route path="/crm" element={<Crm />} />
                <Route path="/robos" element={<Robos />} />
                <Route path="/automacoes" element={<Automacoes />} />
                <Route path="/automacoes/flow/:flowId" element={<FlowEditor />} />
                <Route path="/produtos" element={<Produtos />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
