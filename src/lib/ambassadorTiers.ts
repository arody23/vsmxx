/** Programme ambassadeur VSM — paliers alignés sur ambassadeur.vsmcollection.com */
export const AMBASSADOR_PROGRAM_TIERS = [
  { key: "starter", label: "Starter", minSales: 0, maxSales: 10, discountPercent: 10 },
  { key: "bronze", label: "Bronze", minSales: 11, maxSales: 14, discountPercent: 11 },
  { key: "silver", label: "Silver", minSales: 15, maxSales: 34, discountPercent: 13 },
  { key: "gold", label: "Gold", minSales: 35, maxSales: 74, discountPercent: 15 },
  { key: "elite", label: "Elite", minSales: 75, discountPercent: 20 },
] as const;

export type AmbassadorProgramTierKey = (typeof AMBASSADOR_PROGRAM_TIERS)[number]["key"];

export interface AmbassadorTier {
  key: AmbassadorProgramTierKey;
  label: string;
  discountPercent: number;
}

const tierByKey = new Map(
  AMBASSADOR_PROGRAM_TIERS.map((t) => [t.key, t] as const)
);

const tierByLabel = new Map(
  AMBASSADOR_PROGRAM_TIERS.map((t) => [t.label.toLowerCase(), t] as const)
);

export const normalizeTierKey = (value?: string | null): AmbassadorProgramTierKey => {
  const v = (value || "").trim().toLowerCase();
  if (tierByKey.has(v as AmbassadorProgramTierKey)) return v as AmbassadorProgramTierKey;
  const byLabel = tierByLabel.get(v);
  if (byLabel) return byLabel.key;
  return "starter";
};

export const getTierFromLabel = (label?: string | null): AmbassadorTier => {
  const key = normalizeTierKey(label);
  const row = tierByKey.get(key)!;
  return { key: row.key, label: row.label, discountPercent: row.discountPercent };
};

export const getTierCommissionRate = (tier?: AmbassadorTier | null) =>
  (tier?.discountPercent ?? 10) / 100;

export const getTierDiscountPercent = (tier?: AmbassadorTier | null) =>
  tier?.discountPercent ?? 10;
