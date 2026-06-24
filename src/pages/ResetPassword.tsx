import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { z } from "zod";

const schema = z
  .object({
    password: z.string().min(6, "Au moins 6 caractères"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm"],
  });

const ResetPassword = () => {
  const navigate = useNavigate();
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.get("type") === "recovery") {
      setRecoveryReady(true);
      setChecking(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryReady(true);
        setChecking(false);
      }
    });

    const t = window.setTimeout(() => {
      if (!cancelled) setChecking(false);
    }, 2800);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Mot de passe mis à jour", description: "Tu peux te connecter avec le nouveau mot de passe." });
        await supabase.auth.signOut();
        navigate("/connexion", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="flex min-h-screen items-center justify-center pb-20 pt-32">
        <div className="vsm-container max-w-md">
          <div className="vsm-card p-8">
            <h1 className="mb-2 font-display text-2xl uppercase tracking-wider">Nouveau mot de passe</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Choisis un nouveau mot de passe pour ton compte.
            </p>

            {checking && (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            )}

            {!checking && !recoveryReady && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Lien invalide ou expiré. Demande un nouvel email depuis la page de connexion.
                </p>
                <Button asChild variant="hero" className="w-full">
                  <Link to="/connexion">Retour à la connexion</Link>
                </Button>
              </div>
            )}

            {!checking && recoveryReady && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Confirmer</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="pl-10"
                      placeholder="••••••••"
                    />
                  </div>
                  {errors.confirm && <p className="mt-1 text-sm text-destructive">{errors.confirm}</p>}
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full gap-2" disabled={loading}>
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <>
                      Enregistrer
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default ResetPassword;
