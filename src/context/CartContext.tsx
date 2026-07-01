import React, { createContext, useContext, useState, ReactNode } from "react";
import { CartItem, Product } from "@/types/product";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddToCartOptions {
  size?: string;
  color?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, options?: AddToCartOptions) => void;
  removeItem: (productId: string, size?: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  promoCode: string | null;
  promoDiscount: number;
  applyPromoCode: (code: string) => Promise<boolean>;
  removePromoCode: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const norm = (v?: string) => v ?? "";

const sameCartLine = (
  item: CartItem,
  productId: string,
  size?: string,
  color?: string
) =>
  item.id === productId &&
  norm(item.size) === norm(size) &&
  norm(item.color) === norm(color);

export const cartLineKey = (item: CartItem) =>
  `${item.id}::${norm(item.size)}::${norm(item.color)}`;

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState<number>(0);

  const addItem = (product: Product, options?: AddToCartOptions) => {
    const size = options?.size;
    const color = options?.color;

    setItems((prevItems) => {
      const existingItem = prevItems.find((item) =>
        sameCartLine(item, product.id, size, color)
      );
      if (existingItem) {
        return prevItems.map((item) =>
          sameCartLine(item, product.id, size, color)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevItems, { ...product, quantity: 1, size, color }];
    });

    toast({
      title: "Ajouté au panier",
      description: `${product.name}${size ? ` (${size})` : ''}${color ? ` - ${color}` : ''} a été ajouté à votre panier.`,
    });
  };

  const removeItem = (productId: string, size?: string, color?: string) => {
    setItems((prevItems) =>
      prevItems.filter((item) => !sameCartLine(item, productId, size, color))
    );
  };

  const updateQuantity = (productId: string, quantity: number, size?: string, color?: string) => {
    if (quantity <= 0) {
      removeItem(productId, size, color);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((item) =>
        sameCartLine(item, productId, size, color) ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setPromoCode(null);
    setPromoDiscount(0);
  };

  const getTotal = () => {
    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
    return subtotal - promoDiscount;
  };

  const getItemCount = () => items.reduce((total, item) => total + item.quantity, 0);

  const applyPromoCode = async (code: string): Promise<boolean> => {
    try {
      const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
      if (subtotal <= 0) {
        toast({ title: "Panier vide", description: "Ajoutez des articles avant d'appliquer un code.", variant: "destructive" });
        return false;
      }

      const { data, error } = await (supabase as any).rpc("validate_promo_code", {
        p_code: code.trim(),
        p_subtotal: subtotal,
      });

      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        return false;
      }

      const result = data as {
        valid?: boolean;
        message?: string;
        code?: string;
        discount_amount?: number;
        discount_percent?: number;
        discount_type?: string;
        tier_label?: string;
      };

      if (!result?.valid) {
        toast({
          title: "Code invalide",
          description: result?.message || "Ce code promo n'existe pas ou n'est plus actif.",
          variant: "destructive",
        });
        return false;
      }

      const discount = Number(result.discount_amount || 0);
      setPromoCode(result.code || code.toUpperCase());
      setPromoDiscount(discount);

      const discountLabel =
        result.discount_type === "percent" && result.discount_percent != null
          ? `${result.discount_percent}%`
          : `${discount.toLocaleString("fr-CD")} FC`;

      toast({
        title: "Code promo appliqué!",
        description: result.tier_label
          ? `Réduction ${result.tier_label} : -${discountLabel}`
          : `Réduction de ${discountLabel}`,
      });
      return true;
    } catch {
      toast({ title: "Erreur", description: "Impossible de vérifier le code promo.", variant: "destructive" });
      return false;
    }
  };

  const removePromoCode = () => {
    setPromoCode(null);
    setPromoDiscount(0);
  };

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, getTotal, getItemCount, promoCode, promoDiscount, applyPromoCode, removePromoCode }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};
