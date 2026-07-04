import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { kinshasaCommunes } from "@/data/store";

export interface DeliveryCommune {
  id?: number;
  name: string;
  city: string | null;
  deliveryFee: number;
  zone?: string | null;
}

const fallbackCommunes: DeliveryCommune[] = kinshasaCommunes.map((c) => ({
  name: c.name,
  city: "Kinshasa",
  deliveryFee: c.deliveryFee,
  zone: c.zone,
}));

export function useDeliveryCommunes(city = "Kinshasa") {
  return useQuery({
    queryKey: ["delivery-zones", city],
    queryFn: async (): Promise<DeliveryCommune[]> => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("id, name, city, price, zone_type")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      const rows = (data || []).filter(
        (row) => !city || !row.city || row.city.toLowerCase() === city.toLowerCase()
      );

      if (rows.length === 0) return fallbackCommunes;

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        city: row.city,
        deliveryFee: Number(row.price || 0),
        zone: row.zone_type,
      }));
    },
    staleTime: 60_000,
  });
}
