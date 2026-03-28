import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

const CONFIRMED_STATUSES = ["traitée", "expédiée"];
const COMMISSION_RATE = 0.1;

const formatPrice = (price: number) => price.toLocaleString("fr-CD") + " FC";

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusBadge = (status: string) => {
  if (status === "nouvelle") return <Badge variant="secondary">Nouvelle</Badge>;
  if (status === "traitée")
    return <Badge className="bg-blue-500/20 text-blue-600 hover:bg-blue-500/20">Traitée</Badge>;
  if (status === "expédiée")
    return <Badge className="bg-purple-500/20 text-purple-600 hover:bg-purple-500/20">Expédiée</Badge>;
  if (status === "annulée") return <Badge variant="destructive">Annulée</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
};

const AdminAmbassadorDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading, rolesLoading } = useAuth();

  const ambassadorUserId = userId ?? "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-ambassador-detail", ambassadorUserId],
    enabled: !!user && isAdmin && !!ambassadorUserId,
    queryFn: async () => {
      const [appRes, profileRes, linksRes, ordersRes, promosRes] = await Promise.all([
        supabase.from("ambassador_applications").select("*").eq("user_id", ambassadorUserId).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", ambassadorUserId).maybeSingle(),
        supabase
          .from("ambassador_links")
          .select("*")
          .eq("ambassador_id", ambassadorUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("id, total_amount, status, ambassador_id, promo_code_id, source_link_id, created_at")
          .eq("ambassador_id", ambassadorUserId)
          .order("created_at", { ascending: false }),
        supabase.from("promo_codes").select("*").eq("ambassador_id", ambassadorUserId).order("created_at", { ascending: false }),
      ]);

      if (appRes.error) throw appRes.error;
      if (profileRes.error) throw profileRes.error;
      if (linksRes.error) throw linksRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (promosRes.error) throw promosRes.error;

      const links = (linksRes.data || []) as Tables<"ambassador_links">[];
      const linkIds = links.map((l) => l.id);
      let clicks: { id: number; link_id: number }[] = [];
      if (linkIds.length > 0) {
        const { data: clicksData, error: clicksErr } = await supabase
          .from("ambassador_clicks")
          .select("id, link_id")
          .in("link_id", linkIds);
        if (clicksErr) throw clicksErr;
        clicks = (clicksData || []) as { id: number; link_id: number }[];
      }

      return {
        application: appRes.data as (Tables<"ambassador_applications"> & { user_id?: string | null }) | null,
        profile: profileRes.data as Tables<"profiles"> | null,
        links,
        orders: (ordersRes.data || []) as Pick<
          Tables<"orders">,
          "id" | "total_amount" | "status" | "ambassador_id" | "promo_code_id" | "source_link_id" | "created_at"
        >[],
        promos: (promosRes.data || []) as Tables<"promo_codes">[],
        clicks,
      };
    },
  });

  const clicksByLink = useMemo(() => {
    const map: Record<number, number> = {};
    (data?.clicks || []).forEach((c) => {
      map[c.link_id] = (map[c.link_id] || 0) + 1;
    });
    return map;
  }, [data?.clicks]);

  const slugByLinkId = useMemo(() => {
    const m = new Map<number, string>();
    (data?.links || []).forEach((l) => m.set(l.id, l.slug));
    return m;
  }, [data?.links]);

  const confirmedOrders = useMemo(
    () => (data?.orders || []).filter((o) => CONFIRMED_STATUSES.includes(o.status)),
    [data?.orders]
  );

  const totalOrders = data?.orders.length ?? 0;
  const revenue = confirmedOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const ordersCountConfirmed = confirmedOrders.length;
  const estimatedCommission = Math.floor(revenue * COMMISSION_RATE);
  const totalClicks = data?.clicks.length ?? 0;

  if (authLoading || rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Accès refusé</h1>
          <p className="mt-2 text-muted-foreground">Vous devez être administrateur.</p>
          <Link to="/">
            <Button variant="hero" className="mt-4">
              Retour
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="vsm-container flex h-16 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Retour">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Ambassadeur</p>
              <h1 className="font-display text-lg font-bold md:text-xl">Fiche détaillée</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin?tab=ambassadors">Liste ambassadeurs</Link>
          </Button>
        </div>
      </header>

      <main className="vsm-container max-w-5xl py-8">
        {!ambassadorUserId && (
          <p className="text-muted-foreground">Identifiant ambassadeur manquant.</p>
        )}

        {ambassadorUserId && isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {ambassadorUserId && isError && (
          <p className="text-destructive">Impossible de charger les données de cet ambassadeur.</p>
        )}

        {ambassadorUserId && data && (
          <div className="space-y-8">
            <section className="vsm-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold">
                      {data.application?.full_name ||
                        data.profile?.full_name ||
                        data.profile?.name ||
                        "Ambassadeur"}
                    </h2>
                    <p className="text-sm text-muted-foreground">@{data.application?.username || "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {data.application?.phone && <span>Tél. {data.application.phone}</span>}
                      {data.application?.main_platform && (
                        <span>• {data.application.main_platform}</span>
                      )}
                      {data.profile?.email && (
                        <span>
                          • {data.profile.email}
                        </span>
                      )}
                      {data.application?.email && !data.profile?.email && (
                        <span>• {data.application.email}</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground font-mono">ID: {ambassadorUserId}</p>
                    {data.application?.status && (
                      <Badge className="mt-2" variant={data.application.status === "approved" ? "default" : "secondary"}>
                        {data.application.status === "approved"
                          ? "Approuvé"
                          : data.application.status === "rejected"
                            ? "Refusé"
                            : "En attente"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="vsm-card p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commandes (total)</p>
                <p className="mt-2 font-display text-2xl font-bold">{totalOrders}</p>
              </div>
              <div className="vsm-card p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Confirmées ({CONFIRMED_STATUSES.join(", ")})
                </p>
                <p className="mt-2 font-display text-2xl font-bold">{ordersCountConfirmed}</p>
              </div>
              <div className="vsm-card p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CA (confirmées)</p>
                <p className="mt-2 font-display text-2xl font-bold text-primary">{formatPrice(revenue)}</p>
              </div>
              <div className="vsm-card p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Commission estimée ({Math.round(COMMISSION_RATE * 100)}%)
                </p>
                <p className="mt-2 font-display text-2xl font-bold">{formatPrice(estimatedCommission)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{totalClicks} clics sur liens</p>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-bold">Commandes attribuées</h3>
              {data.orders.length === 0 ? (
                <div className="vsm-card p-8 text-center text-muted-foreground">Aucune commande.</div>
              ) : (
                <div className="vsm-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-secondary">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">#</th>
                          <th className="px-4 py-3 text-left font-semibold">Date</th>
                          <th className="px-4 py-3 text-left font-semibold">Statut</th>
                          <th className="px-4 py-3 text-left font-semibold">Lien source</th>
                          <th className="px-4 py-3 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.orders.map((o) => {
                          const slug =
                            o.source_link_id != null ? slugByLinkId.get(o.source_link_id) : undefined;
                          const sourceLabel = slug ? `/a/${slug}` : "—";
                          return (
                            <tr key={o.id} className="border-b border-border last:border-0">
                              <td className="px-4 py-3 font-medium">#{o.id}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatDate(o.created_at)}</td>
                              <td className="px-4 py-3">{statusBadge(o.status)}</td>
                              <td className="px-4 py-3">
                                {slug ? (
                                  <a
                                    href={`${window.location.origin}/a/${slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                  >
                                    {sourceLabel}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-primary">
                                {formatPrice(Number(o.total_amount || 0))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-bold">Liens de tracking</h3>
              {data.links.length === 0 ? (
                <div className="vsm-card p-8 text-center text-muted-foreground">Aucun lien.</div>
              ) : (
                <div className="vsm-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Slug</th>
                        <th className="px-4 py-3 text-left font-semibold">URL</th>
                        <th className="px-4 py-3 text-center font-semibold">Clics</th>
                        <th className="px-4 py-3 text-left font-semibold">Actif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.links.map((link) => {
                        const full = `${window.location.origin}/a/${link.slug}`;
                        return (
                          <tr key={link.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-medium text-primary">{link.slug}</td>
                            <td className="px-4 py-3">
                              <a
                                href={full}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary hover:underline"
                              >
                                {full}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">{clicksByLink[link.id] ?? 0}</td>
                            <td className="px-4 py-3">
                              <Badge variant={link.active ? "default" : "secondary"}>
                                {link.active ? "Oui" : "Non"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-bold">Codes promo</h3>
              {data.promos.length === 0 ? (
                <div className="vsm-card p-8 text-center text-muted-foreground">Aucun code promo lié.</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.promos.map((p) => (
                    <div key={p.id} className="vsm-card flex items-center justify-between p-4">
                      <div>
                        <p className="font-display text-lg font-bold text-primary">{p.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {p.discount_type === "percent"
                            ? `-${p.discount_value}%`
                            : `-${formatPrice(Number(p.discount_value))}`}
                          {" · "}
                          {p.usage_count} util.
                          {p.active ? "" : " · inactif"}
                        </p>
                      </div>
                      <Badge variant={p.is_global ? "outline" : "secondary"}>
                        {p.is_global ? "Global" : "Ambassadeur"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminAmbassadorDetail;
