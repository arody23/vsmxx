import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  User,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ambassadorBadgeCode = (userId?: string | null) =>
  userId ? `VSM-${userId.replace(/-/g, "").slice(-4).toUpperCase()}` : "—";

const AdminAmbassadorApplication = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin, loading: authLoading, rolesLoading } = useAuth();

  const id = Number(applicationId);

  const { data: application, isLoading, isError } = useQuery({
    queryKey: ["admin-ambassador-application", id],
    enabled: !!user && isAdmin && Number.isFinite(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ambassador_applications")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Tables<"ambassador_applications"> & { user_id?: string | null };
    },
  });

  const handleStatus = async (status: "approved" | "rejected") => {
    if (!application) return;
    const { error } = await supabase
      .from("ambassador_applications")
      .update({ status })
      .eq("id", application.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: status === "approved" ? "Candidature approuvée" : "Candidature refusée" });
    queryClient.invalidateQueries({ queryKey: ["admin-ambassadors"] });
    queryClient.invalidateQueries({ queryKey: ["admin-ambassador-application", id] });

    if (status === "approved") {
      const userId = application.user_id;
      if (userId) {
        try {
          await (supabase as any)
            .from("user_roles")
            .insert({ user_id: userId, role: "ambassador" });
          const { data: existing } = await supabase
            .from("ambassador_links")
            .select("id")
            .eq("ambassador_id", userId)
            .limit(1);
          if (!existing?.length) {
            const base = (application.username || application.full_name || "VSM")
              .replace(/^@/, "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
            await supabase.from("ambassador_links").insert({
              ambassador_id: userId,
              slug: `${base || "VSM"}${Math.floor(100 + Math.random() * 900)}`,
              target_type: "shop",
              active: true,
            });
          }
          toast({ title: "Ambassadeur activé", description: "Rôle et lien créés." });
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  if (authLoading || rolesLoading) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Accès refusé</h1>
          <Link to="/admin">
            <Button variant="hero" className="mt-4">
              Retour admin
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="vsm-container flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin?tab=ambassadors")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="admin-kicker">Candidature ambassadeur</p>
              <h1 className="font-display text-lg font-bold md:text-xl">Fiche d&apos;inscription</h1>
            </div>
          </div>
          {application?.user_id && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/admin/ambassadeur/${application.user_id}`}>Suivi performance</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="vsm-container max-w-4xl py-8">
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {isError && <p className="text-destructive">Impossible de charger cette candidature.</p>}
        {!isLoading && !application && <p className="text-muted-foreground">Candidature introuvable.</p>}

        {application && (
          <div className="space-y-6">
            <section className="vsm-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold">{application.full_name}</h2>
                    <p className="text-primary">@{application.username}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Candidature du {formatDate(application.created_at)}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    application.status === "approved"
                      ? "default"
                      : application.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {application.status === "approved"
                    ? "Approuvé"
                    : application.status === "rejected"
                      ? "Refusé"
                      : "En attente"}
                </Badge>
              </div>

              {application.status === "pending" && (
                <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-6">
                  <Button className="gap-2" onClick={() => handleStatus("approved")}>
                    <Check className="h-4 w-4" />
                    Approuver
                  </Button>
                  <Button variant="outline" className="gap-2 text-destructive" onClick={() => handleStatus("rejected")}>
                    <XCircle className="h-4 w-4" />
                    Refuser
                  </Button>
                </div>
              )}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="vsm-card space-y-3 p-5">
                <p className="admin-kicker">Coordonnées</p>
                <p className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {application.email || "—"}
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {application.phone || "—"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Compte lié :</span>{" "}
                  {application.user_id || "Aucun"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Badge PWA :</span>{" "}
                  {ambassadorBadgeCode(application.user_id)}
                </p>
              </div>

              <div className="vsm-card space-y-3 p-5">
                <p className="admin-kicker">Réseaux sociaux</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Plateforme :</span> {application.main_platform}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Username :</span> @{application.username}
                </p>
                {application.profile_url ? (
                  <a
                    href={application.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Voir le profil <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun lien profil</p>
                )}
              </div>
            </section>

            <section className="vsm-card p-6">
              <p className="admin-kicker mb-3">Motivation</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {application.motivation || "—"}
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminAmbassadorApplication;
