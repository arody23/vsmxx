import { useState, useEffect, useMemo, useCallback } from "react";
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
  Wallet,
  Smartphone,
  Percent,
  Tag,
} from "lucide-react";
import { VsmBrandMark } from "@/components/VsmBrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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

type WithdrawalRow = Tables<"ambassador_withdrawal_requests">;

const CONFIRMED_STATUSES = ["traitée", "expédiée"];
const COMMISSION_RATE = 0.1;
const COMMISSION_PERCENT = Math.round(COMMISSION_RATE * 100);
const MIN_ORDERS_FOR_WITHDRAWAL = 10;

const OPERATOR_LABELS: Record<string, string> = {
  airtel: "Airtel Money",
  mpesa: "M-Pesa",
  orange: "Orange Money",
};

const AmbassadorDashboard = () => {
  const { user, signOut, isAmbassador, loading } = useAuth();
  const navigate = useNavigate();
  const [dashTab, setDashTab] = useState("overview");
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [clicks, setClicks] = useState<ClickRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [newLinkCode, setNewLinkCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawOperator, setWithdrawOperator] = useState<string>("mpesa");
  const [withdrawMsisdn, setWithdrawMsisdn] = useState("");
  const [withdrawBeneficiary, setWithdrawBeneficiary] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

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

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [linksResult, codesResult] = await Promise.all([
      supabase
        .from("ambassador_links")
        .select("*")
        .eq("ambassador_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("promo_codes")
        .select("*")
        .eq("ambassador_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    const links = (linksResult.data || []) as unknown as TrackingLink[];
    setTrackingLinks(links);

    if (codesResult.error) {
      console.error("promo_codes:", codesResult.error);
      toast({
        title: "Codes promo",
        description: codesResult.error.message,
        variant: "destructive",
      });
    } else if (codesResult.data) {
      setPromoCodes(codesResult.data as unknown as PromoCode[]);
    }

    const promos = (codesResult.data || []) as PromoCode[];
    const promoIds = promos.map((c) => c.id);

    let ordersQuery = supabase
      .from("orders")
      .select("id, total_amount, status, ambassador_id, promo_code_id, created_at")
      .order("created_at", { ascending: false });

    if (promoIds.length > 0) {
      ordersQuery = ordersQuery.or(
        `ambassador_id.eq.${user.id},promo_code_id.in.(${promoIds.join(",")})`
      );
    } else {
      ordersQuery = ordersQuery.eq("ambassador_id", user.id);
    }

    const ordersResult = await ordersQuery;
    if (ordersResult.error) {
      console.error("orders:", ordersResult.error);
      toast({
        title: "Commandes",
        description: ordersResult.error.message,
        variant: "destructive",
      });
      setOrders([]);
    } else {
      setOrders((ordersResult.data || []) as unknown as OrderRow[]);
    }

    const { data: wdData, error: wdError } = await supabase
      .from("ambassador_withdrawal_requests")
      .select("*")
      .eq("ambassador_id", user.id)
      .order("created_at", { ascending: false });

    if (wdError) {
      if (wdError.code !== "PGRST116" && wdError.code !== "42P01") {
        console.warn("withdrawals fetch:", wdError.message);
      }
      setWithdrawals([]);
    } else {
      setWithdrawals((wdData || []) as WithdrawalRow[]);
    }

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
  }, [user]);

  useEffect(() => {
    if (user && isAmbassador) {
      fetchData();
    }
  }, [user, isAmbassador, fetchData]);

  const promoIdSet = useMemo(() => new Set(promoCodes.map((c) => c.id)), [promoCodes]);

  const clicksByLink = useMemo(() => {
    const map: Record<number, number> = {};
    clicks.forEach((c) => {
      map[c.link_id] = (map[c.link_id] || 0) + 1;
    });
    return map;
  }, [clicks]);

  const confirmedOrders = useMemo(
    () => orders.filter((o) => CONFIRMED_STATUSES.includes(o.status)),
    [orders]
  );

  const salesWithMyPromo = useMemo(
    () =>
      confirmedOrders.filter(
        (o) => o.promo_code_id != null && promoIdSet.has(Number(o.promo_code_id))
      ),
    [confirmedOrders, promoIdSet]
  );

  const salesWithoutPromoButAttributed = useMemo(
    () => confirmedOrders.length - salesWithMyPromo.length,
    [confirmedOrders.length, salesWithMyPromo.length]
  );

  const totalClicks = clicks.length;
  const totalConversions = confirmedOrders.length;
  const totalRevenue = confirmedOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const revenueFromPromoSales = salesWithMyPromo.reduce((s, o) => s + Number(o.total_amount), 0);
  const conversionRate =
    totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0";
  const totalPromoUsage = promoCodes.reduce((s, c) => s + c.usage_count, 0);
  const estimatedCommission = Math.floor(totalRevenue * COMMISSION_RATE);
  const activeLinks = trackingLinks.filter((l) => l.active).length;
  const activePromoCodes = promoCodes.length;

  const pendingWithdrawal = withdrawals.find((w) => w.status === "pending");
  const canRequestWithdrawal =
    totalConversions >= MIN_ORDERS_FOR_WITHDRAWAL && !pendingWithdrawal;
  const withdrawProgressPct = Math.min(100, (totalConversions / MIN_ORDERS_FOR_WITHDRAWAL) * 100);

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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Impossible de créer le lien.";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const submitWithdrawal = async () => {
    if (!user) return;
    const phone = withdrawMsisdn.trim();
    const name = withdrawBeneficiary.trim();
    if (!phone || !name) {
      toast({
        title: "Champs requis",
        description: "Indiquez le numéro Mobile Money et le nom affiché lors du retrait.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingWithdraw(true);
    try {
      const { data, error } = await supabase.rpc("request_ambassador_withdrawal", {
        p_mobile_operator: withdrawOperator,
        p_msisdn: phone,
        p_beneficiary_name: name,
      });

      if (error) throw error;

      toast({
        title: "Demande envoyée",
        description: `Réf. #${data} — notre équipe traitera votre retrait sous peu.`,
      });
      setWithdrawOpen(false);
      setWithdrawMsisdn("");
      setWithdrawBeneficiary("");
      fetchData();
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Impossible d'enregistrer la demande.";
      toast({ title: "Retrait", description: msg, variant: "destructive" });
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié!",
      description: `${type} copié dans le presse-papiers.`,
    });
  };

  const formatPrice = (price: number) => price.toLocaleString("fr-CD") + " FC";

  const formatDate = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusBadge = (status: string) => {
    if (status === "nouvelle") return <Badge variant="secondary">Nouvelle</Badge>;
    if (status === "traitée")
      return <Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/20">Traitée</Badge>;
    if (status === "expédiée")
      return <Badge className="bg-purple-500/20 text-purple-500 hover:bg-purple-500/20">Expédiée</Badge>;
    if (status === "annulée") return <Badge variant="destructive">Annulée</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const withdrawalStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: "En attente", className: "bg-amber-500/20 text-amber-700" },
      approved: { label: "Approuvée", className: "bg-blue-500/20 text-blue-700" },
      paid: { label: "Payée", className: "bg-emerald-500/20 text-emerald-700" },
      rejected: { label: "Refusée", className: "bg-red-500/20 text-red-700" },
    };
    const m = map[status] || { label: status, className: "" };
    return <Badge className={m.className}>{m.label}</Badge>;
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
          <VsmBrandMark subtitle="Espace ambassadeur" />
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Voir la boutique</span>
                <span className="sm:hidden">Boutique</span>
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
        <div className="vsm-container max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 text-center"
          >
            <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">
              Tableau de bord
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold uppercase">
              Bienvenue, Ambassadeur
            </h2>
            <p className="mt-2 text-muted-foreground">
              Ventes liées à votre code promo, commissions et demandes de retrait.
            </p>
          </motion.div>

          <Tabs value={dashTab} onValueChange={setDashTab} className="w-full">
            <TabsList className="flex w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="overview">Aperçu</TabsTrigger>
              <TabsTrigger value="links">Liens</TabsTrigger>
              <TabsTrigger value="promos">Codes promo</TabsTrigger>
              <TabsTrigger value="orders">Commandes</TabsTrigger>
              <TabsTrigger value="withdrawals">Retraits</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              {/* Ventes & commission — lecture claire */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <Tag className="h-6 w-6 text-primary" />
                    <Badge variant="secondary">Code promo</Badge>
                  </div>
                  <p className="mt-4 font-display text-3xl font-bold">{salesWithMyPromo.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ventes confirmées avec votre code
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    CA: {formatPrice(revenueFromPromoSales)}
                  </p>
                </div>
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <ShoppingCart className="h-6 w-6 text-green-500" />
                    <Badge variant="secondary">Total</Badge>
                  </div>
                  <p className="mt-4 font-display text-3xl font-bold">{totalConversions}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Commandes confirmées (toutes sources)
                  </p>
                  {salesWithoutPromoButAttributed > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Dont {salesWithoutPromoButAttributed} sans code (lien / autre)
                    </p>
                  )}
                </div>
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <Percent className="h-6 w-6 text-violet-500" />
                    <Badge variant="secondary">Taux</Badge>
                  </div>
                  <p className="mt-4 font-display text-3xl font-bold">{COMMISSION_PERCENT}%</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Commission sur le CA confirmé
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Trafic → vente: {conversionRate}% ({totalClicks} clics)
                  </p>
                </div>
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <DollarSign className="h-6 w-6 text-yellow-500" />
                    <Badge variant="secondary">Commission</Badge>
                  </div>
                  <p className="mt-4 font-display text-3xl font-bold text-primary">
                    {formatPrice(estimatedCommission)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Estimation ({COMMISSION_PERCENT}%)</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    CA confirmé: {formatPrice(totalRevenue)}
                  </p>
                </div>
              </motion.div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="vsm-card p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold">Demande de retrait</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Mobile Money (Airtel, M-Pesa, Orange). Débloqué à partir de{" "}
                        {MIN_ORDERS_FOR_WITHDRAWAL} commandes confirmées.
                      </p>
                    </div>
                    <Wallet className="h-8 w-8 shrink-0 text-primary opacity-80" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progression</span>
                      <span className="font-medium">
                        {totalConversions}/{MIN_ORDERS_FOR_WITHDRAWAL} commandes
                      </span>
                    </div>
                    <Progress value={withdrawProgressPct} className="h-2" />
                  </div>
                  {pendingWithdrawal && (
                    <p className="mt-4 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                      Une demande est en cours de traitement (#{pendingWithdrawal.id} —{" "}
                      {OPERATOR_LABELS[pendingWithdrawal.mobile_operator] ||
                        pendingWithdrawal.mobile_operator}
                      ).
                    </p>
                  )}
                  <Button
                    type="button"
                    className="mt-4 w-full sm:w-auto"
                    disabled={!canRequestWithdrawal}
                    onClick={() => canRequestWithdrawal && setWithdrawOpen(true)}
                  >
                    Demander un retrait
                  </Button>
                  <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Demande de retrait</DialogTitle>
                        <DialogDescription>
                          Indiquez l’opérateur, le numéro de téléphone Mobile Money et le nom qui
                          doit apparaître lors du transfert. Montant estimé côté boutique :{" "}
                          <span className="font-semibold text-foreground">
                            {formatPrice(estimatedCommission)}
                          </span>{" "}
                          (validation admin).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                          <Label>Opérateur</Label>
                          <Select value={withdrawOperator} onValueChange={setWithdrawOperator}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="airtel">Airtel Money</SelectItem>
                              <SelectItem value="mpesa">M-Pesa</SelectItem>
                              <SelectItem value="orange">Orange Money</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="wd-phone">Numéro Mobile Money</Label>
                          <Input
                            id="wd-phone"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="+243… ou numéro local"
                            value={withdrawMsisdn}
                            onChange={(e) => setWithdrawMsisdn(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="wd-name">Nom affiché au retrait</Label>
                          <Input
                            id="wd-name"
                            placeholder="Comme sur le compte Mobile Money"
                            value={withdrawBeneficiary}
                            onChange={(e) => setWithdrawBeneficiary(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                          Annuler
                        </Button>
                        <Button onClick={submitWithdrawal} disabled={submittingWithdraw}>
                          {submittingWithdraw ? "Envoi…" : "Envoyer la demande"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {!canRequestWithdrawal && !pendingWithdrawal && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Encore {Math.max(0, MIN_ORDERS_FOR_WITHDRAWAL - totalConversions)} commande
                      {MIN_ORDERS_FOR_WITHDRAWAL - totalConversions !== 1 ? "s" : ""} confirmée
                      {MIN_ORDERS_FOR_WITHDRAWAL - totalConversions !== 1 ? "s" : ""} pour débloquer
                      le retrait.
                    </p>
                  )}
                </div>

                <div className="vsm-card p-6">
                  <h3 className="font-display text-lg font-semibold">Synthèse</h3>
                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="flex justify-between border-b border-border/60 pb-2">
                      <span className="text-muted-foreground">Clics tracking</span>
                      <span className="font-medium">{totalClicks}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-2">
                      <span className="text-muted-foreground">Utilisations codes (compteur)</span>
                      <span className="font-medium">{totalPromoUsage}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-2">
                      <span className="text-muted-foreground">Liens actifs</span>
                      <span className="font-medium">{activeLinks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Codes promo actifs</span>
                      <span className="font-medium">{activePromoCodes}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="vsm-card p-6">
                <h3 className="font-display text-lg font-semibold">Dernières commandes</h3>
                {orders.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Aucune commande attribuée pour le moment.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {orders.slice(0, 5).map((o) => {
                      const viaPromo =
                        o.promo_code_id != null && promoIdSet.has(Number(o.promo_code_id));
                      return (
                        <div
                          key={o.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">#{o.id}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                            {viaPromo && (
                              <Badge variant="outline" className="mt-1 text-[10px]">
                                Code promo
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-primary">
                              {formatPrice(Number(o.total_amount || 0))}
                            </p>
                            <div className="mt-1 flex justify-end">{statusBadge(o.status)}</div>
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setDashTab("orders")}
                    >
                      Voir tout l&apos;historique
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="links" className="mt-6 space-y-6">
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
                  Partagez <code className="rounded bg-muted px-1">/a/CODE</code> pour attribuer les
                  commandes au lien.
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
                    Créez votre premier lien de tracking pour suivre vos campagnes.
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
                      Chaque commande passée avec ce code est comptée dans « ventes avec votre code ».
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
                            {" • "}
                            {code.usage_count} utilisation{code.usage_count !== 1 ? "s" : ""}{" "}
                            (toutes commandes)
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
                    <TrendingUp className="mr-1 inline h-4 w-4" />
                    <span className="font-semibold text-foreground">{salesWithMyPromo.length}</span>{" "}
                    vente{salesWithMyPromo.length !== 1 ? "s" : ""} confirmée
                    {salesWithMyPromo.length !== 1 ? "s" : ""} avec votre code — commission estimée
                    sur ces ventes :{" "}
                    <span className="font-semibold text-foreground">
                      {formatPrice(Math.floor(revenueFromPromoSales * COMMISSION_RATE))}
                    </span>
                    .
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
                    <h3 className="font-display text-xl font-bold">Historique attribué</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Commandes où vous êtes crédité (lien et/ou code promo). Confirmées ={" "}
                      {CONFIRMED_STATUSES.join(", ")}.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Commission estimée (total)</p>
                    <p className="font-display text-xl font-bold text-primary">
                      {formatPrice(estimatedCommission)}
                    </p>
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
                          <th className="px-4 py-3 text-left text-sm font-semibold">Source</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 50).map((o) => {
                          const viaPromo =
                            o.promo_code_id != null && promoIdSet.has(Number(o.promo_code_id));
                          return (
                            <tr key={o.id} className="border-b border-border last:border-0">
                              <td className="px-4 py-4 font-medium">#{o.id}</td>
                              <td className="px-4 py-4">
                                {viaPromo ? (
                                  <Badge variant="secondary">Code promo</Badge>
                                ) : (
                                  <Badge variant="outline">Lien / autre</Badge>
                                )}
                              </td>
                              <td className="px-4 py-4 text-sm text-muted-foreground">
                                {formatDate(o.created_at)}
                              </td>
                              <td className="px-4 py-4">{statusBadge(o.status)}</td>
                              <td className="px-4 py-4 text-right font-semibold text-primary">
                                {formatPrice(Number(o.total_amount || 0))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {orders.length > 50 && (
                    <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
                      Affichage des 50 dernières commandes.
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="withdrawals" className="mt-6 space-y-6">
              <div className="vsm-card p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Smartphone className="h-6 w-6 text-primary" />
                  <div>
                    <h3 className="font-display text-xl font-bold">Mes demandes de retrait</h3>
                    <p className="text-sm text-muted-foreground">
                      Statut mis à jour par l&apos;administration après vérification des ventes.
                    </p>
                  </div>
                </div>
              </div>
              {withdrawals.length === 0 ? (
                <div className="vsm-card p-10 text-center text-muted-foreground">
                  Aucune demande pour l&apos;instant. Utilisez l&apos;onglet Aperçu pour en créer
                  une lorsque vous avez au moins {MIN_ORDERS_FOR_WITHDRAWAL} commandes confirmées.
                </div>
              ) : (
                <div className="vsm-card overflow-hidden">
                  <table className="w-full">
                    <thead className="border-b border-border bg-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Opérateur</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Numéro</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Bénéficiaire</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map((w) => (
                        <tr key={w.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-4 font-medium">{w.id}</td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">
                            {formatDateTime(w.created_at)}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {OPERATOR_LABELS[w.mobile_operator] || w.mobile_operator}
                          </td>
                          <td className="px-4 py-4 font-mono text-sm">{w.msisdn}</td>
                          <td className="px-4 py-4 text-sm">{w.beneficiary_name}</td>
                          <td className="px-4 py-4">{withdrawalStatusBadge(w.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-12"
          >
            <div className="vsm-card p-6">
              <h3 className="font-display text-lg font-semibold">
                Conseils pour maximiser vos ventes
              </h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>• Partagez votre code promo dans vos stories et bio</li>
                <li>• Combinez lien de tracking + code pour suivre campagnes et conversions</li>
                <li>• Rappelez la réduction à vos followers</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default AmbassadorDashboard;
