import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Layout from "./components/Layout";
import Inventory from "./pages/Inventory";
import Movements from "./pages/Movements";
import Scrap from "./pages/Scrap";
import ProductionOrders from "./pages/ProductionOrders";
import MachineStatus from "./pages/MachineStatus";
import PlantMap from "./pages/PlantMap";
import History from "./pages/History";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Layout><Inventory /></Layout>} />
          <Route path="/movements" element={<Layout><Movements /></Layout>} />
          <Route path="/scrap" element={<Layout><Scrap /></Layout>} />
          <Route path="/production-orders" element={<Layout><ProductionOrders /></Layout>} />
          <Route path="/machine-status" element={<Layout><MachineStatus /></Layout>} />
          <Route path="/plant-map" element={<Layout><PlantMap /></Layout>} />
          <Route path="/history" element={<Layout><History /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
