import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, LogOut, Package, ScanLine, ShoppingCart, Trash2 } from "lucide-react";
import { VsmBrandMark } from "@/components/VsmBrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CartLine {
  variant_id: number;
  product_id: number;
  product_name: string;
  color: string;
  size: string;
  unit_price: number;
  quantity: number;
  stock: number;
}

interface PosStats {
  today_orders: number;
  today_revenue: number;
  stock_units: number;
}

const formatPrice = (n: number) => n.toLocaleString("fr-CD") + " FC";

const PosDashboard = () => {
  const navigate = useNavigate();
  const { staff, loading, signOutStaff } = useStaffAuth();
  const [stats, setStats] = useState<PosStats>({ today_orders: 0, today_revenue: 0, stock_units: 0 });
  const [scanValue, setScanValue] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!staff || staff.role !== "pos")) {
      navigate("/connexion");
    }
  }, [staff, loading, navigate]);

  const loadStats = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("pos_dashboard_stats");
    if (!error && data) setStats(data as PosStats);
  }, []);

  useEffect(() => {
    if (staff?.role === "pos") loadStats();
  }, [staff, loadStats]);

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + l.unit_price * l.quantity, 0),
    [cart]
  );

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;

    const { data, error } = await (supabase as any).rpc("lookup_variant_by_barcode", {
      p_barcode: code,
    });
    if (error || !data?.[0]) {
      toast({ title: "Produit introuvable", description: "Code-barres non reconnu.", variant: "destructive" });
      return;
    }

    const row = data[0];
    if (Number(row.stock) <= 0) {
      toast({ title: "Stock épuisé", variant: "destructive" });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((l) => l.variant_id === Number(row.variant_id));
      if (existing) {
        if (existing.quantity >= Number(row.stock)) return prev;
        return prev.map((l) =>
          l.variant_id === Number(row.variant_id) ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          variant_id: Number(row.variant_id),
          product_id: Number(row.product_id),
          product_name: row.product_name,
          color: row.color,
          size: row.size,
          unit_price: Number(row.unit_price),
          quantity: 1,
          stock: Number(row.stock),
        },
      ];
    });
    setScanValue("");
  };

  const submitOrder = async () => {
    if (!staff || cart.length === 0) return;
    setSubmitting(true);
    try {
      const items = cart.map((l) => ({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        size: l.size,
        color: l.color,
      }));
      const { data, error } = await (supabase as any).rpc("create_pos_order", {
        p_staff_badge: staff.badge,
        p_customer_name: customerName || "Client POS",
        p_items: items,
        p_notes: null,
      });
      if (error) throw error;
      toast({ title: "Vente enregistrée", description: `Commande #${data}` });
      setCart([]);
      setCustomerName("");
      loadStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur vente POS";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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
          <VsmBrandMark subtitle={`POS — ${staff.full_name} (${staff.badge})`} />
          <div className="flex gap-2">
            <Link to="/"><Button variant="outline" size="sm">Boutique</Button></Link>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => { signOutStaff(); navigate("/connexion"); }}>
              <LogOut className="h-4 w-4" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <section className="vsm-container py-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="vsm-card p-4">
            <p className="text-xs text-muted-foreground">Ventes aujourd&apos;hui</p>
            <p className="font-display text-2xl font-bold">{stats.today_orders}</p>
          </div>
          <div className="vsm-card p-4">
            <p className="text-xs text-muted-foreground">CA POS aujourd&apos;hui</p>
            <p className="font-display text-2xl font-bold text-primary">{formatPrice(Number(stats.today_revenue || 0))}</p>
          </div>
          <div className="vsm-card p-4">
            <p className="text-xs text-muted-foreground">Stock disponible (unités)</p>
            <p className="font-display text-2xl font-bold">{stats.stock_units}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="vsm-card space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <ScanLine className="h-5 w-5 text-primary" /> Scanner / saisir code-barres
            </h2>
            <form onSubmit={handleScan} className="flex gap-2">
              <Input
                autoFocus
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                placeholder="Scannez ou collez le code-barres"
              />
              <Button type="submit">Ajouter</Button>
            </form>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nom client (optionnel)"
            />
          </div>

          <div className="vsm-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
              <ShoppingCart className="h-5 w-5 text-primary" /> Panier POS
            </h2>
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Scannez un produit pour commencer.</p>
            ) : (
              <div className="space-y-2">
                {cart.map((line) => (
                  <div key={line.variant_id} className="flex items-center justify-between rounded-sm border border-border p-2 text-sm">
                    <div>
                      <p className="font-medium">{line.product_name}</p>
                      <p className="text-xs text-muted-foreground">{line.color} / {line.size} · x{line.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatPrice(line.unit_price * line.quantity)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setCart((p) => p.filter((x) => x.variant_id !== line.variant_id))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="font-display text-lg font-bold">Total</span>
                  <span className="font-display text-xl font-bold text-primary">{formatPrice(cartTotal)}</span>
                </div>
                <Button className="w-full" disabled={submitting} onClick={submitOrder}>
                  {submitting ? "Enregistrement…" : "Valider la vente"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default PosDashboard;
