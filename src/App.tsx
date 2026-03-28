import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Boutique from "./pages/Boutique";
import ProductDetail from "./pages/ProductDetail";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAmbassadorDetail from "./pages/AdminAmbassadorDetail";
import AmbassadorDashboard from "./pages/AmbassadorDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import BecomeAmbassador from "./pages/BecomeAmbassador";
import NotFound from "./pages/NotFound";
import AmbassadorLink from "./pages/AmbassadorLink";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/boutique" element={<Boutique />} />
              <Route path="/produit/:id" element={<ProductDetail />} />
              <Route path="/a-propos" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/panier" element={<Cart />} />
              <Route path="/commande" element={<Checkout />} />
              <Route path="/connexion" element={<Auth />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/ambassadeur/:userId" element={<AdminAmbassadorDetail />} />
              <Route path="/ambassadeur" element={<AmbassadorDashboard />} />
              <Route path="/a/:slug" element={<AmbassadorLink />} />
              <Route path="/mon-compte" element={<ClientDashboard />} />
              <Route path="/devenir-ambassadeur" element={<BecomeAmbassador />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
