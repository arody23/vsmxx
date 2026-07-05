import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Package, Users, DollarSign, ShoppingCart, Plus, Edit, Trash2,
  LogOut, Menu, X, Tag, Truck, UserCheck, BarChart3, Save, Loader2, Check, XCircle, Image, Settings,
  AlertTriangle, Eye, TrendingUp, Calendar, Phone, MapPin, ChevronDown, ChevronUp,
  Wallet, Receipt, HandCoins, Bike, ScanLine, Download, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useAllProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import ImageUploader from "@/components/admin/ImageUploader";
import { VsmBrandMark } from "@/components/VsmBrandMark";
import MultiImageUploader from "@/components/admin/MultiImageUploader";
import { slugify } from "@/lib/slug";
import { normalizeBarcode } from "@/lib/barcode";
import { downloadBarcodeSvg } from "@/lib/barcode";
import { getMerchandiseAmount, getCustomerPayableTotal } from "@/lib/orderAmounts";
import { getTierDiscountPercent, getTierFromLabel } from "@/lib/ambassadorTiers";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const menuItems = [
  { icon: TrendingUp, label: "Dashboard", id: "dashboard" },
  { icon: Package, label: "Produits", id: "products" },
  { icon: ShoppingCart, label: "Commandes", id: "orders" },
  { icon: HandCoins, label: "POS & Opérations", id: "operations" },
  { icon: Package, label: "Stock & codes", id: "inventory" },
  { icon: Receipt, label: "Finance Pro", id: "finance" },
  { icon: Truck, label: "Livraison", id: "delivery" },
  { icon: Tag, label: "Promos", id: "promos" },
  { icon: Star, label: "Avis produits", id: "reviews" },
  { icon: UserCheck, label: "Ambassadeurs", id: "ambassadors" },
  { icon: Wallet, label: "Retraits amb.", id: "withdrawals" },
  { icon: Users, label: "Clients", id: "clients" },
  { icon: Image, label: "Héros", id: "hero" },
];

const formatPrice = (price: number) => price.toLocaleString("fr-CD") + " FC";
const formatDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const COLORS = [
  { name: "Noir", value: "#000000" },
  { name: "Blanc", value: "#FFFFFF" },
  { name: "Rouge", value: "#E11D48" },
  { name: "Bleu", value: "#2563EB" },
  { name: "Vert", value: "#16A34A" },
  { name: "Gris", value: "#6B7280" },
  { name: "Beige", value: "#D2B48C" },
  { name: "Marine", value: "#1E3A5F" },
];

const ORDER_STATUSES: Record<string, { label: string; color: string }> = {
  nouvelle: { label: "Nouvelle", color: "bg-yellow-500/20 text-yellow-600" },
  traitée: { label: "Traitée", color: "bg-blue-500/20 text-blue-600" },
  expédiée: { label: "Expédiée", color: "bg-purple-500/20 text-purple-600" },
  annulée: { label: "Annulée", color: "bg-red-500/20 text-red-600" },
};

const PRO_STATUS_COLORS: Record<string, string> = {
  nouvelle: "#EAB308",
  traitée: "#3B82F6",
  expédiée: "#A855F7",
  annulée: "#EF4444",
};

// =================== Product Form with Variants ===================
interface VariantRow { color: string; size: string; stock: number; id?: number; barcode?: string | null; }

