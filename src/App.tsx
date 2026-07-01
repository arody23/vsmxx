import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/hooks/useAuth";
import { StaffAuthProvider } from "@/hooks/useStaffAuth";
import Index from "./pages/Index";
import Boutique from "./pages/Boutique";
import ProductDetail from "./pages/ProductDetail";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAmbassadorDetail from "./pages/AdminAmbassadorDetail";
import AdminAmbassadorApplication from "./pages/AdminAmbassadorApplication";
import AmbassadorDashboard from "./pages/AmbassadorDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import BecomeAmbassador from "./pages/BecomeAmbassador";
import NotFound from "./pages/NotFound";
import AmbassadorLink from "./pages/AmbassadorLink";
import PosDashboard from "./pages/PosDashboard";
import CourierDashboard from "./pages/CourierDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <StaffAuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/boutique" element={<Boutique />} />
              <Route path="/produit/:slug" element={<ProductDetail />} />
              <Route path="/a-propos" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/panier" element={<Cart />} />
              <Route path="/commande" element={<Checkout />} />
              <Route path="/connexion" element={<Auth />} />
              <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/ambassadeur/:userId" element={<AdminAmbassadorDetail />} />
              <Route path="/admin/candidature/:applicationId" element={<AdminAmbassadorApplication />} />
              <Route path="/ambassadeur" element={<AmbassadorDashboard />} />
              <Route path="/pos" element={<PosDashboard />} />
              <Route path="/livreur" element={<CourierDashboard />} />
              <Route path="/mon-compte" element={<ClientDashboard />} />
              <Route path="/devenir-ambassadeur" element={<BecomeAmbassador />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
        </StaffAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
