import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  LogOut,
  MapPin,
  Phone,
  RefreshCw,
  Truck,
} from "lucide-react";
import { getMerchandiseAmount } from "@/lib/orderAmounts";
import { VsmBrandMark } from "@/components/VsmBrandMark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface OrderRow {
  id: number;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  total_amount: number;
  delivery_fee: number | null;
  status: string;
  created_at: string | null;
}

const formatPrice = (n: number) => n.toLocaleString("fr-CD") + " FC";
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const statusBadge = (status: string) => {
  if (status === "nouvelle") return <Badge variant="secondary">Nouvelle</Badge>;
  if (status === "traitée") return <Badge className="bg-blue-500/20 text-blue-600">Traitée</Badge>;
  if (status === "expédiée") return <Badge className="bg-purple-500/20 text-purple-600">Expédiée</Badge>;
  if (status === "annulée") return <Badge variant="destructive">Annulée</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

const CourierDashboard = () => {
  const navigate = useNavigate();
  const { staff, loading, signOutStaff } = useStaffAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [shippingId, setShippingId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    if (!staff?.courier_id) return;
    const { data, error } = await (supabase as any).rpc("courier_dashboard_orders", {
      p_courier_id: staff.courier_id,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setOrders((data || []) as OrderRow[]);
  }, [staff?.courier_id]);

  useEffect(() => {
    if (!loading && (!staff || staff.role !== "courier")) {
      navigate("/connexion");
    }
  }, [staff, loading, navigate]);

  useEffect(() => {
    if (staff?.role === "courier") loadOrders();
  }, [staff, loadOrders]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === "nouvelle" || o.status === "traitée"),
    [orders]
  );
  const historyOrders = useMemo(
    () => orders.filter((o) => o.status === "expédiée" || o.status === "annulée"),
    [orders]
  );

  const todayDelivered = useMemo(() => {
    const today = new Date().toDateString();
    return historyOrders.filter(
      (o) => o.status === "expédiée" && o.created_at && new Date(o.created_at).toDateString() === today
    ).length;
  }, [historyOrders]);

  const refresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const markShipped = async (orderId: number) => {
    if (!staff) return;
    setShippingId(orderId);
    try {
      const { error } = await (supabase as any).rpc("courier_mark_order_shipped", {
        p_staff_badge: staff.badge,
        p_order_id: orderId,
      });
      if (error) throw error;
      toast({ title: "Livraison expédiée", description: `Commande #${orderId}` });
      await loadOrders();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setShippingId(null);
    }
  };

  if (loading || !staff) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const OrderCard = ({ order, showAction }: { order: OrderRow; showAction?: boolean }) => (
    <div className="vsm-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-bold sm:text-lg">#{order.id}</p>
            {statusBadge(order.status)}
          </div>
          <p className="font-medium">{order.customer_name || "Client"}</p>
          {order.customer_phone && (
            <a
              href={`tel:${order.customer_phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Phone className="h-3.5 w-3.5" />
              {order.customer_phone}
            </a>
          )}
          <p className="flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{order.delivery_address || "Adresse non renseignée"}</span>
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div className="text-left sm:text-right">
            <p className="text-xs text-muted-foreground">Montant articles</p>
            <p className="font-display text-lg font-bold text-primary">
              {formatPrice(getMerchandiseAmount(order))}
            </p>
            {Number(order.delivery_fee) > 0 && (
              <p className="text-xs text-muted-foreground">
                + livraison {formatPrice(Number(order.delivery_fee))}
              </p>
            )}
          </div>
          {showAction && (
            <Button
              size="sm"
              className="gap-1 shrink-0"
              disabled={shippingId === order.id}
              onClick={() => markShipped(order.id)}
            >
              <CheckCircle className="h-4 w-4" />
              {shippingId === order.id ? "…" : "Expédiée"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="vsm-container flex flex-wrap items-center justify-between gap-2 py-3 sm:py-4">
          <VsmBrandMark subtitle={`Livreur — ${staff.full_name}`} />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">{staff.badge}</Badge>
            <Button variant="outline" size="sm" className="gap-1" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => { signOutStaff(); navigate("/connexion"); }}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Quitter</span>
            </Button>
          </div>
        </div>
      </header>

      <section className="vsm-container max-w-3xl py-4 sm:py-6">
        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="vsm-card p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground">En cours</p>
            <p className="font-display text-xl sm:text-2xl font-bold">{activeOrders.length}</p>
          </div>
          <div className="vsm-card p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Expédiées auj.</p>
            <p className="font-display text-xl sm:text-2xl font-bold text-primary">{todayDelivered}</p>
          </div>
          <div className="vsm-card p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Historique</p>
            <p className="font-display text-xl sm:text-2xl font-bold">{historyOrders.length}</p>
          </div>
        </div>

        <Tabs defaultValue="active">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active" className="gap-1 text-xs sm:text-sm">
              <Truck className="h-4 w-4" />
              Assignées ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              Historique ({historyOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {activeOrders.length === 0 ? (
              <div className="vsm-card p-8 text-center text-muted-foreground">
                Aucune livraison assignée pour le moment.
              </div>
            ) : (
              activeOrders.map((o) => <OrderCard key={o.id} order={o} showAction />)
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {historyOrders.length === 0 ? (
              <div className="vsm-card p-8 text-center text-muted-foreground">Aucun historique.</div>
            ) : (
              historyOrders.map((o) => <OrderCard key={o.id} order={o} />)
            )}
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default CourierDashboard;
