import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AmbassadorTier,
  DEFAULT_AMBASSADOR_TIER_ID,
  getTierCommissionRate,
} from "@/lib/ambassadorTiers";

export const useAmbassadorTier = (userId?: string | null) => {
  const [tier, setTier] = useState<AmbassadorTier | null>(null);
  const [loading, setLoading] = useState(!!userId);

  const load = useCallback(async () => {
    if (!userId) {
      setTier(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("ambassador_tier")
        .eq("id", userId)
        .maybeSingle();

      const tierId = (profile as { ambassador_tier?: string } | null)?.ambassador_tier
        || DEFAULT_AMBASSADOR_TIER_ID;

      const { data: tierRow } = await (supabase as any)
        .from("ambassador_tiers")
        .select("*")
        .eq("id", tierId)
        .maybeSingle();

      setTier((tierRow as AmbassadorTier) || null);
    } catch {
      setTier(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    tier,
    loading,
    commissionRate: getTierCommissionRate(tier),
    reload: load,
  };
};
