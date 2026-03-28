import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Phone, Mail, MapPin, Send, Clock } from "lucide-react";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    toast({
      title: "Message envoyé!",
      description: "Nous vous répondrons dans les plus brefs délais.",
    });

    setFormData({ name: "", phone: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pb-12 pt-32 md:pt-40">
        <div className="vsm-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">
              Contactez-nous
            </p>
            <h1 className="mt-2 font-display text-5xl font-bold uppercase tracking-tight md:text-6xl">
              Contact
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Une question ? Une suggestion ? Nous sommes là pour vous.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Grid */}
      <section className="vsm-section pt-8">
        <div className="vsm-container">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
                  Informations
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Retrouvez-nous à notre boutique ou contactez-nous directement.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-secondary">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">Adresse</h3>
                    <p className="text-sm text-muted-foreground">
                      Ngiri-Ngiri, Kinshasa<br />
                      République Démocratique du Congo
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-secondary">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">Téléphone</h3>
                    <a
                      href="tel:+243000000000"
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      +243 000 000 000
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-secondary">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">Email</h3>
                    <a
                      href="mailto:contact@vsmcollection.com"
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      contact@vsmcollection.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-secondary">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">Horaires</h3>
                    <p className="text-sm text-muted-foreground">
                      Lun - Sam: 9h00 - 18h00<br />
                      Dimanche: Fermé
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <form onSubmit={handleSubmit} className="vsm-card space-y-6 p-8">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
                  Envoyez un message
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Nom complet
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Votre nom"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Téléphone
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+243 ..."
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Sujet</label>
                  <Input
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    placeholder="Sujet de votre message"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Message</label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    placeholder="Votre message..."
                    rows={5}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Envoyer
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Contact;
