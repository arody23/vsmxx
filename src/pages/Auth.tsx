import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  identifier: z.string().min(3, "Identifiant requis"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, resetPasswordForEmail, isAdmin, isAmbassador, loading, rolesLoading, refreshRoles } = useAuth();
  const { staff, loading: staffLoading, signInStaff } = useStaffAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
  });

  useEffect(() => {
    if (!staffLoading && staff) {
      navigate(staff.role === "pos" ? "/pos" : "/livreur", { replace: true });
    }
  }, [staff, staffLoading, navigate]);

  useEffect(() => {
    if (!loading && !rolesLoading && user) {
      if (isAdmin) navigate("/admin", { replace: true });
      else if (isAmbassador) navigate("/ambassadeur", { replace: true });
      else navigate("/mon-compte", { replace: true });
    }
  }, [user, loading, rolesLoading, isAdmin, isAmbassador, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const validated = loginSchema.parse(loginForm);
      const identifier = validated.identifier.trim();
      const isEmail = identifier.includes("@");

      if (isEmail) {
        const emailParsed = z.string().email("Email invalide").safeParse(identifier);
        if (!emailParsed.success) {
          setErrors({ identifier: "Email invalide" });
          return;
        }

        const { error } = await signIn(emailParsed.data, validated.password);
        if (error) {
          toast({
            title: "Erreur de connexion",
            description: error.message.includes("Invalid login credentials")
              ? "Email ou mot de passe incorrect."
              : error.message,
            variant: "destructive",
          });
          return;
        }

        toast({ title: "Connexion réussie", description: "Bienvenue sur VSM Collection." });
        const roles = await refreshRoles();
        if (roles.includes("admin")) navigate("/admin", { replace: true });
        else if (roles.includes("ambassador")) navigate("/ambassadeur", { replace: true });
        else navigate("/mon-compte", { replace: true });
      } else {
        const { error, member } = await signInStaff(identifier, validated.password);
        if (error) {
          toast({ title: "Connexion refusée", description: error, variant: "destructive" });
          return;
        }
        toast({ title: "Connexion réussie" });
        navigate(member?.role === "courier" ? "/livreur" : "/pos", { replace: true });
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const validated = signupSchema.parse(signupForm);
      const { error } = await signUp(validated.email, validated.password, validated.name);
      if (error) {
        toast({
          title: error.message.includes("already registered") ? "Compte existant" : "Erreur",
          description: error.message.includes("already registered")
            ? "Un compte existe déjà avec cet email."
            : error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Compte créé!", description: "Vérifiez votre email pour confirmer votre inscription." });
        setIsLogin(true);
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().email("Email invalide").safeParse(forgotEmail);
    if (!parsed.success) {
      toast({ title: "Email invalide", description: parsed.error.issues[0]?.message ?? "Email invalide", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await resetPasswordForEmail(parsed.data);
      if (error) {
        toast({ title: "Envoi impossible", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Email envoyé",
          description: "Ouvre le lien reçu pour choisir un nouveau mot de passe (vérifie aussi les spams).",
        });
        setShowForgotPassword(false);
        setForgotEmail("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || staffLoading || (user && rolesLoading)) {
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
              <button
                type="button"
                onClick={() => { setIsLogin(true); setShowForgotPassword(false); }}
                className={`flex-1 pb-4 font-display text-lg uppercase tracking-wider transition-colors ${isLogin ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setShowForgotPassword(false); }}
                className={`flex-1 pb-4 font-display text-lg uppercase tracking-wider transition-colors ${!isLogin ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
              >
                Inscription
              </button>
            </div>

            {showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Indique l&apos;email de ton compte : tu recevras un lien pour réinitialiser ton mot de passe.
                </p>
                <div>
                  <label className="mb-2 block text-sm font-medium">Adresse email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="pl-10"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <>Envoyer le lien<ArrowRight className="h-5 w-5" /></>}
                </Button>
                <button type="button" onClick={() => { setShowForgotPassword(false); setForgotEmail(""); }} className="w-full text-center text-sm text-muted-foreground hover:text-primary">
                  Retour à la connexion
                </button>
              </form>
            ) : isLogin ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Un seul accès pour client, admin, ambassadeur, POS et livreur.
                </p>
                <div>
                  <label className="mb-2 block text-sm font-medium">Email ou badge</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={loginForm.identifier}
                      onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                      placeholder="votre@email.com ou VSM1024"
                      className="pl-10"
                      autoComplete="username"
                    />
                  </div>
                  {errors.identifier && <p className="mt-1 text-sm text-destructive">{errors.identifier}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
                </div>

                <div className="text-right">
                  <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-muted-foreground hover:text-primary hover:underline">
                    Mot de passe oublié ?
                  </button>
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <>Se connecter<ArrowRight className="h-5 w-5" /></>}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">Nom complet</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={signupForm.name} onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })} placeholder="Votre nom" className="pl-10" />
                  </div>
                  {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Adresse email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input type="email" value={signupForm.email} onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })} placeholder="votre@email.com" className="pl-10" />
                  </div>
                  {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} value={signupForm.password} onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} placeholder="••••••••" className="pl-10 pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Confirmer le mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} value={signupForm.confirmPassword} onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })} placeholder="••••••••" className="pl-10" />
                  </div>
                  {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <>Créer un compte<ArrowRight className="h-5 w-5" /></>}
                </Button>
              </form>
            )}

            {!showForgotPassword && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isLogin ? "Pas encore de compte?" : "Déjà inscrit?"}{" "}
                <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-primary hover:underline">
                  {isLogin ? "S'inscrire" : "Se connecter"}
                </button>
              </p>
            )}

            {isLogin && !showForgotPassword && (
              <div className="mt-6 border-t border-border pt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Vous êtes influenceur?{" "}
                  <a href="https://ambassadeur.vsmcollection.com/ambassadeur" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Devenir ambassadeur</a>
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default Auth;
