import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  Bell,
  LogOut,
  ExternalLink,
  Clock,
  CheckCircle,
  Truck,
} from "lucide-react";
import { VsmBrandMark } from "@/components/VsmBrandMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Order {
  id: number;
  total_amount: number;
  status: string;
  created_at: string | null;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "En attente", icon: Clock, color: "text-yellow-500" },
  confirmed: { label: "Confirmée", icon: CheckCircle, color: "text-blue-500" },
  shipped: { label: "Expédiée", icon: Truck, color: "text-purple-500" },
  delivered: { label: "Livrée", icon: CheckCircle, color: "text-green-500" },
};

const ClientDashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/connexion");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("fr-CD") + " FC";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 shadow-sm backdrop-blur-lg">
        <div className="vsm-container flex flex-col gap-3 py-3 sm:h-20 sm:flex-row sm:items-center sm:justify-between sm:py-0">
          <VsmBrandMark subtitle="Mon espace" />
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link to="/boutique">
              <Button variant="ghost" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4 shrink-0" />
                Boutique
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="gap-2" onClick={signOut}>
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <section className="vsm-section">
        <div className="vsm-container max-w-4xl">
          {/* Welcome */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h2 className="font-display text-3xl font-bold">
              Bonjour{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}!
            </h2>
            <p className="mt-2 text-muted-foreground">
              Bienvenue dans votre espace client VSM Collection.
            </p>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12 grid gap-4 sm:grid-cols-2"
          >
            <Link to="/boutique" className="vsm-card flex items-center gap-4 p-6 transition-colors hover:border-primary">
              <Package className="h-10 w-10 text-primary" />
              <div>
                <h3 className="font-display text-lg font-semibold">Découvrir la boutique</h3>
                <p className="text-sm text-muted-foreground">Explorez nos dernières collections</p>
              </div>
            </Link>
            <div className="vsm-card flex items-center gap-4 p-6">
              <Bell className="h-10 w-10 text-primary" />
              <div>
                <h3 className="font-display text-lg font-semibold">Notifications</h3>
                <p className="text-sm text-muted-foreground">Soyez alerté des nouvelles collections</p>
              </div>
            </div>
          </motion.div>

          {/* Orders */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="mb-6 font-display text-2xl font-bold">Mes commandes</h3>

            {loadingOrders ? (
              <div className="vsm-card flex items-center justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => {
                  const status = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = status.icon;

                  return (
                    <div key={order.id} className="vsm-card p-6">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Commande du {formatDate(order.created_at)}
                          </p>
                          <p className="mt-1 font-display text-xl font-bold">
                            {formatPrice(order.total_amount)}
                          </p>
                        </div>
                        <div className={`flex items-center gap-2 ${status.color}`}>
                          <StatusIcon className="h-5 w-5" />
                          <span className="font-medium">{status.label}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="vsm-card p-12 text-center">
                <Package className="mx-auto h-16 w-16 text-muted-foreground" />
                <h4 className="mt-4 font-display text-xl font-bold">Aucune commande</h4>
                <p className="mt-2 text-muted-foreground">
                  Vous n'avez pas encore passé de commande.
                </p>
                <Link to="/boutique">
                  <Button variant="hero" size="lg" className="mt-6">
                    Découvrir la boutique
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default ClientDashboard;
