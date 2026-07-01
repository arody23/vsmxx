export interface AmbassadorTier {
  id: string;
  label: string;
  client_discount_percent: number;
  commission_percent: number;
}

export const DEFAULT_AMBASSADOR_TIER_ID = "bronze";

export const getTierCommissionRate = (tier?: AmbassadorTier | null) =>
  Number(tier?.commission_percent ?? 10) / 100;

export const getTierDiscountPercent = (tier?: AmbassadorTier | null) =>
  Number(tier?.client_discount_percent ?? 10);
