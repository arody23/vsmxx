import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Product, ProductVariant } from "@/types/product";
import { Tables } from "@/integrations/supabase/types";

const mapProduct = (row: Tables<"products">, variants?: ProductVariant[]): Product => {
  const productVariants = variants || [];
  const colors = [...new Set(productVariants.map(v => v.color))];
  const sizes = [...new Set(productVariants.map(v => v.size))];
  const totalVariantStock = productVariants.reduce((s, v) => s + v.stock, 0);

  return {
    id: String(row.id),
    slug: row.slug || undefined,
    name: row.name,
    description: row.description || "",
    price: Number(row.price) || 0,
    image: row.image_url || "/placeholder.svg",
    images: row.images || (row.image_url ? [row.image_url] : []),
    category: row.category || "",
    inStock: productVariants.length > 0 ? totalVariantStock > 0 : (row.stock ?? 0) > 0,
    badge: undefined,
    sizes: sizes.length > 0 ? sizes : undefined,
    colors: colors.length > 0 ? colors : undefined,
    variants: productVariants.length > 0 ? productVariants : undefined,
  };
};

export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const [{ data: products, error }, { data: variants }] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("product_variants").select("*"),
      ]);
      if (error) throw error;
      const variantsByProduct = new Map<number, ProductVariant[]>();
      (variants || []).forEach((v: any) => {
        const list = variantsByProduct.get(v.product_id) || [];
        list.push({ id: v.id, product_id: v.product_id, color: v.color, size: v.size, stock: v.stock });
        variantsByProduct.set(v.product_id, list);
      });
      return (products || []).map(p => mapProduct(p, variantsByProduct.get(p.id)));
    },
  });
};

export const useAllProducts = () => {
  return useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

export const useProduct = (slugOrId: string | undefined) => {
  return useQuery({
    queryKey: ["products", slugOrId],
    queryFn: async () => {
      if (!slugOrId) return null;
      const isNumeric = /^\d+$/.test(slugOrId);
      const productQuery = isNumeric
        ? supabase.from("products").select("*").eq("id", Number(slugOrId)).single()
        : supabase.from("products").select("*").eq("slug", slugOrId).single();

      const { data, error } = await productQuery;
      if (error) throw error;
      if (!data) return null;

      const { data: variants } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", data.id);

      const pvs: ProductVariant[] = (variants || []).map((v: any) => ({
        id: v.id, product_id: v.product_id, color: v.color, size: v.size, stock: v.stock,
      }));
      return mapProduct(data, pvs);
    },
    enabled: !!slugOrId,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (product: {
      name: string; slug?: string; description?: string; price?: number; category?: string;
      image_url?: string; images?: string[]; stock?: number; sku?: string; is_active?: boolean;
    }) => {
      const { data, error } = await supabase.from("products").insert(product).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<{
      name: string; slug: string; description: string; price: number; category: string;
      image_url: string; images: string[]; stock: number; sku: string; is_active: boolean;
    }>) => {
      const { data, error } = await supabase.from("products").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); },
  });
};
