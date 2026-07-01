import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMerchandiseAmount } from "@/lib/orderAmounts";
import { VsmBrandMark } from "@/components/VsmBrandMark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { supabase } from "@/integrations/supabase/client";

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

  const loadOrders = useCallback(async () => {
    if (!staff?.courier_id) return;
    const { data, error } = await (supabase as any).rpc("courier_dashboard_orders", {
      p_courier_id: staff.courier_id,
    });
    if (!error) setOrders((data || []) as OrderRow[]);
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

  const markShipped = async (orderId: number) => {
    if (!staff) return;
    const { error } = await (supabase as any).rpc("courier_mark_order_shipped", {
      p_staff_badge: staff.badge,
      p_order_id: orderId,
    });
    if (!error) loadOrders();
  };

  if (loading || !staff) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="vsm-container flex flex-wrap items-center justify-between gap-3 py-4">
          <VsmBrandMark subtitle={`Livreur — ${staff.full_name} (${staff.badge})`} />
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => { signOutStaff(); navigate("/connexion"); }}>
            <LogOut className="h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </header>

      <section className="vsm-container max-w-4xl py-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="vsm-card p-4">
            <p className="text-xs text-muted-foreground">Assignées</p>
            <p className="font-display text-2xl font-bold">{activeOrders.length}</p>
          </div>
          <div className="vsm-card p-4">
            <p className="text-xs text-muted-foreground">Historique</p>
            <p className="font-display text-2xl font-bold">{historyOrders.length}</p>
          </div>
          <div className="vsm-card p-4">
            <p className="text-xs text-muted-foreground">Badge</p>
            <p className="font-display text-2xl font-bold text-primary">{staff.badge}</p>
          </div>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Livraisons assignées</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {activeOrders.length === 0 ? (
              <div className="vsm-card p-8 text-center text-muted-foreground">Aucune livraison assignée.</div>
            ) : (
              activeOrders.map((o) => (
                <div key={o.id} className="vsm-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-bold">#{o.id} — {o.customer_name || "Client"}</p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {o.delivery_address || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      {statusBadge(o.status)}
                      <p className="mt-2 font-semibold text-primary">
                        {formatPrice(getMerchandiseAmount(o))}
                      </p>
                      <Button size="sm" className="mt-2 gap-1" onClick={() => markShipped(o.id)}>
                        <CheckCircle className="h-4 w-4" /> Marquer expédiée
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {historyOrders.length === 0 ? (
              <div className="vsm-card p-8 text-center text-muted-foreground">Aucun historique.</div>
            ) : (
              historyOrders.map((o) => (
                <div key={o.id} className="vsm-card flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">#{o.id} — {o.customer_name || "Client"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                  </div>
                  {statusBadge(o.status)}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default CourierDashboard;
