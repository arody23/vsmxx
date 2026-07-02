import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Camera,
  LogOut,
  Minus,
  Package,
  Percent,
  Plus,
  RefreshCw,
  ScanLine,
  ShoppingCart,
  Tag,
  Trash2,
} from "lucide-react";
import { VsmBrandMark } from "@/components/VsmBrandMark";
import { BarcodeCameraScanner } from "@/components/pos/BarcodeCameraScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  barcode?: string;
}

interface PosStats {
  today_orders: number;
  today_revenue: number;
  stock_units: number;
}

interface RecentOrder {
  id: number;
  customer_name: string | null;
  total_amount: number;
  promo_discount: number;
  status: string;
  created_at: string | null;
}

interface StockRow {
  variant_id: number;
  product_id: number;
  product_name: string;
  color: string;
  size: string;
  stock: number;
  barcode: string | null;
  unit_price: number;
}

const formatPrice = (n: number) => n.toLocaleString("fr-CD") + " FC";
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const PosDashboard = () => {
  const navigate = useNavigate();
  const scanRef = useRef<HTMLInputElement>(null);
  const { staff, loading, signOutStaff } = useStaffAuth();
  const [stats, setStats] = useState<PosStats>({ today_orders: 0, today_revenue: 0, stock_units: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [promoId, setPromoId] = useState<number | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLabel, setPromoLabel] = useState("");
  const [manualDiscount, setManualDiscount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!staff || staff.role !== "pos")) {
      navigate("/connexion");
    }
  }, [staff, loading, navigate]);

  const loadStats = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("pos_dashboard_stats");
    if (!error && data) setStats(data as PosStats);
  }, []);

  const loadRecent = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("pos_recent_orders", { p_limit: 20 });
    if (!error) setRecentOrders((data || []) as RecentOrder[]);
  }, []);

  const loadStock = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("pos_stock_overview", { p_limit: 80 });
    if (!error) setStockRows((data || []) as StockRow[]);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStats(), loadRecent(), loadStock()]);
  }, [loadStats, loadRecent, loadStock]);

  useEffect(() => {
    if (staff?.role === "pos") refreshAll();
  }, [staff, refreshAll]);

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.unit_price * l.quantity, 0),
    [cart]
  );

  const manualDiscountAmount = useMemo(() => {
    const n = Number(manualDiscount);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }, [manualDiscount]);

  const payableTotal = useMemo(
    () => Math.max(0, subtotal - promoDiscount - manualDiscountAmount),
    [subtotal, promoDiscount, manualDiscountAmount]
  );

  const addVariantToCart = (row: Record<string, unknown>) => {
    const stock = Number(row.stock);
    if (stock <= 0) {
      toast({ title: "Stock épuisé", variant: "destructive" });
      return;
    }
    const variantId = Number(row.variant_id);
    setCart((prev) => {
      const existing = prev.find((l) => l.variant_id === variantId);
      if (existing) {
        if (existing.quantity >= stock) return prev;
        return prev.map((l) =>
          l.variant_id === variantId ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          variant_id: variantId,
          product_id: Number(row.product_id),
          product_name: String(row.product_name),
          color: String(row.color),
          size: String(row.size),
          unit_price: Number(row.unit_price),
          quantity: 1,
          stock,
          barcode: row.barcode ? String(row.barcode) : undefined,
        },
      ];
    });
  };

  const lookupAndAddBarcode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return false;

    const { data, error } = await (supabase as any).rpc("lookup_variant_by_barcode", {
      p_barcode: trimmed,
    });
    if (error || !data?.[0]) {
      toast({ title: "Produit introuvable", description: "Code-barres non reconnu.", variant: "destructive" });
      return false;
    }

    addVariantToCart(data[0]);
    toast({ title: "Article ajouté", description: String(data[0].product_name) });
    return true;
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;

    const ok = await lookupAndAddBarcode(code);
    if (ok) {
      setScanValue("");
      scanRef.current?.focus();
    }
  };

  const handleCameraScan = useCallback(async (code: string) => {
    await lookupAndAddBarcode(code);
  }, [lookupAndAddBarcode]);

  const updateQty = (variantId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.variant_id !== variantId) return l;
          const next = l.quantity + delta;
          if (next <= 0) return null;
          if (next > l.stock) return l;
          return { ...l, quantity: next };
        })
        .filter(Boolean) as CartLine[]
    );
  };

  const applyPromo = async () => {
    const code = promoCode.trim();
    if (!code) return;
    if (subtotal <= 0) {
      toast({ title: "Panier vide", variant: "destructive" });
      return;
    }
    setApplyingPromo(true);
    try {
      const { data, error } = await (supabase as any).rpc("validate_promo_code", {
        p_code: code,
        p_subtotal: subtotal,
      });
      if (error) throw error;
      const result = data as {
        valid?: boolean;
        message?: string;
        promo_id?: number;
        discount_amount?: number;
        tier_label?: string;
      };
      if (!result?.valid) {
        setPromoId(null);
        setPromoDiscount(0);
        setPromoLabel("");
        toast({ title: "Code invalide", description: result?.message, variant: "destructive" });
        return;
      }
      setPromoId(Number(result.promo_id));
      setPromoDiscount(Number(result.discount_amount || 0));
      setPromoLabel(result.tier_label ? ` (${result.tier_label})` : "");
      toast({ title: "Code appliqué", description: `-${Number(result.discount_amount || 0).toLocaleString("fr-CD")} FC` });
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Erreur promo";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setApplyingPromo(false);
    }
  };

  const clearPromo = () => {
    setPromoCode("");
    setPromoId(null);
    setPromoDiscount(0);
    setPromoLabel("");
  };

  const submitOrder = async () => {
    if (!staff || cart.length === 0) return;
    if (payableTotal <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const items = cart.map((l) => ({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        size: l.size,
        color: l.color,
        product_name: l.product_name,
      }));
      const { data, error } = await (supabase as any).rpc("create_pos_order", {
        p_staff_badge: staff.badge,
        p_customer_name: customerName || "Client POS",
        p_items: items,
        p_notes: null,
        p_promo_code_id: promoId,
        p_promo_discount: promoDiscount,
        p_manual_discount: manualDiscountAmount,
      });
      if (error) throw error;
      toast({ title: "Vente enregistrée", description: `Commande #${data} — ${formatPrice(payableTotal)}` });
      setCart([]);
      setCustomerName("");
      clearPromo();
      setManualDiscount("");
      await refreshAll();
      scanRef.current?.focus();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Erreur vente POS";
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
    <main className="min-h-screen bg-background pb-24 lg:pb-8">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="vsm-container flex flex-wrap items-center justify-between gap-2 py-3 sm:py-4">
          <VsmBrandMark subtitle={`POS — ${staff.full_name}`} />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">{staff.badge}</Badge>
            <Button variant="outline" size="sm" className="gap-1" onClick={refreshAll}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
            <Link to="/"><Button variant="outline" size="sm">Boutique</Button></Link>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => { signOutStaff(); navigate("/connexion"); }}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Quitter</span>
            </Button>
          </div>
        </div>
      </header>

      <section className="vsm-container py-4 sm:py-6">
        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="vsm-card p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Ventes jour</p>
            <p className="font-display text-lg sm:text-2xl font-bold">{stats.today_orders}</p>
          </div>
          <div className="vsm-card p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground">CA jour</p>
            <p className="font-display text-lg sm:text-2xl font-bold text-primary">{formatPrice(Number(stats.today_revenue || 0))}</p>
          </div>
          <div className="vsm-card p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Stock unités</p>
            <p className="font-display text-lg sm:text-2xl font-bold">{stats.stock_units}</p>
          </div>
        </div>

        <Tabs defaultValue="sale" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sale" className="text-xs sm:text-sm">Vente</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">Historique</TabsTrigger>
            <TabsTrigger value="stock" className="text-xs sm:text-sm">Stock</TabsTrigger>
          </TabsList>

          <TabsContent value="sale" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="vsm-card space-y-4 p-4 sm:p-5">
                <h2 className="flex items-center gap-2 font-display text-base sm:text-lg font-bold">
                  <ScanLine className="h-5 w-5 text-primary" /> Scanner code-barres
                </h2>
                <Button
                  type="button"
                  size="lg"
                  className="w-full gap-2 sm:w-auto"
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera className="h-5 w-5" />
                  Ouvrir la caméra
                </Button>
                <form onSubmit={handleScan} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    ref={scanRef}
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    placeholder="Ou saisie manuelle du code"
                    className="font-mono text-sm"
                  />
                  <Button type="submit" variant="secondary" className="shrink-0">Ajouter</Button>
                </form>
                <BarcodeCameraScanner
                  open={cameraOpen}
                  onOpenChange={setCameraOpen}
                  onScan={handleCameraScan}
                />
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nom client (optionnel)"
                />

                <div className="space-y-2 rounded-sm border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Tag className="h-4 w-4 text-primary" /> Code promo
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="ANGYVSM…"
                      className="uppercase"
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" disabled={applyingPromo} onClick={applyPromo}>
                        {applyingPromo ? "…" : "Appliquer"}
                      </Button>
                      {promoDiscount > 0 && (
                        <Button type="button" variant="ghost" onClick={clearPromo}>Retirer</Button>
                      )}
                    </div>
                  </div>
                  {promoDiscount > 0 && (
                    <p className="text-xs text-green-600">
                      Réduction promo{promoLabel} : -{formatPrice(promoDiscount)}
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-sm border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Percent className="h-4 w-4 text-primary" /> Remise manuelle (FC)
                  </p>
                  <Input
                    type="number"
                    min={0}
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                    placeholder="Ex: 5000"
                  />
                </div>
              </div>

              <div className="vsm-card flex flex-col p-4 sm:p-5">
                <h2 className="mb-3 flex items-center gap-2 font-display text-base sm:text-lg font-bold">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Panier ({cart.length})
                </h2>
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Scannez un article pour commencer.</p>
                ) : (
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="max-h-[40vh] space-y-2 overflow-y-auto lg:max-h-80">
                      {cart.map((line) => (
                        <div key={line.variant_id} className="rounded-sm border border-border p-2 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{line.product_name}</p>
                              <p className="text-xs text-muted-foreground">{line.color} / {line.size}</p>
                              <p className="text-xs text-muted-foreground">Stock: {line.stock}</p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="shrink-0"
                              onClick={() => setCart((p) => p.filter((x) => x.variant_id !== line.variant_id))}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(line.variant_id, -1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center font-semibold">{line.quantity}</span>
                              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(line.variant_id, 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="font-semibold">{formatPrice(line.unit_price * line.quantity)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto space-y-1 border-t border-border pt-3 text-sm">
                      <div className="flex justify-between"><span>Sous-total</span><span>{formatPrice(subtotal)}</span></div>
                      {promoDiscount > 0 && (
                        <div className="flex justify-between text-green-600"><span>Code promo</span><span>-{formatPrice(promoDiscount)}</span></div>
                      )}
                      {manualDiscountAmount > 0 && (
                        <div className="flex justify-between text-green-600"><span>Remise</span><span>-{formatPrice(manualDiscountAmount)}</span></div>
                      )}
                      <div className="flex justify-between font-display text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">{formatPrice(payableTotal)}</span>
                      </div>
                    </div>
                    <Button className="w-full" size="lg" disabled={submitting} onClick={submitOrder}>
                      {submitting ? "Enregistrement…" : "Valider la vente"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="vsm-card divide-y divide-border overflow-hidden">
              {recentOrders.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">Aucune vente POS.</p>
              ) : (
                recentOrders.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                    <div>
                      <p className="font-semibold">#{o.id} — {o.customer_name || "Client POS"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatPrice(Number(o.total_amount))}</p>
                      {Number(o.promo_discount) > 0 && (
                        <p className="text-xs text-muted-foreground">Remise: -{formatPrice(Number(o.promo_discount))}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="stock">
            <div className="vsm-card overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Produit</th>
                    <th className="px-3 py-2 text-left">Variante</th>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-right">Stock</th>
                    <th className="px-3 py-2 text-right">Prix</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((row) => (
                    <tr key={row.variant_id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{row.product_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.color} / {row.size}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.barcode || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={row.stock <= 3 ? "destructive" : "secondary"}>{row.stock}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{formatPrice(Number(row.unit_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stockRows.length === 0 && (
                <p className="p-8 text-center text-muted-foreground">Aucune variante.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-3 shadow-lg lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{cart.length} article(s)</p>
              <p className="font-display text-lg font-bold text-primary">{formatPrice(payableTotal)}</p>
            </div>
            <Button disabled={submitting} onClick={submitOrder}>
              {submitting ? "…" : "Valider"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
};

export default PosDashboard;
