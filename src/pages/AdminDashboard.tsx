import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Package, Users, DollarSign, ShoppingCart, Plus, Edit, Trash2,
  LogOut, Menu, X, Tag, Truck, UserCheck, BarChart3, Save, Loader2, Check, XCircle, Image, Settings,
  AlertTriangle, Eye, TrendingUp, Calendar, Phone, MapPin, ChevronDown, ChevronUp,
  Link2, MousePointerClick, Copy,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tables } from "@/integrations/supabase/types";
import ImageUploader from "@/components/admin/ImageUploader";
import { VsmBrandMark } from "@/components/VsmBrandMark";
import MultiImageUploader from "@/components/admin/MultiImageUploader";
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
  { icon: Truck, label: "Livraison", id: "delivery" },
  { icon: Tag, label: "Promos", id: "promos" },
  { icon: UserCheck, label: "Ambassadeurs", id: "ambassadors" },
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
interface VariantRow { color: string; size: string; stock: number; }

const ProductForm = ({ product, onClose }: { product?: Tables<"products"> | null; onClose: () => void }) => {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const queryClient = useQueryClient();
  const existingImages = product?.images || (product?.image_url ? [product.image_url] : []);

  const [form, setForm] = useState({
    name: product?.name || "", description: product?.description || "",
    price: product?.price ? String(product.price) : "", category: product?.category || "",
    image_url: product?.image_url || "", images: existingImages as string[],
    sku: product?.sku || "", is_active: product?.is_active ?? true,
  });

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
            data.map((v: any) => ({ color: v.color, size: v.size, stock: v.stock }))
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
      stock: totalStock, sku: form.sku || null, is_active: form.is_active,
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
      await supabase.from("product_variants").delete().eq("product_id", productId);
      if (variants.length > 0) {
        const { error } = await supabase.from("product_variants").insert(
          variants.map(v => ({ product_id: productId, color: v.color, size: v.size, stock: v.stock }))
        );
        if (error) throw error;
      }
      toast({ title: product ? "Produit mis à jour" : "Produit créé" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><label className="text-sm font-medium">Nom *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="space-y-2"><label className="text-sm font-medium">SKU</label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">Prix (FC)</label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Catégorie</label>
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

/** Panneau latéral : vue globale d’un ambassadeur (tracking, promos, ventes, tendance). */
const AmbassadorAdminDetailSheet = ({
  application,
  open,
  onOpenChange,
  orders,
  promos,
}: {
  application: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Array<Record<string, unknown>>;
  promos: Array<Record<string, unknown>>;
}) => {
  const userId = application?.user_id ? String(application.user_id) : null;

  const { data: links, isLoading: linksLoading } = useQuery({
    queryKey: ["admin-ambassador-links-detail", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ambassador_links")
        .select("*")
        .eq("ambassador_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!userId,
  });

  const linkIds = useMemo(() => (links || []).map((l: { id: number }) => l.id), [links]);

  const { data: clicks } = useQuery({
    queryKey: ["admin-ambassador-clicks-detail", [...linkIds].sort((a, b) => a - b).join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ambassador_clicks")
        .select("id, link_id, clicked_at")
        .in("link_id", linkIds);
      if (error) throw error;
      return data || [];
    },
    enabled: open && linkIds.length > 0,
  });

  const ambassadorOrders = useMemo(
    () => (userId ? orders.filter((o) => String(o.ambassador_id) === userId) : []),
    [orders, userId]
  );

  const ambassadorPromos = useMemo(
    () => (userId ? promos.filter((p) => p.ambassador_id != null && String(p.ambassador_id) === userId) : []),
    [promos, userId]
  );

  const confirmedStatuses = ["traitée", "expédiée"];
  const confirmedAmbOrders = ambassadorOrders.filter((o) => confirmedStatuses.includes(String(o.status)));
  const caAmb = confirmedAmbOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalClicks = (clicks || []).length;

  const clicksByLinkId = useMemo(() => {
    const m = new Map<number, number>();
    (clicks || []).forEach((c: { link_id: number }) => {
      m.set(c.link_id, (m.get(c.link_id) || 0) + 1);
    });
    return m;
  }, [clicks]);

  const evolutionData = useMemo(() => {
    const byMonth = new Map<string, { month: string; ca: number; orders: number }>();
    ambassadorOrders.forEach((o) => {
      if (!o.created_at || !confirmedStatuses.includes(String(o.status))) return;
      const d = new Date(String(o.created_at));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const cur = byMonth.get(key) || { month: label, ca: 0, orders: 0 };
      cur.ca += Number(o.total_amount || 0);
      cur.orders += 1;
      byMonth.set(key, cur);
    });
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [ambassadorOrders]);

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast({ title: "Copié" });
  };

  if (!application) return null;

  const fullName = String(application.full_name ?? "—");
  const username = application.username ? `@${String(application.username).replace(/^@/, "")}` : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-border sm:max-w-xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="border-b border-border pb-4 text-left">
          <SheetTitle className="font-display text-xl">Fiche ambassadeur</SheetTitle>
          <SheetDescription>
            Suivi des performances, liens de tracking et commandes attribuées.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-10">
          <div className="rounded-lg border border-border bg-card/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">{fullName}</p>
                <p className="text-sm text-primary">{username}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {application.phone != null && String(application.phone) && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {String(application.phone)}
                    </span>
                  )}
                  {(application.main_platform != null && String(application.main_platform)) && (
                    <span>Réseau : {String(application.main_platform)}</span>
                  )}
                </div>
              </div>
              <Badge variant={application.status === "approved" ? "default" : application.status === "rejected" ? "destructive" : "secondary"}>
                {application.status === "approved" ? "Approuvé" : application.status === "rejected" ? "Refusé" : "En attente"}
              </Badge>
            </div>
            {!userId && (
              <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
                Aucun compte utilisateur lié — statistiques de ventes et tracking complets après rattachement à la validation.
              </p>
            )}
          </div>

          {userId && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Clics</p>
                  <p className="font-display text-lg font-bold">{totalClicks}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Commandes</p>
                  <p className="font-display text-lg font-bold">{ambassadorOrders.length}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CA confirmé</p>
                  <p className="font-display text-lg font-bold text-primary">{formatPrice(caAmb)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Conv. (approx.)</p>
                  <p className="font-display text-lg font-bold">
                    {totalClicks > 0 ? `${((confirmedAmbOrders.length / totalClicks) * 100).toFixed(1)} %` : "—"}
                  </p>
                </div>
              </div>

              {evolutionData.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <p className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Évolution du CA (confirmé)
                  </p>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={evolutionData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip formatter={(v: number) => [formatPrice(v), "CA"]} />
                        <Area type="monotone" dataKey="ca" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 font-display text-sm font-semibold uppercase tracking-wider">Liens de tracking</p>
                {linksLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (links || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun lien.</p>
                ) : (
                  <div className="space-y-2">
                    {(links as Array<Record<string, unknown>>).map((link) => {
                      const slug = String(link.slug);
                      const url = `${window.location.origin}/a/${slug}`;
                      const cid = Number(link.id);
                      const n = clicksByLinkId.get(cid) ?? 0;
                      return (
                        <div key={cid} className="flex flex-col gap-2 rounded-md border border-border bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Link2 className="h-4 w-4 shrink-0 text-primary" />
                              <span className="truncate">/a/{slug}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MousePointerClick className="h-3.5 w-3.5" />
                                {n} clic{n !== 1 ? "s" : ""}
                              </span>
                              <Badge variant="outline" className="text-[10px]">{String(link.target_type)}</Badge>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1" onClick={() => copyText(url)}>
                            <Copy className="h-4 w-4" />
                            Copier
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 font-display text-sm font-semibold uppercase tracking-wider">Codes promo dédiés</p>
                {ambassadorPromos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun code rattaché.</p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/60">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Code</th>
                          <th className="px-3 py-2 text-left font-medium">Réduction</th>
                          <th className="px-3 py-2 text-left font-medium">Util.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ambassadorPromos.map((p) => (
                          <tr key={String(p.id)} className="border-t border-border">
                            <td className="px-3 py-2 font-medium text-primary">{String(p.code)}</td>
                            <td className="px-3 py-2">
                              {String(p.discount_type) === "percent" ? `${p.discount_value}%` : formatPrice(Number(p.discount_value))}
                            </td>
                            <td className="px-3 py-2">{String(p.usage_count ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 font-display text-sm font-semibold uppercase tracking-wider">Commandes attribuées</p>
                {ambassadorOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune commande pour cet ambassadeur.</p>
                ) : (
                  <div className="max-h-60 overflow-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-secondary/80">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">ID</th>
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-left font-medium">Statut</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ambassadorOrders.map((o) => (
                          <tr key={String(o.id)} className="border-t border-border">
                            <td className="px-3 py-2">#{String(o.id)}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {o.created_at ? formatDate(String(o.created_at)) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-[10px]">{String(o.status)}</Badge>
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{formatPrice(Number(o.total_amount || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
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
  const [ambassadorSheetApp, setAmbassadorSheetApp] = useState<Record<string, unknown> | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
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
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 15000,
  });

  const { data: allOrderItems } = useQuery({
    queryKey: ["admin-order-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("*");
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

  const pendingOrders = allOrders.filter((o) => o.status === "nouvelle");
  const totalSales = confirmedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalOrders = allOrders.length;
  const totalProducts = (products || []).length;
  const totalClients = (clients || []).length;
  const pendingApps = (ambassadorApps || []).filter((a) => a.status === "pending").length;
  const soldUnits = confirmedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const inventoryUnits = allVariants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);

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
  const monthRevenue = thisMonth.reduce((s, o) => s + Number(o.total_amount), 0);

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

  const stats = [
    {
      label: "Revenus",
      value: formatPrice(totalSales),
      sub: `${formatPrice(monthRevenue)} ce mois`,
      icon: DollarSign,
      color: "text-primary",
    },
    {
      label: "Commandes",
      value: totalOrders,
      sub: `${pendingOrders.length} en attente`,
      icon: ShoppingCart,
      color: "text-primary",
    },
    {
      label: "Articles vendus",
      value: soldUnits,
      sub: `${inventoryUnits} restants`,
      icon: Package,
      color: "text-primary",
    },
    {
      label: "Clients",
      value: totalClients,
      sub: `${pendingApps} demandes ambassadeur`,
      icon: Users,
      color: "text-primary",
    },
  ];

  // Handlers
  const [dzForm, setDzForm] = useState({ name: "", city: "", price: "" });
  const handleCreateDZ = async () => {
    if (!dzForm.name) return;
    const { error } = await supabase.from("delivery_zones").insert({ name: dzForm.name, city: dzForm.city || null, price: dzForm.price ? Number(dzForm.price) : null });
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Zone créée" }); setDzForm({ name: "", city: "", price: "" });
    queryClient.invalidateQueries({ queryKey: ["admin-delivery"] });
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
  const handleToggleDZ = async (id: number, is_active: boolean) => {
    await supabase.from("delivery_zones").update({ is_active }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-delivery"] });
  };
  const handleDeleteDZ = async (id: number) => {
    if (!confirm("Supprimer cette zone ?")) return;
    await supabase.from("delivery_zones").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-delivery"] });
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
    <div className="flex min-h-screen bg-background">
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
                  className={`flex w-full items-center gap-3 rounded-sm px-4 py-3 text-sm font-medium transition-colors ${activeTab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
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
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 shadow-sm backdrop-blur-sm">
          <div className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:min-h-16 sm:gap-x-4 sm:px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="shrink-0 rounded-md p-2 hover:bg-muted lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <VsmBrandMark subtitle="Administration" compact className="lg:hidden" />
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="font-display text-[10px] uppercase tracking-[0.28em] text-primary">Module</p>
              <h2 className="font-display truncate text-lg font-semibold capitalize md:text-xl">
                {menuItems.find((m) => m.id === activeTab)?.label || activeTab}
              </h2>
            </div>
            <div className="min-w-0 flex-1 lg:hidden">
              <p className="font-display text-[9px] uppercase tracking-[0.28em] text-primary">Section</p>
              <h2 className="font-display truncate text-base font-semibold capitalize">
                {menuItems.find((m) => m.id === activeTab)?.label || activeTab}
              </h2>
            </div>
            <span
              className="w-full max-w-full truncate text-right text-[11px] text-muted-foreground sm:ml-auto sm:w-auto sm:max-w-[min(14rem,40vw)] sm:text-sm lg:max-w-xs"
              title={user?.email ?? undefined}
            >
              {user?.email}
            </span>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          {/* ============ DASHBOARD (PRO) ============ */}
          {activeTab === "dashboard" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">
                    Dashboard
                  </p>
                  <h3 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight">
                    Pilotage & exécution
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Synthèse des ventes, commandes et stock — mise à jour automatique.
                  </p>
                    </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => { setEditProduct(null); setShowProductForm(true); setActiveTab("products"); }}>
                    <Plus className="h-4 w-4" /> Nouveau produit
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => { setShowPromoForm(true); setActiveTab("promos"); }}>
                    <Tag className="h-4 w-4" /> Nouvelle promo
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => setActiveTab("orders")}>
                    <ShoppingCart className="h-4 w-4" /> Gérer commandes
                  </Button>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <DollarSign className="h-8 w-8 text-primary" />
                    <Badge variant="secondary">Confirmées</Badge>
                  </div>
                  <p className="mt-4 font-display text-2xl font-bold">{formatPrice(totalSales)}</p>
                  <p className="text-sm text-muted-foreground">Chiffre d’affaires total</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatPrice(monthRevenue)} ce mois</p>
                        </div>
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <ShoppingCart className="h-8 w-8 text-primary" />
                    {pendingOrders.length > 0 ? (
                      <Badge variant="destructive">{pendingOrders.length} à traiter</Badge>
                    ) : (
                      <Badge variant="secondary">R.A.S</Badge>
                    )}
                      </div>
                  <p className="mt-4 font-display text-2xl font-bold">{totalOrders}</p>
                  <p className="text-sm text-muted-foreground">Commandes totales</p>
                  <p className="mt-1 text-xs text-muted-foreground">{pendingOrders.length} nouvelles</p>
                  </div>
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <Package className="h-8 w-8 text-primary" />
                    {(lowStockProducts.length > 0 || lowStockVariants.length > 0) ? (
                      <Badge variant="destructive">Alertes</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </div>
                  <p className="mt-4 font-display text-2xl font-bold">{soldUnits}</p>
                  <p className="text-sm text-muted-foreground">Articles vendus</p>
                  <p className="mt-1 text-xs text-muted-foreground">{inventoryUnits} en inventaire</p>
                </div>
                <div className="vsm-card p-6">
                  <div className="flex items-center justify-between">
                    <Users className="h-8 w-8 text-primary" />
                    {pendingApps > 0 ? (
                      <Badge variant="destructive">{pendingApps} demandes</Badge>
                    ) : (
                      <Badge variant="secondary">—</Badge>
                    )}
                          </div>
                  <p className="mt-4 font-display text-2xl font-bold">{totalClients}</p>
                  <p className="text-sm text-muted-foreground">Clients</p>
                  <p className="mt-1 text-xs text-muted-foreground">Candidatures: {pendingApps}</p>
                        </div>
                    </div>

              {/* Extra KPIs */}
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="vsm-card p-6">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Panier moyen (confirmées)
                    </h4>
                  </div>
                  <p className="font-display text-2xl font-bold text-primary">
                    {formatPrice(
                      confirmedOrders.length > 0
                        ? Math.floor(totalSales / confirmedOrders.length)
                        : 0
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Basé sur {confirmedOrders.length} commandes confirmées
                  </p>
                </div>
                <div className="vsm-card p-6">
                  <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Revenus aujourd’hui (confirmées)
                  </h4>
                  <p className="mt-1 font-display text-2xl font-bold text-primary">
                    {formatPrice(
                      confirmedOrders
                        .filter((o: any) => {
                          if (!o.created_at) return false;
                          const d = new Date(o.created_at);
                          const n = new Date();
                          return d.toDateString() === n.toDateString();
                        })
                        .reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0)
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Objectif: traiter & expédier rapidement
                  </p>
                </div>
                <div className="vsm-card p-6">
                  <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions rapides
                  </h4>
                  <div className="mt-4 grid gap-2">
                    <Button variant="outline" className="justify-start gap-2" onClick={() => setActiveTab("ambassadors")}>
                      <UserCheck className="h-4 w-4 text-primary" />
                      Valider des ambassadeurs
                    </Button>
                    <Button variant="outline" className="justify-start gap-2" onClick={() => setActiveTab("delivery")}>
                      <Truck className="h-4 w-4 text-primary" />
                      Gérer livraison
                    </Button>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="vsm-card p-6 lg:col-span-3">
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
                            byDay.set(key, (byDay.get(key) || 0) + Number(o.total_amount || 0));
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

                <div className="vsm-card p-6 lg:col-span-2">
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
                <div className="vsm-card p-6 lg:col-span-3">
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

                <div className="vsm-card p-6 lg:col-span-2">
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
                            <p className="text-sm font-semibold text-primary">{formatPrice(Number(o.total_amount || 0))}</p>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold">Gestion des produits</h3>
                <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" onClick={() => setEditProduct(null)}><Plus className="h-4 w-4" />Ajouter</Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <DialogHeader><DialogTitle>{editProduct ? "Modifier le produit" : "Nouveau produit"}</DialogTitle></DialogHeader>
                    <ProductForm product={editProduct} onClose={() => setShowProductForm(false)} />
                  </DialogContent>
                </Dialog>
              </div>
              {productsLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <div className="vsm-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border bg-secondary">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Produit</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Catégorie</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Prix</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Stock</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(products || []).map((product) => (
                          <tr key={product.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                {product.image_url ? <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-sm object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-secondary"><Image className="h-5 w-5 text-muted-foreground" /></div>}
                                <span className="font-medium">{product.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 capitalize text-muted-foreground">{product.category || "—"}</td>
                            <td className="px-4 py-4 font-semibold text-primary">{product.price ? formatPrice(Number(product.price)) : "—"}</td>
                            <td className="px-4 py-4">
                              <span className={`font-medium ${(product.stock ?? 0) <= 5 ? "text-red-500" : ""}`}>{product.stock ?? 0}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${product.is_active ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}>
                                {product.is_active ? "Actif" : "Inactif"}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <button className="rounded-sm p-2 hover:bg-secondary" onClick={() => { setEditProduct(product); setShowProductForm(true); }}><Edit className="h-4 w-4 text-muted-foreground" /></button>
                                <button className="rounded-sm p-2 hover:bg-destructive/20" onClick={async () => {
                                  if (confirm("Supprimer ce produit ?")) {
                                    try { await deleteProduct.mutateAsync(product.id); toast({ title: "Produit supprimé" }); } catch (err: any) { toast({ title: "Erreur", description: err.message, variant: "destructive" }); }
                                  }
                                }}><Trash2 className="h-4 w-4 text-destructive" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(products || []).length === 0 && <p className="py-8 text-center text-muted-foreground">Aucun produit. Ajoutez-en un!</p>}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ============ ORDERS ============ */}
          {activeTab === "orders" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold">Commandes ({allOrders.length})</h3>
                <div className="flex gap-2">
                  {Object.entries(ORDER_STATUSES).map(([key, val]) => {
                    const count = allOrders.filter(o => o.status === key).length;
                    return count > 0 ? <Badge key={key} variant="secondary" className="gap-1">{val.label} <span className="font-bold">{count}</span></Badge> : null;
                  })}
                </div>
              </div>
              <div className="vsm-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border bg-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Client</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Adresse</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
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
                              <td className="px-4 py-4 font-semibold text-primary">{formatPrice(Number(order.total_amount))}</td>
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
              <h3 className="font-display text-xl font-bold">Zones de livraison</h3>
              <div className="vsm-card p-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input placeholder="Nom de la zone" value={dzForm.name} onChange={(e) => setDzForm({ ...dzForm, name: e.target.value })} />
                  <Input placeholder="Ville" value={dzForm.city} onChange={(e) => setDzForm({ ...dzForm, city: e.target.value })} />
                  <div className="flex gap-2">
                    <Input placeholder="Prix (FC)" type="number" value={dzForm.price} onChange={(e) => setDzForm({ ...dzForm, price: e.target.value })} />
                    <Button onClick={handleCreateDZ}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
              <div className="vsm-card overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-border bg-secondary"><tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Zone</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Ville</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Prix</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actif</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                  </tr></thead>
                  <tbody>
                    {(deliveryZones || []).map((dz) => (
                      <tr key={dz.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-4 font-medium">{dz.name}</td>
                        <td className="px-4 py-4 text-muted-foreground">{dz.city || "—"}</td>
                        <td className="px-4 py-4">{dz.price ? formatPrice(Number(dz.price)) : "—"}</td>
                        <td className="px-4 py-4"><Switch checked={dz.is_active} onCheckedChange={(v) => handleToggleDZ(dz.id, v)} /></td>
                        <td className="px-4 py-4 text-right"><button className="rounded-sm p-2 hover:bg-destructive/20" onClick={() => handleDeleteDZ(dz.id)}><Trash2 className="h-4 w-4 text-destructive" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(deliveryZones || []).length === 0 && <p className="py-8 text-center text-muted-foreground">Aucune zone.</p>}
              </div>
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

          {/* ============ AMBASSADORS ============ */}
          {activeTab === "ambassadors" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h3 className="font-display text-xl font-bold">Candidatures Ambassadeurs</h3>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Cliquez sur une ligne pour ouvrir la fiche détaillée : ventes, liens, clics et codes promo.
                </p>
              </div>
              <div className="vsm-card overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-border bg-secondary"><tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Nom</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Téléphone</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Plateforme</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Username</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Fiche</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                  </tr></thead>
                  <tbody>
                    {(ambassadorApps || []).map((app) => (
                      <tr
                        key={app.id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setAmbassadorSheetApp(app as Record<string, unknown>);
                          }
                        }}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                        onClick={() => setAmbassadorSheetApp(app as Record<string, unknown>)}
                      >
                        <td className="px-4 py-4 font-medium">{app.full_name}</td>
                        <td className="px-4 py-4 text-muted-foreground">{app.phone}</td>
                        <td className="px-4 py-4">{app.main_platform}</td>
                        <td className="px-4 py-4 text-primary">@{app.username}</td>
                        <td className="px-4 py-4">
                          <Badge variant={app.status === "approved" ? "default" : app.status === "rejected" ? "destructive" : "secondary"}>
                            {app.status === "approved" ? "Approuvé" : app.status === "rejected" ? "Refusé" : "En attente"}
                          </Badge>
                        </td>
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          {app.user_id ? (
                            <Button size="sm" variant="secondary" asChild>
                              <Link to={`/admin/ambassadeur/${app.user_id}`}>Page dédiée</Link>
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            {app.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" className="text-green-500" onClick={() => handleAppStatus(app.id, "approved")}><Check className="h-4 w-4" /></Button>
                                <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleAppStatus(app.id, "rejected")}><XCircle className="h-4 w-4" /></Button>
                              </>
                            )}
                            {app.status === "approved" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCreateTrackingForAmbassador(app)}
                                  className="text-primary"
                                >
                                  Lien
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setPromoDefaultAmbassadorId(app.user_id || undefined); setShowPromoForm(true); setActiveTab("promos"); }}
                                  className="text-primary"
                                >
                                  Promo
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(ambassadorApps || []).length === 0 && <p className="py-8 text-center text-muted-foreground">Aucune candidature.</p>}
              </div>
              <AmbassadorAdminDetailSheet
                application={ambassadorSheetApp}
                open={!!ambassadorSheetApp}
                onOpenChange={(v) => { if (!v) setAmbassadorSheetApp(null); }}
                orders={allOrders as Array<Record<string, unknown>>}
                promos={(promoCodes || []) as Array<Record<string, unknown>>}
              />
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

          {/* ============ HERO ============ */}
          {activeTab === "hero" && <HeroManager />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
