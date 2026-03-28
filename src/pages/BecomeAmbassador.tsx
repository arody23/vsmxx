import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Star,
  Users,
  TrendingUp,
  Gift,
  Instagram,
  Send,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { z } from "zod";

const applicationSchema = z.object({
  fullName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(9, "Numéro de téléphone invalide"),
  instagramHandle: z.string().optional(),
  tiktokHandle: z.string().optional(),
  facebookHandle: z.string().optional(),
  followersCount: z.number().min(0).optional(),
  motivation: z.string().min(50, "Expliquez votre motivation en au moins 50 caractères"),
});

const benefits = [
  {
    icon: Gift,
    title: "Code promo exclusif",
    description: "Recevez un code promo personnalisé pour votre communauté",
  },
  {
    icon: TrendingUp,
    title: "Commissions sur ventes",
    description: "Gagnez une commission sur chaque vente générée",
  },
  {
    icon: Star,
    title: "Produits gratuits",
    description: "Accès à des produits exclusifs pour vos contenus",
  },
  {
    icon: Users,
    title: "Communauté VIP",
    description: "Rejoignez notre réseau d'ambassadeurs privilégiés",
  },
];

const BecomeAmbassador = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    instagramHandle: "",
    tiktokHandle: "",
    facebookHandle: "",
    followersCount: "",
    motivation: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = applicationSchema.parse({
        ...formData,
        followersCount: formData.followersCount ? parseInt(formData.followersCount) : undefined,
      });

      setIsSubmitting(true);

      const payload: Record<string, any> = {
        full_name: validatedData.fullName,
        email: validatedData.email,
        phone: validatedData.phone,
        main_platform: validatedData.instagramHandle ? "instagram" : validatedData.tiktokHandle ? "tiktok" : "facebook",
        username: validatedData.instagramHandle || validatedData.tiktokHandle || validatedData.facebookHandle || "",
        profile_url: validatedData.tiktokHandle || validatedData.facebookHandle || null,
        motivation: validatedData.motivation,
      };
      if (user?.id) payload.user_id = user.id;

      const { error } = await (supabase as any).from("ambassador_applications").insert(payload);

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: "Candidature envoyée!",
        description: "Nous examinerons votre profil et vous contacterons bientôt.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: "Erreur",
          description: "Une erreur est survenue. Veuillez réessayer.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <section className="flex min-h-screen items-center justify-center pb-20 pt-32">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="vsm-container max-w-lg text-center"
          >
            <CheckCircle className="mx-auto h-20 w-20 text-green-500" />
            <h1 className="mt-6 font-display text-3xl font-bold uppercase">
              Candidature envoyée!
            </h1>
            <p className="mt-4 text-muted-foreground">
              Merci pour votre intérêt à devenir ambassadeur VSM Collection.
              Notre équipe examinera votre profil et vous contactera par email
              dans les prochains jours.
            </p>
            <Button
              variant="hero"
              size="lg"
              className="mt-8"
              onClick={() => navigate("/")}
            >
              Retour à l'accueil
            </Button>
          </motion.div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pb-12 pt-32 md:pt-40">
        <div className="vsm-container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">
              Programme Ambassadeur
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight md:text-5xl">
              Devenir Ambassadeur
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Rejoignez notre équipe d'ambassadeurs et représentez VSM Collection
              auprès de votre communauté. Gagnez des commissions et accédez à des
              avantages exclusifs.
            </p>
            {!user && (
              <div className="mx-auto mt-6 max-w-2xl rounded-sm border border-border bg-card p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  Pour que votre espace ambassadeur soit activé automatiquement après validation,
                  vous devez être connecté.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="hero" size="sm" onClick={() => navigate("/connexion")}>
                    Se connecter / Créer un compte
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                    Retour à l'accueil
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y border-border bg-card py-12">
        <div className="vsm-container">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <benefit.icon className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 font-display text-lg font-semibold">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="vsm-section">
        <div className="vsm-container max-w-2xl">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit}
            className="vsm-card p-6 md:p-8"
          >
            <h2 className="font-display text-2xl font-bold uppercase">
              Formulaire de candidature
            </h2>
            <p className="mt-2 text-muted-foreground">
              Remplissez ce formulaire pour postuler au programme ambassadeur.
            </p>

            <div className="mt-8 space-y-6">
              {/* Personal Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Nom complet *
                  </label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="Votre nom complet"
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="votre@email.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Téléphone *
                  </label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+243 ..."
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-destructive">{errors.phone}</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Nombre de followers
                  </label>
                  <Input
                    type="number"
                    value={formData.followersCount}
                    onChange={(e) =>
                      setFormData({ ...formData, followersCount: e.target.value })
                    }
                    placeholder="10000"
                  />
                </div>
              </div>

              {/* Social Media */}
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Instagram className="h-5 w-5 text-primary" />
                  Réseaux sociaux
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Instagram
                    </label>
                    <Input
                      value={formData.instagramHandle}
                      onChange={(e) =>
                        setFormData({ ...formData, instagramHandle: e.target.value })
                      }
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      TikTok
                    </label>
                    <Input
                      value={formData.tiktokHandle}
                      onChange={(e) =>
                        setFormData({ ...formData, tiktokHandle: e.target.value })
                      }
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Facebook
                    </label>
                    <Input
                      value={formData.facebookHandle}
                      onChange={(e) =>
                        setFormData({ ...formData, facebookHandle: e.target.value })
                      }
                      placeholder="Page ou profil"
                    />
                  </div>
                </div>
              </div>

              {/* Motivation */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Pourquoi voulez-vous devenir ambassadeur? *
                </label>
                <Textarea
                  value={formData.motivation}
                  onChange={(e) =>
                    setFormData({ ...formData, motivation: e.target.value })
                  }
                  placeholder="Expliquez votre intérêt pour VSM Collection et comment vous comptez promouvoir la marque..."
                  rows={5}
                />
                {errors.motivation && (
                  <p className="mt-1 text-sm text-destructive">{errors.motivation}</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="hero"
                size="xl"
                className="w-full gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Envoyer ma candidature
                  </>
                )}
              </Button>
            </div>
          </motion.form>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default BecomeAmbassador;
