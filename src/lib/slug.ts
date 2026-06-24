/** Génère un slug URL à partir d'un nom de produit. */
export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "produit"
  );
}

export function getProductPath(product: { id: string; slug?: string | null }): string {
  return `/produit/${product.slug || product.id}`;
}
