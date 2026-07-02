import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AmbassadorTier,
  getTierCommissionRate,
  getTierFromLabel,
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
      const { data: tierLabel, error } = await (supabase as any).rpc(
        "get_ambassador_program_tier",
        { p_user_id: userId }
      );

      if (error) throw error;
      setTier(getTierFromLabel(tierLabel as string));
    } catch {
      setTier(getTierFromLabel("Starter"));
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
