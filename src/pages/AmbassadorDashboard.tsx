import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  MousePointer,
  ShoppingCart,
  TrendingUp,
  Copy,
  LogOut,
  Plus,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface TrackingLink {
  id: number;
  slug: string;
  target_type: string;
  active: boolean;
  created_at: string | null;
}

interface PromoCode {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  usage_count: number;
}

interface ClickRow {
  id: number;
  link_id: number;
}

interface OrderRow {
  id: number;
  total_amount: number;
  status: string;
  ambassador_id: string | null;
  promo_code_id: number | null;
  created_at: string | null;
}

const CONFIRMED_STATUSES = ["traitée", "expédiée"];
const COMMISSION_RATE = 0.1; // 10% (can be moved to settings later)

const AmbassadorDashboard = () => {
  const { user, signOut, isAmbassador, loading } = useAuth();
  const navigate = useNavigate();
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [clicks, setClicks] = useState<ClickRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [newLinkCode, setNewLinkCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/connexion");
    } else if (!loading && user && !isAmbassador) {
      navigate("/");
      toast({
        title: "Accès refusé",
        description: "Vous n'êtes pas ambassadeur.",
        variant: "destructive",
      });
    }
  }, [user, loading, isAmbassador, navigate]);

  useEffect(() => {
    if (user && isAmbassador) {
      fetchData();
    }
  }, [user, isAmbassador]);

  const fetchData = async () => {
    if (!user) return;

    const [linksResult, codesResult, ordersResult] = await Promise.all([
      supabase
        .from("ambassador_links")
        .select("*")
        .eq("ambassador_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("promo_codes")
        .select("*")
        .eq("ambassador_id", user.id),
      supabase
        .from("orders")
        .select("id, total_amount, status, ambassador_id, promo_code_id, created_at")
        .eq("ambassador_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    const links = (linksResult.data || []) as unknown as TrackingLink[];
    setTrackingLinks(links);
    if (codesResult.data) setPromoCodes(codesResult.data as unknown as PromoCode[]);
    if (ordersResult.data) setOrders(ordersResult.data as unknown as OrderRow[]);

    // Fetch clicks for all ambassador links
    if (links.length > 0) {
      const linkIds = links.map((l) => l.id);
      const { data: clicksData } = await supabase
        .from("ambassador_clicks")
        .select("id, link_id")
        .in("link_id", linkIds);
      setClicks((clicksData || []) as unknown as ClickRow[]);
    } else {
      setClicks([]);
    }
  };

  // Computed stats from real DB data
  const clicksByLink = useMemo(() => {
    const map: Record<number, number> = {};
    clicks.forEach((c) => {
      map[c.link_id] = (map[c.link_id] || 0) + 1;
    });
    return map;
  }, [clicks]);

  const confirmedOrders = orders.filter((o) => CONFIRMED_STATUSES.includes(o.status));

  const totalClicks = clicks.length;
  const totalConversions = confirmedOrders.length;
  const totalRevenue = confirmedOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0";
  const totalPromoUsage = promoCodes.reduce((s, c) => s + c.usage_count, 0);
  const estimatedCommission = Math.floor(totalRevenue * COMMISSION_RATE);
  const activeLinks = trackingLinks.filter((l) => l.active).length;
  const activePromoCodes = promoCodes.length;

  const createTrackingLink = async () => {
    if (!newLinkCode.trim() || !user) return;

    setIsCreating(true);
    try {
      const { error } = await supabase.from("ambassador_links").insert({
        ambassador_id: user.id,
        slug: newLinkCode.toUpperCase().replace(/\s/g, ""),
        target_type: "shop",
      });

      if (error) throw error;

      toast({
        title: "Lien créé!",
        description: "Votre nouveau lien de tracking est prêt.",
      });
      setNewLinkCode("");
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le lien.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié!",
      description: `${type} copié dans le presse-papiers.`,
    });
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("fr-CD") + " FC";
  };

  const formatDate = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const statusBadge = (status: string) => {
    if (status === "nouvelle") return <Badge variant="secondary">Nouvelle</Badge>;
    if (status === "traitée") return <Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/20">Traitée</Badge>;
    if (status === "expédiée") return <Badge className="bg-purple-500/20 text-purple-500 hover:bg-purple-500/20">Expédiée</Badge>;
    if (status === "annulée") return <Badge variant="destructive">Annulée</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
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
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="vsm-container flex h-16 items-center justify-between">
          <h1 className="font-display text-xl font-bold">
            <span className="text-primary">VSM</span> Ambassadeur
          </h1>
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                Voir la boutique
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <section className="vsm-section">
        <div className="vsm-container max-w-5xl">
          {/* Welcome */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
            <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">
              Tableau de bord
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold uppercase">
              Bienvenue, Ambassadeur
            </h2>
            <p className="mt-2 text-muted-foreground">
              Suivez vos performances et gérez vos liens de promotion.
            </p>
          </motion.div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">Aperçu</TabsTrigger>
              <TabsTrigger value="links">Liens</TabsTrigger>
              <TabsTrigger value="promos">Codes promo</TabsTrigger>
              <TabsTrigger value="orders">Commandes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              {/* KPIs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <MousePointer className="h-6 w-6 text-blue-500" />
                    <Badge variant="secondary">Trafic</Badge>
                  </div>
                  <p className="mt-4 font-display text-3xl font-bold">{totalClicks.toLocaleString()}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Clics totaux</p>
                </div>
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <ShoppingCart className="h-6 w-6 text-green-500" />
                    <Badge variant="secondary">Confirmées</Badge>
                  </div>
                  <p className="mt-4 font-display text-3xl font-bold">{totalConversions}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Commandes attribuées</p>
                </div>
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    <Badge variant="secondary">Ratio</Badge>
                  </div>
                  <p className="mt-4 font-display text-3xl font-bold">{conversionRate}%</p>
                  <p className="mt-1 text-sm text-muted-foreground">Taux de conversion</p>
                </div>
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <DollarSign className="h-6 w-6 text-yellow-500" />
                    <Badge variant="secondary">Ventes</Badge>
                  </div>
                  <p className="mt-4 font-display text-3xl font-bold">{formatPrice(totalRevenue)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Revenus générés</p>
                </div>
              </motion.div>

              {/* Business cards */}
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="vsm-card p-6">
                  <h3 className="font-display text-lg font-semibold">Commissions (estimées)</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Calcul: {Math.round(COMMISSION_RATE * 100)}% sur commandes confirmées.
                  </p>
                  <div className="mt-4 flex items-end justify-between">
                    <p className="font-display text-3xl font-bold text-primary">{formatPrice(estimatedCommission)}</p>
                    <span className="text-xs text-muted-foreground">{totalConversions} commandes</span>
                  </div>
                </div>
                <div className="vsm-card p-6">
                  <h3 className="font-display text-lg font-semibold">Ressources</h3>
                  <div className="mt-4 grid gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Liens actifs</span>
                      <span className="font-medium">{activeLinks}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Codes promo</span>
                      <span className="font-medium">{activePromoCodes}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Utilisations codes</span>
                      <span className="font-medium">{totalPromoUsage}</span>
                    </div>
                  </div>
                </div>
                <div className="vsm-card p-6">
                  <h3 className="font-display text-lg font-semibold">Dernières commandes</h3>
                  {orders.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Aucune commande attribuée pour le moment.</p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {orders.slice(0, 4).map((o) => (
                        <div key={o.id} className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">#{o.id}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-primary">{formatPrice(Number(o.total_amount || 0))}</p>
                            <div className="mt-1 flex justify-end">{statusBadge(o.status)}</div>
                          </div>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => (document.querySelector('[data-value=\"orders\"]') as HTMLElement | null)?.click()}>
                        Voir l'historique
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="links" className="mt-6 space-y-6">
              {/* Create New Link */}
              <div className="vsm-card p-4">
                <h3 className="mb-3 font-display text-lg font-semibold">Créer un lien de tracking</h3>
                <div className="flex gap-3">
                  <Input
                    value={newLinkCode}
                    onChange={(e) => setNewLinkCode(e.target.value)}
                    placeholder="Code du lien (ex: SUMMER24)"
                    className="flex-1"
                  />
                  <Button
                    variant="default"
                    onClick={createTrackingLink}
                    disabled={!newLinkCode.trim() || isCreating}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Créer
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Astuce: partage ton lien public `.../a/CODE` pour attribuer automatiquement les commandes.
                </p>
              </div>

              {trackingLinks.length > 0 ? (
                <div className="vsm-card overflow-hidden">
                  <table className="w-full">
                    <thead className="border-b border-border bg-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Lien</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">Clics</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trackingLinks.map((link) => {
                        const fullLink = `${window.location.origin}/a/${link.slug}`;
                        const linkClicks = clicksByLink[link.id] || 0;
                        return (
                          <tr key={link.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-4">
                              <p className="font-medium text-primary">{link.slug}</p>
                              <p className="text-xs text-muted-foreground">{fullLink}</p>
                            </td>
                            <td className="px-4 py-4 text-center font-semibold">{linkClicks}</td>
                            <td className="px-4 py-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(fullLink, "Lien")}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="vsm-card p-8 text-center">
                  <MousePointer className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">
                    Créez votre premier lien de tracking pour commencer à suivre vos performances.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="promos" className="mt-6 space-y-6">
              {promoCodes.length > 0 ? (
                <>
                  <div className="vsm-card p-6">
                    <h3 className="font-display text-xl font-bold">Vos codes promo</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Copiez vos codes et partagez-les avec votre audience.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {promoCodes.map((code) => (
                      <div key={code.id} className="vsm-card flex items-center justify-between p-4">
                        <div>
                          <p className="font-display text-xl font-bold text-primary">{code.code}</p>
                          <p className="text-sm text-muted-foreground">
                            {code.discount_type === "percent"
                              ? `-${code.discount_value}%`
                              : `-${formatPrice(code.discount_value)}`}
                            {" • "}{code.usage_count} utilisation{code.usage_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(code.code, "Code promo")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-sm bg-primary/10 p-3 text-sm text-muted-foreground">
                    📊 <span className="font-semibold text-foreground">{totalPromoUsage}</span> utilisation{totalPromoUsage !== 1 ? "s" : ""} au total.
                  </div>
                </>
              ) : (
                <div className="vsm-card p-10 text-center">
                  <p className="text-muted-foreground">Aucun code promo attribué pour le moment.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders" className="mt-6 space-y-6">
              <div className="vsm-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold">Historique des commandes attribuées</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Basé sur `orders.ambassador_id` (commandes confirmées = {CONFIRMED_STATUSES.join(", ")}).
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Commissions estimées</p>
                    <p className="font-display text-xl font-bold text-primary">{formatPrice(estimatedCommission)}</p>
                  </div>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="vsm-card p-10 text-center">
                  <p className="text-muted-foreground">Aucune commande attribuée.</p>
                </div>
              ) : (
                <div className="vsm-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border bg-secondary">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Commande</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 25).map((o) => (
                          <tr key={o.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-4 font-medium">#{o.id}</td>
                            <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(o.created_at)}</td>
                            <td className="px-4 py-4">{statusBadge(o.status)}</td>
                            <td className="px-4 py-4 text-right font-semibold text-primary">{formatPrice(Number(o.total_amount || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {orders.length > 25 && (
                    <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
                      Affichage des 25 dernières commandes.
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12"
          >
            <div className="vsm-card p-6">
              <h3 className="font-display text-lg font-semibold">
                💡 Conseils pour maximiser vos ventes
              </h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>• Partagez votre code promo dans vos stories et bio</li>
                <li>• Montrez les produits en action dans vos posts</li>
                <li>• Rappelez régulièrement la réduction à vos followers</li>
                <li>• Utilisez différents liens pour tracker vos campagnes</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default AmbassadorDashboard;
