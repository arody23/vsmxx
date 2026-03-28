import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, isAdmin, isAmbassador, loading, rolesLoading, refreshRoles } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "", email: "", password: "", confirmPassword: "",
  });

  // Wait for both auth AND roles to be loaded before redirecting
  useEffect(() => {
    if (!loading && !rolesLoading && user) {
      if (isAdmin) {
        navigate("/admin");
      } else if (isAmbassador) {
        navigate("/ambassadeur");
      } else {
        navigate("/mon-compte");
      }
    }
  }, [user, loading, rolesLoading, isAdmin, isAmbassador, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      if (isLogin) {
        const validated = loginSchema.parse({ email: formData.email, password: formData.password });
        const { error } = await signIn(validated.email, validated.password);
        if (error) {
          toast({
            title: "Erreur de connexion",
            description: error.message.includes("Invalid login credentials")
              ? "Email ou mot de passe incorrect." : error.message,
            variant: "destructive",
          });
        } else {
          toast({ title: "Connexion réussie!", description: "Bienvenue sur VSM Collection." });
          const r = await refreshRoles();
          if (r.includes("admin")) navigate("/admin", { replace: true });
          else if (r.includes("ambassador")) navigate("/ambassadeur", { replace: true });
          else navigate("/mon-compte", { replace: true });
        }
      } else {
        const validated = signupSchema.parse(formData);
        const { error } = await signUp(validated.email, validated.password, validated.name);
        if (error) {
          toast({
            title: error.message.includes("already registered") ? "Compte existant" : "Erreur",
            description: error.message.includes("already registered")
              ? "Un compte existe déjà avec cet email." : error.message,
            variant: "destructive",
          });
        } else {
          toast({ title: "Compte créé!", description: "Vérifiez votre email pour confirmer votre inscription." });
          setIsLogin(true);
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || (user && rolesLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="flex min-h-screen items-center justify-center pb-20 pt-32">
        <div className="vsm-container max-w-md">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="vsm-card p-8">
            <div className="mb-8 flex border-b border-border">
              <button onClick={() => setIsLogin(true)}
                className={`flex-1 pb-4 font-display text-lg uppercase tracking-wider transition-colors ${isLogin ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
                Connexion
              </button>
              <button onClick={() => setIsLogin(false)}
                className={`flex-1 pb-4 font-display text-lg uppercase tracking-wider transition-colors ${!isLogin ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
                Inscription
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <label className="mb-2 block text-sm font-medium">Nom complet</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Votre nom" className="pl-10" />
                  </div>
                  {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
                </motion.div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium">Adresse email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="votre@email.com" className="pl-10" />
                </div>
                {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" className="pl-10 pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
              </div>

              {!isLogin && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <label className="mb-2 block text-sm font-medium">Confirmer le mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="••••••••" className="pl-10" />
                  </div>
                  {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>}
                </motion.div>
              )}

              {isLogin && (
                <div className="text-right">
                  <Link to="#" className="text-sm text-muted-foreground hover:text-primary">Mot de passe oublié?</Link>
                </div>
              )}

              <Button type="submit" variant="hero" size="lg" className="w-full gap-2" disabled={isLoading}>
                {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : (
                  <>{isLogin ? "Se connecter" : "Créer un compte"}<ArrowRight className="h-5 w-5" /></>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isLogin ? "Pas encore de compte?" : "Déjà inscrit?"}{" "}
              <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-primary hover:underline">
                {isLogin ? "S'inscrire" : "Se connecter"}
              </button>
            </p>

            <div className="mt-6 border-t border-border pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Vous êtes influenceur?{" "}
                <Link to="/devenir-ambassadeur" className="font-medium text-primary hover:underline">Devenir ambassadeur</Link>
              </p>
            </div>
          </motion.div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default Auth;