const ProductForm = ({ product, onClose }: { product?: Tables<"products"> | null; onClose: () => void }) => {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const queryClient = useQueryClient();
  const existingImages = product?.images || (product?.image_url ? [product.image_url] : []);

  const [form, setForm] = useState({
    name: product?.name || "", description: product?.description || "",
    price: product?.price ? String(product.price) : "", category: product?.category || "",
    image_url: product?.image_url || "", images: existingImages as string[],
    sku: product?.sku || "", slug: product?.slug || "", is_active: product?.is_active ?? true,
  });
  const [slugTouched, setSlugTouched] = useState(!!product?.slug);

  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [newColor, setNewColor] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newStock, setNewStock] = useState("0");
  const [variantsLoaded, setVariantsLoaded] = useState(!product);

  useEffect(() => {
    if (!product) return;

    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id)
      .then(({ data }) => {
        if (data) {
          setVariants(
            data.map((v: any) => ({
              id: v.id,
              color: v.color,
              size: v.size,
              stock: v.stock,
              barcode: v.barcode,
            }))
          );
        }
        setVariantsLoaded(true);
      });
  }, [product]);

  const addVariant = () => {
    if (!newColor || !newSize) return;
    if (variants.find(v => v.color === newColor && v.size === newSize)) {
      toast({ title: "Cette combinaison existe déjà", variant: "destructive" });
      return;
    }
    setVariants(prev => [...prev, { color: newColor, size: newSize, stock: Number(newStock) || 0 }]);
    setNewStock("0");
  };

  const removeVariant = (index: number) => setVariants(prev => prev.filter((_, i) => i !== index));
  const updateVariantStock = (index: number, stock: number) => setVariants(prev => prev.map((v, i) => i === index ? { ...v, stock } : v));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mainImage = form.images.length > 0 ? form.images[0] : form.image_url || null;
    const totalStock = variants.length > 0 ? variants.reduce((s, v) => s + v.stock, 0) : 0;
    const payload = {
      name: form.name, description: form.description || null, price: form.price ? Number(form.price) : null,
      category: form.category || null, image_url: mainImage, images: form.images.length > 0 ? form.images : null,
      stock: totalStock, sku: form.sku || null,
      slug: (form.slug || slugify(form.name)).trim() || `produit-${product?.id ?? "new"}`,
      is_active: form.is_active,
    };
    try {
      let productId: number;
      if (product) {
        await updateProduct.mutateAsync({ id: product.id, ...payload });
        productId = product.id;
      } else {
        const created = await createProduct.mutateAsync(payload);
        productId = created.id;
      }

      const { data: existingVariants, error: loadVarErr } = await supabase
        .from("product_variants")
        .select("id, color, size, stock, barcode")
        .eq("product_id", productId);
      if (loadVarErr) throw loadVarErr;

      const existing = existingVariants || [];
      const keepKeys = new Set(variants.map((v) => `${v.color}|${v.size}`));

      for (const variant of variants) {
        const match = existing.find((e) => e.color === variant.color && e.size === variant.size);
        if (match) {
          const { error } = await supabase
            .from("product_variants")
            .update({ stock: variant.stock })
            .eq("id", match.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("product_variants").insert({
            product_id: productId,
            color: variant.color,
            size: variant.size,
            stock: variant.stock,
          });
          if (error) throw error;
        }
      }

      for (const old of existing) {
        if (!keepKeys.has(`${old.color}|${old.size}`)) {
          const { error } = await supabase.from("product_variants").delete().eq("id", old.id);
          if (error) throw error;
        }
      }
      toast({ title: product ? "Produit mis à jour" : "Produit créé" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    } catch (err: any) {
      const msg = String(err?.message || "Erreur");
      const description = msg.includes("products_slug_key")
        ? "Ce slug URL est déjà utilisé par un autre produit."
        : msg.includes("slug")
          ? "Impossible d'enregistrer le slug. Réessayez avec une URL différente."
          : msg;
      toast({ title: "Erreur", description, variant: "destructive" });
    }
  };

  const isLoading = createProduct.isPending || updateProduct.isPending;
  const uniqueColors = [...new Set(variants.map(v => v.color))];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium">Images du produit</label>
        <MultiImageUploader values={form.images} onChange={(urls) => setForm({ ...form, images: urls, image_url: urls[0] || "" })} folder="products" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <label className="font-display text-xs font-semibold uppercase tracking-wider">Nom *</label>
          <Input
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((prev) => ({
                ...prev,
                name,
                slug: slugTouched ? prev.slug : slugify(name),
              }));
            }}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="font-display text-xs font-semibold uppercase tracking-wider">URL du produit</label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="shrink-0 text-sm text-muted-foreground">/produit/</span>
            <Input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm({ ...form, slug: slugify(e.target.value) });
              }}
              placeholder="mon-hoodie-vsm"
            />
          </div>
          <p className="text-xs text-muted-foreground">Généré depuis le nom. Modifiable pour une URL lisible.</p>
        </div>
        <div className="space-y-2"><label className="font-display text-xs font-semibold uppercase tracking-wider">SKU</label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
        <div className="space-y-2"><label className="font-display text-xs font-semibold uppercase tracking-wider">Prix (FC)</label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div className="space-y-2">
          <label className="font-display text-xs font-semibold uppercase tracking-wider">Catégorie</label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{["hoodies", "t-shirts", "pantalons", "vestes", "ensembles", "accessoires"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <label className="text-sm">Actif</label>
          </div>
        </div>
      </div>
      <div className="space-y-2"><label className="text-sm font-medium">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>

      {/* Variants */}
      <div className="space-y-3 rounded-md border border-border p-4">
        <h4 className="font-display text-sm font-bold uppercase tracking-wider">Variantes (Couleur / Taille / Stock)</h4>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Couleur</label>
            <Select value={newColor} onValueChange={setNewColor}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Couleur" /></SelectTrigger>
              <SelectContent>{COLORS.map(c => <SelectItem key={c.name} value={c.name}><span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c.value }} />{c.name}</span></SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Taille</label>
            <Select value={newSize} onValueChange={setNewSize}>
              <SelectTrigger className="w-24"><SelectValue placeholder="Taille" /></SelectTrigger>
              <SelectContent>{SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Stock</label>
            <Input type="number" className="w-20" value={newStock} onChange={e => setNewStock(e.target.value)} min={0} />
          </div>
          <Button type="button" size="sm" onClick={addVariant} disabled={!newColor || !newSize}><Plus className="mr-1 h-4 w-4" />Ajouter</Button>
        </div>
        {uniqueColors.length > 0 && (
          <div className="space-y-3 pt-2">
            {uniqueColors.map(color => {
              const colorObj = COLORS.find(c => c.name === color);
              const colorVariants = variants.filter(v => v.color === color);
              const colorTotal = colorVariants.reduce((s, v) => s + v.stock, 0);
              return (
                <div key={color} className="rounded-sm border border-border/50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded-full border border-border" style={{ backgroundColor: colorObj?.value || "#888" }} />
                    <span className="text-sm font-semibold">{color}</span>
                    <span className="text-xs text-muted-foreground">({colorTotal} pièces)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colorVariants.map((v) => {
                      const idx = variants.findIndex(x => x.color === v.color && x.size === v.size);
                      return (
                        <div key={`${v.color}-${v.size}`} className="flex items-center gap-1 rounded-sm border border-border bg-secondary px-2 py-1">
                          <span className="text-xs font-medium">{v.size}</span>
                          <Input type="number" className="h-6 w-14 border-0 bg-transparent p-0 text-center text-xs" value={v.stock}
                            onChange={e => updateVariantStock(idx, Number(e.target.value) || 0)} min={0} />
                          <button type="button" onClick={() => removeVariant(idx)} className="text-destructive hover:text-destructive/80"><X className="h-3 w-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">Stock total: {variants.reduce((s, v) => s + v.stock, 0)} pièces</p>
          </div>
        )}
        {variants.length === 0 && variantsLoaded && <p className="text-xs text-muted-foreground">Aucune variante ajoutée.</p>}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {product ? "Modifier" : "Créer"}
        </Button>
      </div>
    </form>
  );
};

// =================== Hero Manager ===================
const HeroManager = () => {
  const queryClient = useQueryClient();
  const { data: heroSettings, isLoading } = useQuery({
    queryKey: ["hero-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*")
        .in("key", ["hero_1_image", "hero_1_title", "hero_1_subtitle", "hero_2_image", "hero_2_title", "hero_2_subtitle", "hero_3_image", "hero_3_title", "hero_3_subtitle"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach(s => { map[s.key] = s.value || ""; });
      return map;
    },
  });
  const [slides, setSlides] = useState<{ image: string; title: string; subtitle: string }[]>([]);

  useEffect(() => {
    if (!heroSettings) return;

    setSlides([
      {
        image: heroSettings.hero_1_image || "",
        title: heroSettings.hero_1_title || "",
        subtitle: heroSettings.hero_1_subtitle || "",
      },
      {
        image: heroSettings.hero_2_image || "",
        title: heroSettings.hero_2_title || "",
        subtitle: heroSettings.hero_2_subtitle || "",
      },
      {
        image: heroSettings.hero_3_image || "",
        title: heroSettings.hero_3_title || "",
        subtitle: heroSettings.hero_3_subtitle || "",
      },
    ]);
  }, [heroSettings]);

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    const updates = slides.flatMap((slide, i) => [
      { key: `hero_${i + 1}_image`, value: slide.image },
      { key: `hero_${i + 1}_title`, value: slide.title },
      { key: `hero_${i + 1}_subtitle`, value: slide.subtitle },
    ]);

    for (const item of updates) {
      await supabase
        .from("settings")
        .upsert({ key: item.key, value: item.value }, { onConflict: "key" });
    }

    toast({ title: "Slides héros mises à jour" });
    queryClient.invalidateQueries({ queryKey: ["hero-settings"] });
    setSaving(false);
  };

  const updateSlide = (index: number, field: string, value: string) => {
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };
  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-bold">Section Héros</h3>
        <Button onClick={handleSave} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Sauvegarder</Button>
      </div>
      <div className="grid gap-6">
        {slides.map((slide, i) => (
          <div key={i} className="vsm-card p-6">
            <h4 className="mb-4 font-display text-lg font-semibold">Slide {i + 1}</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <ImageUploader value={slide.image} onChange={(url) => updateSlide(i, "image", url)} folder="hero" />
              <div className="space-y-3">
                <div className="space-y-1"><label className="text-sm font-medium">Titre</label><Input value={slide.title} onChange={(e) => updateSlide(i, "title", e.target.value)} /></div>
                <div className="space-y-1"><label className="text-sm font-medium">Sous-titre</label><Input value={slide.subtitle} onChange={(e) => updateSlide(i, "subtitle", e.target.value)} /></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// =================== Promo Form ===================
const PromoForm = ({
  onClose,
  ambassadors,
  defaultAmbassadorId,
}: {
  onClose: () => void;
  ambassadors: Array<{ user_id: string; full_name: string; username: string }>;
  defaultAmbassadorId?: string;
}) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: "",
    discount_value: "",
    discount_type: "percent",
    description: "",
    max_usage: "",
    is_global: !defaultAmbassadorId,
    ambassador_id: defaultAmbassadorId || "",
    create_tracking_link: false,
    tracking_slug: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadTierDiscount = async () => {
      if (form.is_global || !form.ambassador_id) return;
      const { data: tierLabel } = await (supabase as any).rpc("get_ambassador_program_tier", {
        p_user_id: form.ambassador_id,
      });
      const percent = getTierDiscountPercent(getTierFromLabel(tierLabel as string));
      setForm((prev) => ({
        ...prev,
        discount_value: String(percent),
        discount_type: "percent",
      }));
    };
    loadTierDiscount();
  }, [form.ambassador_id, form.is_global]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.discount_value) return;
    const ambassadorId = form.ambassador_id?.trim() || null;
    if (!form.is_global && !ambassadorId) {
      toast({ title: "Ambassadeur requis", description: "Choisissez un ambassadeur ou cochez « Code global ».", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: createdPromo, error } = await supabase.from("promo_codes").insert({
      code: form.code.toUpperCase(),
      discount_value: Number(form.discount_value),
      discount_type: form.discount_type,
      description: form.description || null,
      max_usage: form.max_usage ? Number(form.max_usage) : null,
      is_global: form.is_global,
      ambassador_id: form.is_global ? null : ambassadorId,
      active: true,
    }).select("*").single();
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      if (form.create_tracking_link && ambassadorId) {
        const rawSlug = (form.tracking_slug || form.code || "VSM")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        const finalSlug = rawSlug.length >= 4 ? rawSlug : `${rawSlug || "VSM"}${Math.floor(100 + Math.random() * 900)}`;
        const { error: linkErr } = await supabase.from("ambassador_links").insert({
          ambassador_id: ambassadorId,
          slug: finalSlug,
          target_type: "shop",
          promo_code_id: createdPromo?.id || null,
          active: true,
        });
        if (linkErr) {
          toast({ title: "Code créé, lien échoué", description: linkErr.message, variant: "destructive" });
        }
      }

      toast({ title: "Code promo créé" });
      queryClient.invalidateQueries({ queryKey: ["admin-promos"] });
      queryClient.invalidateQueries({ queryKey: ["admin-ambassadors"] });
      onClose();
    }
    setSaving(false);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><label className="text-sm font-medium">Code *</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VSM20" required /></div>
        <div className="space-y-2"><label className="text-sm font-medium">Valeur *</label><Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} required /></div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="percent">Pourcentage (%)</SelectItem><SelectItem value="fixed">Fixe (FC)</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><label className="text-sm font-medium">Max utilisations</label><Input type="number" value={form.max_usage} onChange={(e) => setForm({ ...form, max_usage: e.target.value })} placeholder="Illimité" /></div>
      </div>
      <div className="space-y-2"><label className="text-sm font-medium">Description</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_global} onCheckedChange={(v) => setForm({ ...form, is_global: v, ambassador_id: v ? "" : form.ambassador_id })} />
          <label className="text-sm">Code global</label>
        </div>
        {!form.is_global && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Ambassadeur</label>
            <Select value={form.ambassador_id} onValueChange={(v) => setForm({ ...form, ambassador_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un ambassadeur" /></SelectTrigger>
              <SelectContent>
                {ambassadors.map((a) => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.full_name} {a.username ? `(@${a.username})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {!form.is_global && (
        <div className="rounded-sm border border-border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Switch checked={form.create_tracking_link} onCheckedChange={(v) => setForm({ ...form, create_tracking_link: v })} />
            <label className="text-sm">Créer aussi un lien tracking</label>
          </div>
          {form.create_tracking_link && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Slug du lien (optionnel)</label>
              <Input value={form.tracking_slug} onChange={(e) => setForm({ ...form, tracking_slug: e.target.value })} placeholder="ex: BRANDON25" />
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Créer</Button>
      </div>
    </form>
  );
};

// =================== Main Admin Dashboard ===================
const VALID_ADMIN_TABS = new Set(menuItems.map((m) => m.id));

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, signOut, loading: authLoading, rolesLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editProduct, setEditProduct] = useState<Tables<"products"> | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoDefaultAmbassadorId, setPromoDefaultAmbassadorId] = useState<string | undefined>(undefined);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [deliveryFeeDrafts, setDeliveryFeeDrafts] = useState<Record<number, string>>({});
  const [expenseForm, setExpenseForm] = useState({ title: "", category: "operations", amount: "", expense_date: "", notes: "" });
  const [staffAccountForm, setStaffAccountForm] = useState({
    badge: "",
    password: "",
    full_name: "",
    role: "pos",
  });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [adminScanCode, setAdminScanCode] = useState("");
  const [adminScanCart, setAdminScanCart] = useState<Array<{ variant_id: number; product_id: number; product_name: string; color: string; size: string; unit_price: number; quantity: number }>>([]);
  const [manualOrder, setManualOrder] = useState({
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    delivery_fee: "0",
    order_source: "manual",
    notes: "",
  });
  const [manualLines, setManualLines] = useState<Array<{ productId: string; quantity: string }>>([
    { productId: "", quantity: "1" },
  ]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && VALID_ADMIN_TABS.has(tab)) setActiveTab(tab);
  }, [searchParams]);

  const { data: products, isLoading: productsLoading } = useAllProducts();
  const deleteProduct = useDeleteProduct();

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_dashboard_orders");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 15000,
  });

  const { data: allOrderItems } = useQuery({
    queryKey: ["admin-order-items"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_dashboard_order_items");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 15000,
  });

  const { data: variants } = useQuery({
    queryKey: ["admin-variants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_variants").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 15000,
  });

  const { data: promoCodes } = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 20000,
  });

  const { data: productReviews } = useQuery({
    queryKey: ["admin-product-reviews"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_reviews")
        .select("id, product_id, client_name, rating, comment, image_url, created_at, products(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: number;
        product_id: number;
        client_name: string;
        rating: number;
        comment: string | null;
        image_url: string | null;
        created_at: string | null;
        products: { name: string } | null;
      }>;
    },
    enabled: !!user && isAdmin,
    refetchInterval: 20000,
  });

  const { data: deliveryZones } = useQuery({
    queryKey: ["admin-delivery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 30000,
  });

  const { data: ambassadorApps } = useQuery({
    queryKey: ["admin-ambassadors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ambassador_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 20000,
  });

  const { data: withdrawalRequests } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ambassador_withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 20000,
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 30000,
  });

  const { data: expenses } = useQuery({
    queryKey: ["admin-expenses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 30000,
  });

  const { data: couriers } = useQuery({
    queryKey: ["admin-couriers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("couriers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 30000,
  });

  const { data: staffMembers } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_list_staff_members");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 30000,
  });

  // Computed stats (100% basés DB) — seules les commandes confirmées comptent pour le CA
  const allOrders = orders || [];
  const allItems = allOrderItems || [];
  const allVariants = variants || [];

  const confirmedStatuses = ["traitée", "expédiée"];
  const confirmedOrders = allOrders.filter((o) => confirmedStatuses.includes(o.status));
  const confirmedOrderIds = new Set(confirmedOrders.map((o) => o.id));
  const confirmedItems = allItems.filter((item) => confirmedOrderIds.has(item.order_id));

  const orderItemsByOrder = useMemo(() => {
    return allItems.reduce<Record<number, any[]>>((acc, item) => {
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push(item);
      return acc;
    }, {});
  }, [allItems]);

  const getNetOrderAmount = (order: any) => getMerchandiseAmount(order);

  const pendingOrders = allOrders.filter((o) => o.status === "nouvelle");
  const totalSales = confirmedOrders.reduce((sum, o) => sum + getNetOrderAmount(o), 0);
  const totalOrders = allOrders.length;
  const totalProducts = (products || []).length;
  const totalClients = (clients || []).length;
  const pendingApps = (ambassadorApps || []).filter((a) => a.status === "pending").length;
  const soldUnits = confirmedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const inventoryUnits = allVariants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
  const productById = useMemo(() => {
    return new Map((products || []).map((p) => [Number(p.id), p]));
  }, [products]);
  const cogsAmount = confirmedItems.reduce((sum, item) => {
    const itemCost = Number((item as any).unit_cost || 0);
    const fallbackCost = Number((productById.get(Number(item.product_id)) as any)?.unit_cost || 0);
    return sum + (itemCost || fallbackCost) * Number(item.quantity || 0);
  }, 0);
  const totalExpenses = (expenses || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  const grossProfit = totalSales - cogsAmount - totalExpenses;

  // Low stock
  const lowStockProducts = (products || []).filter(
    (p) => (p.stock ?? 0) <= 5 && p.is_active
  );
  const lowStockVariants = allVariants.filter((variant) => Number(variant.stock) <= 3);

  // Revenue this month (confirmed only)
  const now = new Date();
  const thisMonth = confirmedOrders.filter((o) => {
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRevenue = thisMonth.reduce((s, o) => s + getNetOrderAmount(o), 0);
  const avgBasket = confirmedOrders.length > 0 ? Math.floor(totalSales / confirmedOrders.length) : 0;
  const todayRevenue = confirmedOrders
    .filter((o) => {
      if (!o.created_at) return false;
      return new Date(o.created_at).toDateString() === now.toDateString();
    })
    .reduce((s, o) => s + getNetOrderAmount(o), 0);

  const topSellingProducts = useMemo(() => {
    const namesById = new Map<number, string>();
    (products || []).forEach((product) => {
      namesById.set(product.id, product.name);
    });

    const soldByProduct = new Map<number, number>();
    confirmedItems.forEach((item) => {
      const productId = Number(item.product_id);
      if (!productId) return;
      soldByProduct.set(
        productId,
        (soldByProduct.get(productId) || 0) + Number(item.quantity || 0)
      );
    });

    return Array.from(soldByProduct.entries())
      .map(([productId, qty]) => ({
        productId,
        qty,
        name: namesById.get(productId) || `Produit #${productId}`,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [confirmedItems, products]);

  const approvedAmbassadors = useMemo(() => {
    return (ambassadorApps || [])
      .filter((a: any) => a.status === "approved" && a.user_id)
      .map((a: any) => ({
        user_id: String(a.user_id),
        full_name: a.full_name || "Ambassadeur",
        username: a.username || "",
      }));
  }, [ambassadorApps]);

  // Realtime + polling fallback
  useEffect(() => {
    if (!user || !isAdmin) return;

    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin-variants"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products", "all"] });
    };

    const channel = supabase
      .channel("admin-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        invalidateAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        invalidateAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        invalidateAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_variants" },
        invalidateAll
      )
      .subscribe();

    const poller = window.setInterval(invalidateAll, 20000);

    return () => {
      window.clearInterval(poller);
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, queryClient]);

  const [dzForm, setDzForm] = useState({ name: "", city: "Kinshasa", price: "", zone_type: "moyenne" });
  const [editingDz, setEditingDz] = useState<{
    id: number;
    name: string;
    city: string;
    price: string;
    zone_type: string;
  } | null>(null);
  const [savingDzId, setSavingDzId] = useState<number | null>(null);

  const handleCreateDZ = async () => {
    if (!dzForm.name.trim()) {
      toast({ title: "Commune requise", variant: "destructive" });
      return;
    }
    const price = Number(dzForm.price);
    if (!Number.isFinite(price) || price < 0) {
      toast({ title: "Prix invalide", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("delivery_zones").insert({
      name: dzForm.name.trim(),
      city: dzForm.city.trim() || "Kinshasa",
      price,
      zone_type: dzForm.zone_type || null,
      is_active: true,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Commune ajoutée" });
    setDzForm({ name: "", city: "Kinshasa", price: "", zone_type: "moyenne" });
    queryClient.invalidateQueries({ queryKey: ["admin-delivery"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
  };

  const openEditDZ = (dz: any) => {
    setEditingDz({
      id: dz.id,
      name: dz.name,
      city: dz.city || "Kinshasa",
      price: String(dz.price ?? ""),
      zone_type: dz.zone_type || "moyenne",
    });
  };

  const handleUpdateDZ = async () => {
    if (!editingDz) return;
    if (!editingDz.name.trim()) {
      toast({ title: "Commune requise", variant: "destructive" });
      return;
    }
    const price = Number(editingDz.price);
    if (!Number.isFinite(price) || price < 0) {
      toast({ title: "Prix invalide", variant: "destructive" });
      return;
    }
    setSavingDzId(editingDz.id);
    const { error } = await supabase
      .from("delivery_zones")
      .update({
        name: editingDz.name.trim(),
        city: editingDz.city.trim() || "Kinshasa",
        price,
        zone_type: editingDz.zone_type || null,
      })
      .eq("id", editingDz.id);
    setSavingDzId(null);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Zone modifiée", description: `${editingDz.name} — ${price.toLocaleString("fr-CD")} FC` });
    setEditingDz(null);
    queryClient.invalidateQueries({ queryKey: ["admin-delivery"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
  };
  const handleAppStatus = async (id: number, status: string) => {
    const { error } = await supabase.from("ambassador_applications").update({ status }).eq("id", id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Candidature ${status === "approved" ? "approuvée" : "refusée"}` });
    queryClient.invalidateQueries({ queryKey: ["admin-ambassadors"] });

    if (status === "approved") {
      try {
        const { data: app } = await (supabase as any)
          .from("ambassador_applications")
          .select("id, user_id, username, full_name")
          .eq("id", id)
          .maybeSingle();

        const userId = app?.user_id as string | null | undefined;
        if (!userId) return;

        // Grant role ambassador (ignore if already granted)
        await (supabase as any)
          .from("user_roles")
          .insert({ user_id: userId, role: "ambassador" })
          .throwOnError?.();

        // Ensure at least one active tracking link exists
        const { data: existing } = await supabase
          .from("ambassador_links")
          .select("id")
          .eq("ambassador_id", userId)
          .limit(1);

        if (!existing || existing.length === 0) {
          const base = (app?.username || app?.full_name || "VSM")
            .toString()
            .replace(/^@/, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          const slug = (base || "VSM") + Math.floor(100 + Math.random() * 900);
          await supabase.from("ambassador_links").insert({
            ambassador_id: userId,
            slug,
            target_type: "shop",
            active: true,
          });
        }

        toast({ title: "Ambassadeur activé", description: "Rôle et lien de tracking créés." });
      } catch (e: any) {
        // Don't block approval flow if provisioning fails
        console.error("Ambassador provisioning error:", e);
      }
    }
  };
  const handleOrderStatus = async (id: number, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Statut mis à jour" });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const handleUpdateOrderDeliveryFee = async (order: any) => {
    const draft = deliveryFeeDrafts[order.id];
    if (draft == null) return;
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({ title: "Montant invalide", description: "Le frais de livraison doit etre un nombre >= 0.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("orders")
      .update({ delivery_fee: parsed })
      .eq("id", order.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Livraison mise a jour", description: `Nouveau frais: ${formatPrice(parsed)}` });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const handleTogglePromo = async (id: number, active: boolean) => {
    const { error } = await supabase.from("promo_codes").update({ active }).eq("id", id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-promos"] });
  };
  const handleDeletePromo = async (id: number) => {
    if (!confirm("Supprimer ce code promo ?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-promos"] });
  };
  const handleDeleteReview = async (id: number) => {
    if (!confirm("Supprimer cet avis public ?")) return;
    const { error } = await (supabase as any).from("product_reviews").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Avis supprimé" });
    queryClient.invalidateQueries({ queryKey: ["admin-product-reviews"] });
  };
  const handleWithdrawalStatus = async (id: number, status: string) => {
    const { error } = await supabase
      .from("ambassador_withdrawal_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Demande mise à jour" });
    queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
  };
  const handleToggleDZ = async (id: number, is_active: boolean) => {
    const { error } = await supabase.from("delivery_zones").update({ is_active }).eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin-delivery"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
  };
  const handleDeleteDZ = async (id: number) => {
    if (!confirm("Supprimer cette zone ?")) return;
    const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Zone supprimée" });
    queryClient.invalidateQueries({ queryKey: ["admin-delivery"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
  };
  const handleCreateExpense = async () => {
    if (!expenseForm.title || !expenseForm.amount) return;
    const { error } = await (supabase as any).from("expenses").insert({
      title: expenseForm.title,
      category: expenseForm.category || "operations",
      amount: Number(expenseForm.amount),
      expense_date: expenseForm.expense_date || new Date().toISOString().slice(0, 10),
      notes: expenseForm.notes || null,
      created_by: user?.id || null,
    });
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    setExpenseForm({ title: "", category: "operations", amount: "", expense_date: "", notes: "" });
    toast({ title: "Dépense enregistrée" });
    queryClient.invalidateQueries({ queryKey: ["admin-expenses"] });
  };
  const handleCreateStaffAccount = async () => {
    if (!staffAccountForm.badge || !staffAccountForm.password || !staffAccountForm.full_name) {
      toast({ title: "Champs requis", description: "Nom, badge et mot de passe obligatoires.", variant: "destructive" });
      return;
    }
    if (staffAccountForm.badge.trim().length < 3) {
      toast({ title: "Badge trop court", description: "Minimum 3 caractères.", variant: "destructive" });
      return;
    }
    if (staffAccountForm.password.length < 6) {
      toast({ title: "Mot de passe faible", description: "Minimum 6 caractères.", variant: "destructive" });
      return;
    }
    setCreatingStaff(true);
    try {
      const { data, error } = await (supabase as any).rpc("admin_create_staff_member", {
        p_badge: staffAccountForm.badge.trim(),
        p_password: staffAccountForm.password,
        p_full_name: staffAccountForm.full_name.trim(),
        p_role: staffAccountForm.role,
      });
      if (error) throw error;
      toast({
        title: "Compte créé",
        description: `${staffAccountForm.role.toUpperCase()} #${data} — badge ${staffAccountForm.badge.toUpperCase()}`,
      });
      setStaffAccountForm({ badge: "", password: "", full_name: "", role: staffAccountForm.role });
      queryClient.invalidateQueries({ queryKey: ["admin-couriers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Erreur création compte";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setCreatingStaff(false);
    }
  };
  const handleAdminScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeBarcode(adminScanCode);
    if (!code) return;
    const { data, error } = await (supabase as any).rpc("lookup_variant_by_barcode", { p_barcode: code });
    if (error || !data?.[0]) {
      toast({ title: "Code introuvable", variant: "destructive" });
      return;
    }
    const row = data[0];
    setAdminScanCart((prev) => {
      const existing = prev.find((l) => l.variant_id === Number(row.variant_id));
      if (existing) {
        return prev.map((l) => l.variant_id === Number(row.variant_id) ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, {
        variant_id: Number(row.variant_id),
        product_id: Number(row.product_id),
        product_name: row.product_name,
        color: row.color,
        size: row.size,
        unit_price: Number(row.unit_price),
        quantity: 1,
      }];
    });
    setAdminScanCode("");
  };
  const handleAdminScanSale = async () => {
    if (adminScanCart.length === 0) return;
    const items = adminScanCart.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
      size: l.size,
      color: l.color,
    }));
    const { data, error } = await (supabase as any).rpc("create_manual_order_admin", {
      _customer_name: "Vente physique admin",
      _customer_phone: null,
      _delivery_address: null,
      _delivery_fee: 0,
      _items: items,
      _order_source: "pos",
      _notes: "Scan admin dashboard",
      _status: "traitée",
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vente enregistrée", description: `Commande #${data}` });
    setAdminScanCart([]);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    queryClient.invalidateQueries({ queryKey: ["admin-order-items"] });
    queryClient.invalidateQueries({ queryKey: ["admin-variants"] });
  };
  const handleAssignCourier = async (orderId: number, courierId: string) => {
    const value = courierId === "__none__" ? null : Number(courierId);
    const { error } = await (supabase as any).from("orders").update({ courier_id: value }).eq("id", orderId);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const handleOrderSource = async (orderId: number, source: string) => {
    const { error } = await (supabase as any).from("orders").update({ order_source: source }).eq("id", orderId);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const handleUpdateUnitCost = async (productId: number, unitCost: number) => {
    const { error } = await (supabase as any).from("products").update({ unit_cost: unitCost }).eq("id", productId);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Coût unitaire mis à jour" });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };
  const handleCreateManualOrder = async () => {
    if (manualLines.length === 0) return;
    const payloadItems = manualLines
      .map((line) => {
        const productId = Number(line.productId);
        const product = (products || []).find((p) => Number(p.id) === productId);
        if (!product) return null;
        return {
          product_id: productId,
          quantity: Number(line.quantity || 0),
          unit_price: Number(product.price || 0),
        };
      })
      .filter((v): v is { product_id: number; quantity: number; unit_price: number } => !!v && v.quantity > 0);
    if (payloadItems.length === 0) {
      toast({ title: "Articles requis", description: "Ajoutez au moins un article valide.", variant: "destructive" });
      return;
    }
    const { data, error } = await (supabase as any).rpc("create_manual_order_admin", {
      _customer_name: manualOrder.customer_name || "Client POS",
      _customer_phone: manualOrder.customer_phone || null,
      _delivery_address: manualOrder.delivery_address || null,
      _delivery_fee: Number(manualOrder.delivery_fee || 0),
      _items: payloadItems,
      _order_source: manualOrder.order_source,
      _notes: manualOrder.notes || null,
      _status: "traitée",
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Commande créée", description: `Commande #${data}` });
    setManualOrder({
      customer_name: "",
      customer_phone: "",
      delivery_address: "",
      delivery_fee: "0",
      order_source: "manual",
      notes: "",
    });
    setManualLines([{ productId: "", quantity: "1" }]);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    queryClient.invalidateQueries({ queryKey: ["admin-order-items"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const handleCreateTrackingForAmbassador = async (app: any) => {
    if (!app?.user_id) {
      toast({ title: "Compte non lié", description: "Cet ambassadeur n'a pas encore de compte utilisateur.", variant: "destructive" });
      return;
    }
    const raw = (app.username || app.full_name || "VSM").toString().replace(/^@/, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const slug = `${raw || "VSM"}${Math.floor(100 + Math.random() * 900)}`;
    const { error } = await supabase.from("ambassador_links").insert({
      ambassador_id: app.user_id,
      slug,
      target_type: "shop",
      active: true,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lien tracking créé", description: `Slug: ${slug}` });
  };

  if (authLoading || rolesLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Accès refusé</h1>
          <p className="mt-2 text-muted-foreground">Vous devez être administrateur.</p>
          <Link to="/"><Button variant="hero" className="mt-4">Retour</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell flex min-h-screen bg-background font-body">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[min(16rem,88vw)] transform border-r border-border bg-card transition-transform duration-300 lg:static lg:max-w-none lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex min-h-16 items-start justify-between gap-2 border-b border-border px-4 py-3">
          <VsmBrandMark subtitle="Administration" compact />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="shrink-0 rounded-md p-2 hover:bg-secondary lg:hidden"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-sm px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  <item.icon className="h-5 w-5" />
                  {item.label}
                  {item.id === "ambassadors" && pendingApps > 0 && <Badge variant="destructive" className="ml-auto text-[10px]">{pendingApps}</Badge>}
                  {item.id === "orders" && pendingOrders.length > 0 && <Badge variant="destructive" className="ml-auto text-[10px]">{pendingOrders.length}</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 space-y-2 border-t border-border p-4">
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" onClick={() => navigate("/")}>
            <Eye className="h-5 w-5" />Voir le site
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => { signOut(); navigate("/"); }}>
            <LogOut className="h-5 w-5" />Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/90 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="shrink-0 rounded-lg p-2 hover:bg-muted lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg font-semibold uppercase tracking-wide md:text-xl">
                {menuItems.find((m) => m.id === activeTab)?.label || "Admin"}
              </h1>
            </div>
            <div className="hidden max-w-[220px] truncate rounded-full border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground sm:block" title={user?.email ?? undefined}>
              {user?.email}
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          {/* ============ DASHBOARD (PRO) ============ */}
          {activeTab === "dashboard" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { icon: DollarSign, label: "Chiffre d'affaires", value: formatPrice(totalSales), hint: `${formatPrice(monthRevenue)} ce mois`, badge: "Confirmées" },
                  { icon: ShoppingCart, label: "Commandes", value: String(totalOrders), hint: `${pendingOrders.length} en attente`, badge: pendingOrders.length > 0 ? `${pendingOrders.length} à traiter` : undefined, alert: pendingOrders.length > 0 },
                  { icon: Package, label: "Unités vendues", value: String(soldUnits), hint: `${inventoryUnits} en stock`, badge: (lowStockProducts.length + lowStockVariants.length) > 0 ? "Stock bas" : undefined, alert: (lowStockProducts.length + lowStockVariants.length) > 0 },
                  { icon: Users, label: "Clients", value: String(totalClients), hint: `${pendingApps} candidature(s) amb.`, badge: pendingApps > 0 ? `${pendingApps} demandes` : undefined, alert: pendingApps > 0 },
                ].map((kpi) => (
                  <div key={kpi.label} className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card to-secondary/20 p-5 shadow-sm">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/70 via-primary/30 to-transparent" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="rounded-lg bg-primary/10 p-2.5">
                        <kpi.icon className="h-5 w-5 text-primary" />
                      </div>
                      {kpi.badge && (
                        <Badge variant={kpi.alert ? "destructive" : "secondary"} className="text-[10px]">{kpi.badge}</Badge>
                      )}
                    </div>
                    <p className="mt-4 font-display text-2xl font-bold tracking-tight">{kpi.value}</p>
                    <p className="mt-1 text-sm font-medium text-foreground/90">{kpi.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{kpi.hint}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/60 px-5 py-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Panier moyen</p>
                    <p className="mt-1 font-display text-xl font-bold text-primary">{formatPrice(avgBasket)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{confirmedOrders.length} cmd. confirmées</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/60 px-5 py-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aujourd'hui</p>
                    <p className="mt-1 font-display text-xl font-bold text-primary">{formatPrice(todayRevenue)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Revenus confirmés</p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="rounded-xl border border-border/50 bg-card p-6 lg:col-span-3">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-display text-lg font-semibold">Revenus (14 jours)</h4>
                    <span className="text-xs text-muted-foreground">Confirmées uniquement</span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={(() => {
                          const days = 14;
                          const now = new Date();
                          const byDay = new Map<string, number>();
                          confirmedOrders.forEach((o: any) => {
                            if (!o.created_at) return;
                            const d = new Date(o.created_at);
                            const key = d.toISOString().slice(0, 10);
                            byDay.set(key, (byDay.get(key) || 0) + getMerchandiseAmount(o));
                          });
                          const out: { day: string; value: number }[] = [];
                          for (let i = days - 1; i >= 0; i--) {
                            const d = new Date(now);
                            d.setDate(now.getDate() - i);
                            const key = d.toISOString().slice(0, 10);
                            out.push({
                              day: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
                              value: byDay.get(key) || 0,
                            });
                          }
                          return out;
                        })()}
                        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                      >
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <RechartsTooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                          }}
                          formatter={(v: any) => [formatPrice(Number(v)), "Revenus"]}
                        />
                        <Area type="monotone" dataKey="value" stroke="#E11D48" fill="#E11D48" fillOpacity={0.15} />
                      </AreaChart>
                    </ResponsiveContainer>
                        </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-card p-6 lg:col-span-2">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-display text-lg font-semibold">Statuts commandes</h4>
                    <span className="text-xs text-muted-foreground">Toutes</span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(() => {
                            const counts: Record<string, number> = {};
                            allOrders.forEach((o: any) => {
                              counts[o.status] = (counts[o.status] || 0) + 1;
                            });
                            return Object.entries(counts).map(([status, count]) => ({
                              name: ORDER_STATUSES[status]?.label || status,
                              status,
                              value: count,
                            }));
                          })()}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {(() => {
                            const counts: Record<string, number> = {};
                            allOrders.forEach((o: any) => { counts[o.status] = (counts[o.status] || 0) + 1; });
                            return Object.keys(counts);
                          })().map((status) => (
                            <Cell key={status} fill={PRO_STATUS_COLORS[status] || "#64748B"} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    </div>
                  <div className="mt-4 grid gap-2">
                    {(["nouvelle", "traitée", "expédiée", "annulée"] as const).map((s) => {
                      const count = allOrders.filter((o: any) => o.status === s).length;
                      return (
                        <div key={s} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRO_STATUS_COLORS[s] }} />
                            <span className="text-muted-foreground">{ORDER_STATUSES[s].label}</span>
                          </div>
                          <span className="font-medium">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <div className="rounded-xl border border-border/50 bg-card p-6 lg:col-span-3">
                <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-display text-lg font-semibold">Top produits (unités)</h4>
                    <span className="text-xs text-muted-foreground">Confirmées</span>
                </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topSellingProducts.map((p) => ({ name: p.name, qty: p.qty }))} margin={{ left: 0, right: 10 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-15} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <RechartsTooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                          }}
                        />
                        <Bar dataKey="qty" fill="#E11D48" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-card p-6 lg:col-span-2">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-display text-lg font-semibold">À traiter maintenant</h4>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab("orders")}>Voir</Button>
                  </div>
                  {pendingOrders.length === 0 ? (
                    <div className="rounded-sm border border-border bg-secondary p-4 text-sm text-muted-foreground">
                      Aucune commande “nouvelle”. Bon travail.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingOrders.slice(0, 6).map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">#{o.id} • {(o as any).customer_name || "Client"}</p>
                            <p className="text-xs text-muted-foreground">{o.created_at ? formatDate(o.created_at) : ""}</p>
                          </div>
                          <div className="ml-3 flex items-center gap-2 text-right">
                            <p className="text-sm font-semibold text-primary">{formatPrice(getMerchandiseAmount(o))}</p>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ORDER_STATUSES.nouvelle.color}`}>
                              {ORDER_STATUSES.nouvelle.label}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleOrderStatus(o.id, "traitée")}
                            >
                              Marquer traitée
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                  {(lowStockProducts.length > 0 || lowStockVariants.length > 0) && (
                    <div className="mt-4 rounded-sm border border-yellow-500/40 bg-yellow-500/10 p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <p className="text-sm font-medium">Alertes stock</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lowStockProducts.length} produit(s) faible stock • {lowStockVariants.length} variante(s) critiques
                      </p>
                      <Button variant="ghost" size="sm" className="mt-3" onClick={() => setActiveTab("products")}>
                        Aller aux produits
                </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ============ PRODUCTS ============ */}
          {activeTab === "products" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" onClick={() => setEditProduct(null)}><Plus className="h-4 w-4" />Ajouter</Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] max-w-[min(100vw-2rem,42rem)] overflow-y-auto lg:max-w-4xl">
                    <DialogHeader><DialogTitle className="font-display text-xl uppercase tracking-wide">{editProduct ? "Modifier le produit" : "Nouveau produit"}</DialogTitle></DialogHeader>
                    <ProductForm product={editProduct} onClose={() => setShowProductForm(false)} />
                  </DialogContent>
                </Dialog>
              </div>
              {productsLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (products || []).length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">Aucun produit. Ajoutez-en un!</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {(products || []).map((product) => (
                    <div key={product.id} className="group vsm-card overflow-hidden">
                      <div className="relative aspect-[4/5] bg-secondary">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Image className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                        <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${product.is_active ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"}`}>
                          {product.is_active ? "Actif" : "Inactif"}
                        </span>
                        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-background/90 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                          <button type="button" className="rounded-sm bg-card p-2 shadow" onClick={() => { setEditProduct(product); setShowProductForm(true); }}>
                            <Edit className="h-4 w-4" />
                          </button>
                          <button type="button" className="rounded-sm bg-card p-2 shadow" onClick={async () => {
                            if (confirm("Supprimer ce produit ?")) {
                              try { await deleteProduct.mutateAsync(product.id); toast({ title: "Produit supprimé" }); } catch (err: any) { toast({ title: "Erreur", description: err.message, variant: "destructive" }); }
                            }
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1 p-4">
                        <p className="font-display text-sm font-bold uppercase leading-tight">{product.name}</p>
                        <p className="text-xs capitalize text-muted-foreground">{product.category || "—"}</p>
                        <div className="flex items-center justify-between pt-2">
                          <span className="font-display text-lg font-bold text-primary">
                            {product.price ? formatPrice(Number(product.price)) : "—"}
                          </span>
                          <span className={`text-xs font-medium ${(product.stock ?? 0) <= 5 ? "text-red-500" : "text-muted-foreground"}`}>
                            Stock {product.stock ?? 0}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            defaultValue={String(Number((product as any).unit_cost || 0))}
                            className="h-8 text-xs"
                            id={`unit-cost-${product.id}`}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => {
                              const el = document.getElementById(`unit-cost-${product.id}`) as HTMLInputElement | null;
                              const value = Number(el?.value || 0);
                              handleUpdateUnitCost(Number(product.id), value);
                            }}
                          >
                            Coût u.
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ============ ORDERS ============ */}
          {activeTab === "orders" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {Object.entries(ORDER_STATUSES).map(([key, val]) => {
                  const count = allOrders.filter(o => o.status === key).length;
                  return count > 0 ? <Badge key={key} variant="secondary" className="gap-1">{val.label} <span className="font-bold">{count}</span></Badge> : null;
                })}
              </div>
              <div className="vsm-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border bg-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Client</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Adresse</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Articles</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Détails</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allOrders.map((order) => {
                        const statusInfo = ORDER_STATUSES[order.status] || ORDER_STATUSES.nouvelle;
                        const isExpanded = expandedOrder === order.id;
                        const currentOrderItems = orderItemsByOrder[order.id] || [];

                        return (
                          <>
                            <tr key={order.id} className="border-b border-border last:border-0">
                              <td className="px-4 py-4 font-medium">#{order.id}</td>
                              <td className="px-4 py-4">
                                <div>
                                  <p className="font-medium">{(order as any).customer_name || "—"}</p>
                                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{(order as any).customer_phone || "—"}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{(order as any).delivery_address || "—"}</div>
                              </td>
                              <td className="px-4 py-4 font-semibold text-primary">
                                <div>{formatPrice(getMerchandiseAmount(order))}</div>
                                {Number((order as any).delivery_fee || 0) > 0 && (
                                  <p className="text-xs font-normal text-muted-foreground">
                                    + {formatPrice(Number((order as any).delivery_fee))} livr. · {formatPrice(getCustomerPayableTotal(order))} client
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <Select value={order.status} onValueChange={(v) => handleOrderStatus(order.id, v)}>
                                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(ORDER_STATUSES).map(([key, val]) => <SelectItem key={key} value={key}>{val.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-4 py-4 text-sm text-muted-foreground">{order.created_at ? formatDate(order.created_at) : "—"}</td>
                              <td className="px-4 py-4 text-right">
                                <Button variant="ghost" size="sm" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${order.id}-detail`}>
                                <td colSpan={7} className="bg-secondary/50 px-4 py-4">
                                  <div className="space-y-3">
                                    <h4 className="text-sm font-semibold">Articles de la commande</h4>
                                    {currentOrderItems.length > 0 ? (
                                      <div className="space-y-2">
                                        {currentOrderItems.map((item: any) => (
                                          <div key={item.id} className="flex items-center justify-between rounded-sm border border-border bg-background px-3 py-2">
                                            <div>
                                              <span className="font-medium">{item.product_name}</span>
                                              {item.color && <span className="ml-2 text-xs text-muted-foreground">Couleur: {item.color}</span>}
                                              {item.size && <span className="ml-2 text-xs text-muted-foreground">Taille: {item.size}</span>}
                                            </div>
                                            <div className="text-right">
                                              <span className="text-sm">x{item.quantity}</span>
                                              <span className="ml-3 font-semibold text-primary">{formatPrice(Number(item.unit_price) * item.quantity)}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">Aucun article trouvé.</p>
                                    )}
                                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                                      <div className="text-muted-foreground">Source: {(order as any).order_source || "website"}</div>
                                      {(order as any).delivery_date && (
                                        <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" />Livraison: {(order as any).delivery_date}</div>
                                      )}
                                      {(order as any).delivery_fee > 0 && (
                                        <div className="text-muted-foreground">Frais livraison: {formatPrice(Number((order as any).delivery_fee))}</div>
                                      )}
                                      {(order as any).promo_discount > 0 && (
                                        <div className="text-muted-foreground">Réduction: -{formatPrice(Number((order as any).promo_discount))}</div>
                                      )}
                                    </div>
                                    {(order as any).notes && (
                                      <p className="text-sm text-muted-foreground">📝 {(order as any).notes}</p>
                                    )}
                                    <div className="rounded-sm border border-border bg-background p-3">
                                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ajuster frais de livraison</p>
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <Input
                                          type="number"
                                          min={0}
                                          className="sm:w-48"
                                          value={deliveryFeeDrafts[order.id] ?? String(Number((order as any).delivery_fee || 0))}
                                          onChange={(e) =>
                                            setDeliveryFeeDrafts((prev) => ({
                                              ...prev,
                                              [order.id]: e.target.value,
                                            }))
                                          }
                                        />
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleUpdateOrderDeliveryFee(order)}
                                        >
                                          Enregistrer
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                          Les frais de livraison ne modifient pas le montant articles comptabilisé.
                                        </span>
                                      </div>
                                    </div>
                                    <div className="grid gap-2 rounded-sm border border-border bg-background p-3 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source commande</p>
                                        <Select
                                          value={(order as any).order_source || "website"}
                                          onValueChange={(v) => handleOrderSource(order.id, v)}
                                        >
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="website">Website</SelectItem>
                                            <SelectItem value="pos">POS</SelectItem>
                                            <SelectItem value="manual">Manuelle</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Livreur assigné</p>
                                        <Select
                                          value={(order as any).courier_id ? String((order as any).courier_id) : "__none__"}
                                          onValueChange={(v) => handleAssignCourier(order.id, v)}
                                        >
                                          <SelectTrigger><SelectValue placeholder="Choisir un livreur" /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="__none__">Aucun</SelectItem>
                                            {(couriers || []).map((courier: any) => (
                                              <SelectItem key={courier.id} value={String(courier.id)}>
                                                {courier.full_name}{courier.phone ? ` (${courier.phone})` : ""}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                  {allOrders.length === 0 && <p className="py-8 text-center text-muted-foreground">Aucune commande.</p>}
                </div>
              </div>
            </motion.div>
          )}

          {/* ============ DELIVERY ============ */}
          {activeTab === "delivery" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h3 className="font-display text-xl font-bold">Zones de livraison (communes)</h3>
              <p className="text-sm text-muted-foreground">
                Cliquez sur <strong>Modifier</strong> pour changer le prix ou le nom d&apos;une commune. Les changements s&apos;appliquent au checkout.
              </p>

              <div className="vsm-card space-y-4 p-6">
                <p className="font-display text-sm font-semibold uppercase tracking-wider">Ajouter une commune</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Input placeholder="Commune (ex: Gombe)" value={dzForm.name} onChange={(e) => setDzForm({ ...dzForm, name: e.target.value })} />
                  <Input placeholder="Ville" value={dzForm.city} onChange={(e) => setDzForm({ ...dzForm, city: e.target.value })} />
                  <Input placeholder="Prix (FC)" type="number" min={0} value={dzForm.price} onChange={(e) => setDzForm({ ...dzForm, price: e.target.value })} />
                  <Select value={dzForm.zone_type} onValueChange={(v) => setDzForm({ ...dzForm, zone_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Zone" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proche">Proche</SelectItem>
                      <SelectItem value="moyenne">Moyenne</SelectItem>
                      <SelectItem value="eloignee">Éloignée</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="gap-2" onClick={handleCreateDZ}>
                    <Plus className="h-4 w-4" /> Ajouter
                  </Button>
                </div>
              </div>

              <Dialog open={!!editingDz} onOpenChange={(open) => !open && setEditingDz(null)}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Modifier la zone de livraison</DialogTitle>
                  </DialogHeader>
                  {editingDz && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Commune</label>
                        <Input
                          value={editingDz.name}
                          onChange={(e) => setEditingDz({ ...editingDz, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Ville</label>
                        <Input
                          value={editingDz.city}
                          onChange={(e) => setEditingDz({ ...editingDz, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Prix livraison (FC)</label>
                        <Input
                          type="number"
                          min={0}
                          value={editingDz.price}
                          onChange={(e) => setEditingDz({ ...editingDz, price: e.target.value })}
                          placeholder="Ex: 11000"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Type de zone</label>
                        <Select
                          value={editingDz.zone_type}
                          onValueChange={(v) => setEditingDz({ ...editingDz, zone_type: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="proche">Proche</SelectItem>
                            <SelectItem value="moyenne">Moyenne</SelectItem>
                            <SelectItem value="eloignee">Éloignée</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button className="flex-1 gap-2" disabled={savingDzId === editingDz.id} onClick={handleUpdateDZ}>
                          <Save className="h-4 w-4" />
                          {savingDzId === editingDz.id ? "Enregistrement…" : "Enregistrer les modifications"}
                        </Button>
                        <Button variant="outline" onClick={() => setEditingDz(null)}>Annuler</Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(deliveryZones || []).map((dz) => (
                  <div key={dz.id} className="vsm-card flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display font-bold">{dz.name}</p>
                        <p className="text-xs text-muted-foreground">{dz.city || "Kinshasa"}</p>
                      </div>
                      <Badge variant={dz.is_active ? "default" : "secondary"}>
                        {dz.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-sm border border-border bg-secondary/40 px-3 py-2">
                      <span className="text-sm text-muted-foreground">Prix livraison</span>
                      <span className="font-display text-lg font-bold text-primary">
                        {formatPrice(Number(dz.price || 0))}
                      </span>
                    </div>
                    {(dz as any).zone_type && (
                      <p className="text-xs capitalize text-muted-foreground">Zone {(dz as any).zone_type}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => openEditDZ(dz)}>
                        <Edit className="h-3.5 w-3.5" /> Modifier
                      </Button>
                      <div className="flex items-center gap-2 text-sm">
                        <Switch checked={dz.is_active} onCheckedChange={(v) => handleToggleDZ(dz.id, v)} />
                        <span className="text-muted-foreground">Actif</span>
                      </div>
                      <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => handleDeleteDZ(dz.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {(deliveryZones || []).length === 0 && (
                <p className="py-8 text-center text-muted-foreground">Aucune zone. Ajoutez une commune ci-dessus.</p>
              )}
            </motion.div>
          )}

          {/* ============ PROMOS ============ */}
          {activeTab === "promos" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold">Codes Promo</h3>
                <Dialog open={showPromoForm} onOpenChange={setShowPromoForm}>
                  <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Nouveau code</Button></DialogTrigger>
                  <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Créer un code promo</DialogTitle></DialogHeader><PromoForm ambassadors={approvedAmbassadors} defaultAmbassadorId={promoDefaultAmbassadorId} onClose={() => { setShowPromoForm(false); setPromoDefaultAmbassadorId(undefined); }} /></DialogContent>
                </Dialog>
              </div>
              <div className="vsm-card overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-border bg-secondary"><tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Réduction</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Utilisations</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actif</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                  </tr></thead>
                  <tbody>
                    {(promoCodes || []).map((promo) => (
                      <tr key={promo.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-4 font-medium text-primary">{promo.code}</td>
                        <td className="px-4 py-4">{promo.discount_type === "percent" ? `${promo.discount_value}%` : formatPrice(Number(promo.discount_value))}</td>
                        <td className="px-4 py-4">{promo.usage_count}{promo.max_usage ? `/${promo.max_usage}` : ""}</td>
                        <td className="px-4 py-4"><Badge variant={promo.is_global ? "default" : "secondary"}>{promo.is_global ? "Global" : "Ambassadeur"}</Badge></td>
                        <td className="px-4 py-4"><Switch checked={promo.active} onCheckedChange={(v) => handleTogglePromo(promo.id, v)} /></td>
                        <td className="px-4 py-4 text-right"><button className="rounded-sm p-2 hover:bg-destructive/20" onClick={() => handleDeletePromo(promo.id)}><Trash2 className="h-4 w-4 text-destructive" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(promoCodes || []).length === 0 && <p className="py-8 text-center text-muted-foreground">Aucun code promo.</p>}
              </div>
            </motion.div>
          )}

          {/* ============ REVIEWS ============ */}
          {activeTab === "reviews" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="font-display text-xl font-bold">Avis clients publics</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Avis laissés sur les fiches produit — supprimez ceux à modérer.
                </p>
              </div>
              <div className="vsm-card overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-border bg-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Produit</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Client</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Note</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Commentaire</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(productReviews || []).map((review) => (
                      <tr key={review.id} className="border-b border-border last:border-0 align-top">
                        <td className="px-4 py-4 font-medium">{review.products?.name || `#${review.product_id}`}</td>
                        <td className="px-4 py-4">{review.client_name}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${i < review.rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="max-w-xs px-4 py-4 text-sm text-muted-foreground">
                          <p className="line-clamp-3">{review.comment || "—"}</p>
                          {review.image_url && (
                            <a
                              href={review.image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-xs text-primary hover:underline"
                            >
                              Voir la photo
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                          {review.created_at ? formatDate(review.created_at) : "—"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            className="rounded-sm p-2 hover:bg-destructive/20"
                            onClick={() => handleDeleteReview(review.id)}
                            aria-label="Supprimer l'avis"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(productReviews || []).length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">Aucun avis pour le moment.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ============ AMBASSADORS ============ */}
          {activeTab === "ambassadors" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="font-display text-xl font-bold">Candidatures Ambassadeurs</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cliquez sur une carte pour ouvrir la fiche complète et valider l&apos;inscription.
                </p>
              </div>
              {(ambassadorApps || []).length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">Aucune candidature.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {(ambassadorApps || []).map((app) => (
                    <div key={app.id} className="vsm-card flex flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-display text-lg font-bold">{app.full_name}</p>
                          <p className="text-sm text-primary">@{app.username}</p>
                        </div>
                        <Badge variant={app.status === "approved" ? "default" : app.status === "rejected" ? "destructive" : "secondary"}>
                          {app.status === "approved" ? "Approuvé" : app.status === "rejected" ? "Refusé" : "En attente"}
                        </Badge>
                      </div>
                      <p className="mt-3 truncate text-sm text-muted-foreground">{app.email || "—"}</p>
                      <p className="text-sm text-muted-foreground">{app.phone} · {app.main_platform}</p>
                      <div className="mt-5 flex flex-col gap-2">
                        <Button variant="hero" size="sm" className="w-full" asChild>
                          <Link to={`/admin/candidature/${app.id}`}>Ouvrir la fiche</Link>
                        </Button>
                        {app.user_id && app.status === "approved" && (
                          <Button variant="outline" size="sm" className="w-full" asChild>
                            <Link to={`/admin/ambassadeur/${app.user_id}`}>Suivi performance</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ============ RETRAITS AMBASSADEURS ============ */}
          {activeTab === "withdrawals" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl font-bold">Retraits Mobile Money</h3>
                <Badge variant="secondary">
                  {(withdrawalRequests || []).filter((w: { status: string }) => w.status === "pending").length} en attente
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Les ambassadeurs peuvent demander un retrait après 10 commandes confirmées. Vérifiez les ventes puis marquez payé ou refusé.
              </p>
              <div className="vsm-card overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-border bg-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Ambassadeur</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Opérateur</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Numéro</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Bénéficiaire</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(withdrawalRequests || []).map((w: Tables<"ambassador_withdrawal_requests">) => {
                      const prof = (clients || []).find((c) => c.id === w.ambassador_id);
                      const ambLabel = prof?.full_name || prof?.name || w.ambassador_id.slice(0, 8) + "…";
                      const opLabel =
                        w.mobile_operator === "airtel"
                          ? "Airtel"
                          : w.mobile_operator === "mpesa"
                            ? "M-Pesa"
                            : w.mobile_operator === "orange"
                              ? "Orange"
                              : w.mobile_operator;
                      return (
                        <tr key={w.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-4 font-medium">{w.id}</td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(w.created_at)}</td>
                          <td className="px-4 py-4 text-sm">{ambLabel}</td>
                          <td className="px-4 py-4 text-sm">{opLabel}</td>
                          <td className="px-4 py-4 font-mono text-sm">{w.msisdn}</td>
                          <td className="px-4 py-4 text-sm">{w.beneficiary_name}</td>
                          <td className="px-4 py-4">
                            <Select
                              value={w.status}
                              onValueChange={(v) => handleWithdrawalStatus(w.id, v)}
                              disabled={w.status === "paid" || w.status === "rejected"}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">En attente</SelectItem>
                                <SelectItem value="approved">Approuvée</SelectItem>
                                <SelectItem value="paid">Payée</SelectItem>
                                <SelectItem value="rejected">Refusée</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(withdrawalRequests || []).length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">Aucune demande de retrait.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ============ CLIENTS ============ */}
          {activeTab === "clients" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h3 className="font-display text-xl font-bold">Clients ({totalClients})</h3>
              <div className="vsm-card overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-border bg-secondary"><tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Nom</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Téléphone</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Rôle</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Inscription</th>
                  </tr></thead>
                  <tbody>
                    {(clients || []).map((client) => (
                      <tr key={client.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-4 font-medium">{client.full_name || client.name || "—"}</td>
                        <td className="px-4 py-4 text-muted-foreground">{client.email || "—"}</td>
                        <td className="px-4 py-4">{client.phone || "—"}</td>
                        <td className="px-4 py-4"><Badge variant="secondary">{client.role}</Badge></td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{client.created_at ? new Date(client.created_at).toLocaleDateString("fr-FR") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(clients || []).length === 0 && <p className="py-8 text-center text-muted-foreground">Aucun client.</p>}
              </div>
            </motion.div>
          )}

          {/* ============ OPERATIONS / POS ============ */}
          {activeTab === "operations" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="vsm-card p-5 xl:col-span-2">
                  <h3 className="font-display text-xl font-bold">Créer une commande manuelle / POS</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Utilisez cette section pour les ventes hors site et la caisse physique.</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Input
                      placeholder="Nom client"
                      value={manualOrder.customer_name}
                      onChange={(e) => setManualOrder((s) => ({ ...s, customer_name: e.target.value }))}
                    />
                    <Input
                      placeholder="Téléphone client"
                      value={manualOrder.customer_phone}
                      onChange={(e) => setManualOrder((s) => ({ ...s, customer_phone: e.target.value }))}
                    />
                    <Input
                      placeholder="Adresse livraison (optionnel)"
                      value={manualOrder.delivery_address}
                      onChange={(e) => setManualOrder((s) => ({ ...s, delivery_address: e.target.value }))}
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Frais livraison"
                      value={manualOrder.delivery_fee}
                      onChange={(e) => setManualOrder((s) => ({ ...s, delivery_fee: e.target.value }))}
                    />
                    <Select value={manualOrder.order_source} onValueChange={(v) => setManualOrder((s) => ({ ...s, order_source: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manuelle</SelectItem>
                        <SelectItem value="pos">POS</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Note interne"
                      value={manualOrder.notes}
                      onChange={(e) => setManualOrder((s) => ({ ...s, notes: e.target.value }))}
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    {manualLines.map((line, index) => (
                      <div key={index} className="grid gap-2 md:grid-cols-[1fr_120px_80px]">
                        <Select
                          value={line.productId || "__empty__"}
                          onValueChange={(v) =>
                            setManualLines((prev) => prev.map((row, i) => i === index ? { ...row, productId: v === "__empty__" ? "" : v } : row))
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Produit" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__empty__">Choisir un produit</SelectItem>
                            {(products || []).map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name} — {formatPrice(Number(p.price || 0))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) =>
                            setManualLines((prev) => prev.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setManualLines((prev) => prev.filter((_, i) => i !== index))}
                          disabled={manualLines.length === 1}
                        >
                          Suppr.
                        </Button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => setManualLines((prev) => [...prev, { productId: "", quantity: "1" }])}>
                        <Plus className="mr-2 h-4 w-4" />Ajouter ligne
                      </Button>
                      <Button type="button" onClick={handleCreateManualOrder}>
                        Enregistrer commande
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="vsm-card p-5">
                  <h4 className="font-display text-lg font-semibold">Comptes POS &amp; livreurs</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Badge + mot de passe pour accéder à /connexion</p>
                  <div className="mt-3 space-y-2">
                    <Input
                      placeholder="Nom du compte"
                      value={staffAccountForm.full_name}
                      onChange={(e) => setStaffAccountForm((s) => ({ ...s, full_name: e.target.value }))}
                    />
                    <Input
                      placeholder="Badge (ex: VSM1024)"
                      value={staffAccountForm.badge}
                      onChange={(e) => setStaffAccountForm((s) => ({ ...s, badge: e.target.value.toUpperCase() }))}
                      className="uppercase"
                    />
                    <Input
                      type="password"
                      placeholder="Mot de passe (min 6 car.)"
                      value={staffAccountForm.password}
                      onChange={(e) => setStaffAccountForm((s) => ({ ...s, password: e.target.value }))}
                    />
                    <Select
                      value={staffAccountForm.role}
                      onValueChange={(v) => setStaffAccountForm((s) => ({ ...s, role: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pos">Caisse POS</SelectItem>
                        <SelectItem value="courier">Livreur</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button className="w-full" disabled={creatingStaff} onClick={handleCreateStaffAccount}>
                      {creatingStaff ? "Création…" : "Créer le compte"}
                    </Button>
                  </div>
                  <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                    {(staffMembers || []).slice(0, 15).map((member: any) => (
                      <div key={member.id} className="rounded-sm border border-border p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{member.full_name}</p>
                          <Badge variant={member.role === "pos" ? "default" : "secondary"}>
                            {member.role === "pos" ? "POS" : "Livreur"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Badge {member.badge}</p>
                      </div>
                    ))}
                    {(staffMembers || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucun compte staff.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ============ STOCK & CODES ============ */}
          {activeTab === "inventory" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="vsm-card p-5 xl:col-span-2">
                  <h3 className="font-display text-xl font-bold">Codes-barres variantes</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Générés automatiquement (VSM + ID). Utilisables au POS et pour vente physique admin.
                  </p>
                  <div className="mt-4 max-h-[480px] overflow-auto rounded-sm border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2">Produit</th>
                          <th className="px-3 py-2">Variante</th>
                          <th className="px-3 py-2">Stock</th>
                          <th className="px-3 py-2">Code-barres</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {allVariants.map((variant: any) => {
                          const product = (products || []).find((p) => Number(p.id) === Number(variant.product_id));
                          const barcode = variant.barcode || `VSM${String(variant.id).padStart(10, "0")}`;
                          return (
                            <tr key={variant.id} className="border-b border-border/60">
                              <td className="px-3 py-2 font-medium">{product?.name || `#${variant.product_id}`}</td>
                              <td className="px-3 py-2 text-muted-foreground">{variant.color} / {variant.size}</td>
                              <td className="px-3 py-2">
                                <span className={Number(variant.stock) <= 3 ? "font-semibold text-red-500" : ""}>
                                  {variant.stock}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">{barcode}</td>
                              <td className="px-3 py-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => downloadBarcodeSvg(barcode, `barcode-${barcode}.svg`)}
                                >
                                  <Download className="h-3.5 w-3.5" /> SVG
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {allVariants.length === 0 && (
                      <p className="py-8 text-center text-muted-foreground">Aucune variante.</p>
                    )}
                  </div>
                </div>

                <div className="vsm-card space-y-4 p-5">
                  <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                    <ScanLine className="h-5 w-5 text-primary" /> Vente physique (scan)
                  </h3>
                  <form onSubmit={handleAdminScan} className="flex gap-2">
                    <Input
                      value={adminScanCode}
                      onChange={(e) => setAdminScanCode(e.target.value)}
                      placeholder="Scanner code-barres"
                    />
                    <Button type="submit">Ajouter</Button>
                  </form>
                  {adminScanCart.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Scannez un produit pour démarrer une vente.</p>
                  ) : (
                    <div className="space-y-2">
                      {adminScanCart.map((line) => (
                        <div key={line.variant_id} className="flex items-center justify-between rounded-sm border border-border p-2 text-sm">
                          <div>
                            <p className="font-medium">{line.product_name}</p>
                            <p className="text-xs text-muted-foreground">{line.color} / {line.size} · x{line.quantity}</p>
                          </div>
                          <span className="font-semibold">{formatPrice(line.unit_price * line.quantity)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t border-border pt-2 font-display font-bold">
                        <span>Total</span>
                        <span className="text-primary">
                          {formatPrice(adminScanCart.reduce((s, l) => s + l.unit_price * l.quantity, 0))}
                        </span>
                      </div>
                      <Button className="w-full" onClick={handleAdminScanSale}>Valider la vente</Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ============ FINANCE PRO ============ */}
          {activeTab === "finance" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="vsm-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">CA net (hors livraison)</p><p className="mt-2 font-display text-2xl font-bold text-primary">{formatPrice(totalSales)}</p></div>
                <div className="vsm-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">COGS (coût marchandises)</p><p className="mt-2 font-display text-2xl font-bold">{formatPrice(cogsAmount)}</p></div>
                <div className="vsm-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Dépenses</p><p className="mt-2 font-display text-2xl font-bold">{formatPrice(totalExpenses)}</p></div>
                <div className="vsm-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Profit brut estimé</p><p className={`mt-2 font-display text-2xl font-bold ${grossProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatPrice(grossProfit)}</p></div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="vsm-card p-5">
                  <h4 className="font-display text-lg font-semibold">Ajouter une dépense</h4>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Input placeholder="Intitulé" value={expenseForm.title} onChange={(e) => setExpenseForm((s) => ({ ...s, title: e.target.value }))} />
                    <Input placeholder="Catégorie (transport, pub...)" value={expenseForm.category} onChange={(e) => setExpenseForm((s) => ({ ...s, category: e.target.value }))} />
                    <Input type="number" min={0} placeholder="Montant" value={expenseForm.amount} onChange={(e) => setExpenseForm((s) => ({ ...s, amount: e.target.value }))} />
                    <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm((s) => ({ ...s, expense_date: e.target.value }))} />
                    <Input className="sm:col-span-2" placeholder="Note" value={expenseForm.notes} onChange={(e) => setExpenseForm((s) => ({ ...s, notes: e.target.value }))} />
                  </div>
                  <Button className="mt-3" onClick={handleCreateExpense}>Enregistrer dépense</Button>
                </div>
                <div className="vsm-card p-5">
                  <h4 className="font-display text-lg font-semibold">Dernières dépenses</h4>
                  <div className="mt-3 space-y-2">
                    {(expenses || []).slice(0, 12).map((exp: any) => (
                      <div key={exp.id} className="flex items-start justify-between rounded-sm border border-border p-2">
                        <div>
                          <p className="text-sm font-medium">{exp.title}</p>
                          <p className="text-xs text-muted-foreground">{exp.category} • {exp.expense_date}</p>
                        </div>
                        <p className="text-sm font-semibold">{formatPrice(Number(exp.amount || 0))}</p>
                      </div>
                    ))}
                    {(expenses || []).length === 0 && <p className="text-sm text-muted-foreground">Aucune dépense enregistrée.</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ============ HERO ============ */}
          {activeTab === "hero" && <HeroManager />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
