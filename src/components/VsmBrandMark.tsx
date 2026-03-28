import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type VsmBrandMarkProps = {
  /** Sous-titre sous « VSM » (ex. Collection, Administration). */
  subtitle: string;
  /** Cible du lien (défaut : accueil). */
  href?: string;
  /** false = pas de lien (bloc statique). */
  asLink?: boolean;
  className?: string;
  /** Taille compacte pour barres étroites (sidebar mobile). */
  compact?: boolean;
};

/**
 * Bloc marque aligné sur le header du site : VSM + sous-titre en petites capitales.
 */
export function VsmBrandMark({
  subtitle,
  href = "/",
  asLink = true,
  className,
  compact,
}: VsmBrandMarkProps) {
  const inner = (
    <>
      <span
        className={cn(
          "font-display font-bold tracking-[0.2em] text-primary",
          compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl md:text-3xl",
        )}
      >
        VSM
      </span>
      <span
        className={cn(
          "font-medium uppercase tracking-[0.35em] text-muted-foreground",
          compact ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[10px] md:text-[11px]",
        )}
      >
        {subtitle}
      </span>
    </>
  );

  const boxClass = cn("flex flex-col items-start leading-none", className);

  if (!asLink) {
    return <div className={boxClass}>{inner}</div>;
  }

  return (
    <Link to={href} className={cn(boxClass, "shrink-0 outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring")}>
      {inner}
    </Link>
  );
}
