import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const Cart = () => {
  const {
    items,
    removeItem,
    updateQuantity,
    getTotal,
    promoCode,
    promoDiscount,
    applyPromoCode,
    removePromoCode,
  } = useCart();
  const [promoInput, setPromoInput] = useState("");

  const formatPrice = (price: number) => {
    return price.toLocaleString("fr-CD") + " FC";
  };

  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const handleApplyPromo = async () => {
    if (promoInput.trim()) {
      await applyPromoCode(promoInput.trim());
      setPromoInput("");
    }
  };

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <section className="flex min-h-[70vh] items-center justify-center pb-20 pt-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground" />
            <h1 className="mt-6 font-display text-3xl font-bold uppercase">
              Votre panier est vide
            </h1>
            <p className="mt-2 text-muted-foreground">
              Découvrez notre collection et ajoutez vos articles préférés.
            </p>
            <Link to="/boutique">
              <Button variant="hero" size="lg" className="mt-8 gap-2">
                <ShoppingBag className="h-5 w-5" />
                Visiter la boutique
              </Button>
            </Link>
          </motion.div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <section className="pb-20 pt-32">
        <div className="vsm-container">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 font-display text-4xl font-bold uppercase tracking-tight md:text-5xl"
          >
            Votre Panier
          </motion.h1>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="vsm-card flex gap-4 p-4"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-24 w-24 rounded-sm object-cover"
                    />
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h3 className="font-display font-semibold uppercase">
                          {item.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(item.price)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-sm border border-border hover:border-primary"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-sm border border-border hover:border-primary"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-display text-lg font-bold text-primary">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:sticky lg:top-24"
            >
              <div className="vsm-card p-6">
                <h2 className="font-display text-xl font-bold uppercase">
                  Récapitulatif
                </h2>

                <div className="mt-6 space-y-4">
                  {/* Promo Code */}
                  {!promoCode ? (
                    <div className="flex gap-2">
                      <Input
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Code promo"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={handleApplyPromo}
                        disabled={!promoInput.trim()}
                      >
                        Appliquer
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-sm bg-primary/10 p-3">
                      <span className="text-sm font-medium text-primary">
                        {promoCode} appliqué
                      </span>
                      <button
                        onClick={removePromoCode}
                        className="text-sm text-muted-foreground hover:text-destructive"
                      >
                        Retirer
                      </button>
                    </div>
                  )}

                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>

                    {promoDiscount > 0 && (
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-muted-foreground">Réduction</span>
                        <span className="text-primary">
                          -{formatPrice(promoDiscount)}
                        </span>
                      </div>
                    )}

                    <div className="mt-4 flex justify-between border-t border-border pt-4">
                      <span className="font-display text-lg font-semibold">
                        Total
                      </span>
                      <span className="font-display text-xl font-bold text-primary">
                        {formatPrice(getTotal())}
                      </span>
                    </div>
                  </div>
                </div>

                <Link to="/commande" className="mt-6 block">
                  <Button variant="hero" size="lg" className="w-full gap-2">
                    Commander
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>

                <Link to="/boutique" className="mt-3 block">
                  <Button variant="outline" className="w-full">
                    Continuer les achats
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Cart;
