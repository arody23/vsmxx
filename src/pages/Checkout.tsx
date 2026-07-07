import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/context/CartContext";
import { provinces, kinshasaCommunes } from "@/data/store";
import { useDeliveryCommunes } from "@/hooks/useDeliveryZones";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, MessageCircle, Truck, MapPin, Gift, Calendar } from "lucide-react";

// Exchange rate: 1 USD = ~2500 FC (approximate)
const USD_TO_FC = 2500;
const FREE_DELIVERY_THRESHOLD_USD = 100;
const FREE_DELIVERY_THRESHOLD_FC = FREE_DELIVERY_THRESHOLD_USD * USD_TO_FC;
const REF_STORAGE_KEY = "vsm_ref";

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, getTotal, promoCode, promoDiscount, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    province: "",
    city: "",
    commune: "",
    deliveryDate: "",
    deliveryTime: "",
    instructions: "",
  });

  const isKinshasa = formData.province === "Kinshasa";

  const { data: deliveryCommunes = kinshasaCommunes.map((c) => ({
    name: c.name,
    city: "Kinshasa",
    deliveryFee: c.deliveryFee,
    zone: c.zone,
  })), isLoading: loadingCommunes } = useDeliveryCommunes("Kinshasa");

  const selectedCommune = useMemo(() => {
    if (isKinshasa && formData.commune) {
      return deliveryCommunes.find((c) => c.name === formData.commune);
    }
    return null;
  }, [isKinshasa, formData.commune, deliveryCommunes]);

  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const subtotalAfterDiscount = getTotal();

  // Free delivery if order is over 100 USD (250,000 FC)
  const isFreeDelivery = subtotalAfterDiscount >= FREE_DELIVERY_THRESHOLD_FC;

  const deliveryFee = useMemo(() => {
    if (isFreeDelivery) return 0;
    if (isKinshasa && selectedCommune) {
      return selectedCommune.deliveryFee;
    }
    return 0;
  }, [isKinshasa, selectedCommune, isFreeDelivery]);

  const totalWithDelivery = subtotalAfterDiscount + deliveryFee;

  const formatPrice = (price: number) => {
    return price.toLocaleString("fr-CD") + " FC";
  };

  // Get minimum delivery date (tomorrow)
  const getMinDeliveryDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  useEffect(() => {
    if (items.length === 0 && !isSubmitting && !isRedirecting) {
      navigate("/panier");
    }
  }, [items.length, isSubmitting, isRedirecting, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.phone || !formData.province) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires.", variant: "destructive" });
      return;
    }

    if (isKinshasa && !formData.commune) {
      toast({ title: "Erreur", description: "Veuillez sélectionner votre commune.", variant: "destructive" });
      return;
    }

    if (!isKinshasa && !formData.city) {
      toast({ title: "Erreur", description: "Veuillez indiquer votre ville.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Load persisted ambassador referral (if any)
      let sourceLinkId: number | null = null;
      try {
        const raw = localStorage.getItem(REF_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { linkId?: number; ts?: number };
          if (typeof parsed?.linkId === "number") sourceLinkId = parsed.linkId;
        }
      } catch {
        // ignore
      }

      // Look up promo_code_id if promo applied
      let promoCodeId: number | null = null;
      if (promoCode) {
        const normalizedPromo = promoCode.trim().toUpperCase();
        const { data: promoData } = await supabase
          .from("promo_codes")
          .select("id")
          .eq("code", normalizedPromo)
          .maybeSingle();

        if (promoData) promoCodeId = promoData.id;
      }

      const deliveryAddr = isKinshasa
        ? `${formData.commune}, Kinshasa`
        : `${formData.city}, ${formData.province}`;

      const orderItemsPayload = items.map((item) => ({
        product_id: Number(item.id),
        product_name: item.name,
        size: item.size || null,
        color: item.color || null,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const composedDeliveryDate = formData.deliveryDate
        ? `${formData.deliveryDate}${formData.deliveryTime ? ` ${formData.deliveryTime}` : ""}`
        : null;

      const { data: orderId, error: orderError } = await (supabase as any).rpc(
        "create_order_with_items",
        {
          _customer_id: user?.id || null,
          _customer_name: formData.fullName,
          _customer_phone: formData.phone,
          _delivery_address: deliveryAddr,
          _delivery_date: composedDeliveryDate,
          _delivery_fee: deliveryFee,
          _notes: formData.instructions || null,
          _promo_code_id: promoCodeId,
          _promo_discount: promoDiscount,
          _total_amount: subtotalAfterDiscount,
          _source_link_id: sourceLinkId,
          _items: orderItemsPayload,
        }
      );

      if (orderError) throw orderError;

      const savedOrderId = Number(orderId);
      if (!savedOrderId) {
        throw new Error("Commande créée mais identifiant introuvable.");
      }

      // Message WhatsApp — ton client naturel, sans emojis (compatibilité encodage)
      const productList = items
        .map((item) => {
          const details = [item.size && `Taille ${item.size}`, item.color && `Couleur ${item.color}`]
            .filter(Boolean)
            .join(", ");
          return `- ${item.name}${details ? ` (${details})` : ""} x${item.quantity} — ${formatPrice(item.price * item.quantity)}`;
        })
        .join("\n");

      const deliveryLines: string[] = [];
      if (isKinshasa) {
        deliveryLines.push(`Commune : ${formData.commune}, Kinshasa`);
      } else {
        deliveryLines.push(`Ville : ${formData.city}, ${formData.province}`);
      }
      if (formData.deliveryDate) {
        const dateLabel = new Date(formData.deliveryDate).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        deliveryLines.push(
          formData.deliveryTime
            ? `Livraison souhaitée : ${dateLabel} à ${formData.deliveryTime}`
            : `Livraison souhaitée : ${dateLabel}`
        );
      } else if (formData.deliveryTime) {
        deliveryLines.push(`Heure souhaitée : ${formData.deliveryTime}`);
      }

      const summaryLines: string[] = [`Sous-total : ${formatPrice(subtotal)}`];
      if (promoDiscount > 0) {
        summaryLines.push(`Réduction${promoCode ? ` (${promoCode})` : ""} : -${formatPrice(promoDiscount)}`);
      }
      if (isFreeDelivery) {
        summaryLines.push("Livraison : offerte");
      } else if (deliveryFee > 0) {
        summaryLines.push(`Livraison : ${formatPrice(deliveryFee)}`);
      } else if (!isKinshasa) {
        summaryLines.push("Livraison : via agence partenaire");
      }
      summaryLines.push(`Total : ${formatPrice(totalWithDelivery)}`);

      const messageParts = [
        "Bonjour VSM Collection,",
        "",
        "Je souhaite passer une commande :",
        "",
        productList,
        "",
        "Mes coordonnées :",
        `Nom : ${formData.fullName}`,
        `Téléphone : ${formData.phone}`,
        ...deliveryLines,
      ];
      if (formData.instructions?.trim()) {
        messageParts.push("", `Instructions : ${formData.instructions.trim()}`);
      }
      messageParts.push("", ...summaryLines, "", "Merci.");

      const message = encodeURIComponent(messageParts.join("\n"));

      const whatsappNumber = "243976028479";
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${message}`;

      setIsRedirecting(true);
      clearCart();
      toast({
        title: "Commande enregistrée!",
        description: `Commande #${savedOrderId} créée avec succès.`,
      });

      window.location.assign(whatsappUrl);
      return;
    } catch (err: any) {
      console.error("Order error:", err);
      toast({
        title: "Erreur",
        description: err.message || "Impossible de créer la commande.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <Navbar />

      <section className="overflow-x-hidden pb-20 pt-32">
        <div className="vsm-container">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 font-display text-4xl font-bold uppercase tracking-tight md:text-5xl"
          >
            Finaliser la commande
          </motion.h1>

          {/* Free Delivery Banner */}
          {!isFreeDelivery && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 flex flex-wrap items-center gap-3 rounded-sm bg-primary/10 p-4"
            >
              <Gift className="h-6 w-6 text-primary" />
              <p className="min-w-0 text-sm break-words">
                <span className="font-semibold">Livraison offerte</span> pour les commandes supérieures à{" "}
                <span className="font-bold text-primary">{formatPrice(FREE_DELIVERY_THRESHOLD_FC)}</span>
                {" "}(~100 USD). Plus que{" "}
                <span className="font-bold text-primary">
                  {formatPrice(FREE_DELIVERY_THRESHOLD_FC - subtotalAfterDiscount)}
                </span>{" "}
                pour en profiter!
              </p>
            </motion.div>
          )}

          {isFreeDelivery && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 flex flex-wrap items-center gap-3 rounded-sm bg-green-500/20 p-4"
            >
              <Gift className="h-6 w-6 text-green-500" />
              <p className="text-sm font-semibold text-green-500">
                🎉 Félicitations! Vous bénéficiez de la livraison gratuite!
              </p>
            </motion.div>
          )}

          <div className="grid min-w-0 gap-8 lg:grid-cols-3">
            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onSubmit={handleSubmit}
              className="min-w-0 lg:col-span-2"
            >
              <div className="vsm-card space-y-6 p-6">
                <h2 className="font-display text-xl font-bold uppercase">
                  Informations de livraison
                </h2>

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
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Numéro de téléphone *
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

                {/* Province */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Province *
                  </label>
                  <Select
                    value={formData.province}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        province: value,
                        commune: "",
                        city: "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez votre province" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((province) => (
                        <SelectItem key={province} value={province}>
                          {province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Kinshasa Commune or City */}
                {isKinshasa ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Commune *
                    </label>
                    <Select
                      value={formData.commune}
                      onValueChange={(value) =>
                        setFormData({ ...formData, commune: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez votre commune" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryCommunes.map((commune) => (
                          <SelectItem key={commune.name} value={commune.name}>
                            {commune.name} - {isFreeDelivery ? "GRATUIT" : formatPrice(commune.deliveryFee)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedCommune && !isFreeDelivery && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 flex items-center gap-2 rounded-sm bg-primary/10 p-3"
                      >
                        <Truck className="h-4 w-4 text-primary" />
                        <span className="text-sm">
                          Frais de livraison:{" "}
                          <span className="font-semibold text-primary">
                            {formatPrice(selectedCommune.deliveryFee)}
                          </span>
                        </span>
                      </motion.div>
                    )}
                  </div>
                ) : formData.province ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Ville *
                    </label>
                    <Input
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="Votre ville"
                      required
                    />
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 flex items-start gap-2 rounded-sm bg-secondary p-3"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                      <p className="text-sm text-muted-foreground">
                        La livraison sera effectuée via une agence partenaire de
                        votre province. Votre commande est validée et expédiée.
                      </p>
                    </motion.div>
                  </div>
                ) : null}

                {/* Delivery Date */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    Date de livraison souhaitée
                  </label>
                  <Input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) =>
                      setFormData({ ...formData, deliveryDate: e.target.value })
                    }
                    min={getMinDeliveryDate()}
                    className="w-full"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optionnel - Nous ferons de notre mieux pour respecter cette date
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Heure de livraison souhaitée
                  </label>
                  <Input
                    type="time"
                    value={formData.deliveryTime}
                    onChange={(e) =>
                      setFormData({ ...formData, deliveryTime: e.target.value })
                    }
                    className="w-full"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optionnel - Exemple: 15:30
                  </p>
                </div>

                {/* Instructions */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Instructions de livraison (optionnel)
                  </label>
                  <Textarea
                    value={formData.instructions}
                    onChange={(e) =>
                      setFormData({ ...formData, instructions: e.target.value })
                    }
                    placeholder="Point de repère, horaires préférés..."
                    rows={3}
                  />
                </div>

                {/* Submit Button */}
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
                      Traitement en cours...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-5 w-5" />
                      Commander via WhatsApp
                    </>
                  )}
                </Button>
              </div>
            </motion.form>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:sticky lg:top-24"
            >
              <div className="vsm-card p-6">
                <h2 className="font-display text-xl font-bold uppercase">
                  Votre commande
                </h2>

                <div className="mt-4 space-y-3">
                  {items.map((item) => (
                    <div key={`${item.id}-${item.size}-${item.color}`} className="flex items-center gap-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-16 w-16 rounded-sm object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.size && `Taille: ${item.size}`}
                          {item.size && item.color && " • "}
                          {item.color && `Couleur: ${item.color}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          x{item.quantity}
                        </p>
                      </div>
                      <span className="font-semibold">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-2 border-t border-border pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Réduction ({promoCode})
                      </span>
                      <span className="text-primary">
                        -{formatPrice(promoDiscount)}
                      </span>
                    </div>
                  )}

                  {isKinshasa && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Livraison</span>
                      {isFreeDelivery ? (
                        <span className="font-semibold text-green-500">OFFERTE</span>
                      ) : deliveryFee > 0 ? (
                        <span>{formatPrice(deliveryFee)}</span>
                      ) : (
                        <span className="text-muted-foreground">Sélectionnez commune</span>
                      )}
                    </div>
                  )}

                  {!isKinshasa && formData.province && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Livraison</span>
                      <span className="text-muted-foreground">Via agence</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-border pt-4">
                    <span className="font-display text-lg font-semibold">
                      Total
                    </span>
                    <span className="font-display text-xl font-bold text-primary">
                      {formatPrice(totalWithDelivery)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Checkout;
