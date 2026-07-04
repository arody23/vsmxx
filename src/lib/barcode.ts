/** Normalise un code-barres scanné ou saisi (supprime espaces, tirets, etc.). */
export function normalizeBarcode(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/** Extrait l'id variante depuis un code VSM0000000055. */
export function parseVsmVariantId(value: string): number | null {
  const normalized = normalizeBarcode(value);
  const match = normalized.match(/^VSM0*(\d+)$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
