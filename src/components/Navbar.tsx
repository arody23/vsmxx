import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Menu,
  X,
  ShoppingBag,
  User,
  LogOut,
  LayoutDashboard,
  Sparkles,
  Home,
  Store,
  Info,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { VsmBrandMark } from "@/components/VsmBrandMark";

const navLinks = [
  { name: "Accueil", path: "/", icon: Home },
  { name: "Boutique", path: "/boutique", icon: Store },
  { name: "À propos", path: "/a-propos", icon: Info },
  { name: "Contact", path: "/contact", icon: Mail },
] as const;

const RoleBadge = ({ variant }: { variant: "admin" | "ambassador" | "client" }) => {
  if (variant === "admin") {
    return (
      <span className="vsm-role-badge border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-400">
        Admin
      </span>
    );
  }
  if (variant === "ambassador") {
    return (
      <span className="vsm-role-badge border-violet-500/35 bg-violet-500/10 text-violet-800 dark:text-violet-300">
        Ambassadeur
      </span>
    );
  }
  return (
    <span className="vsm-role-badge border-border bg-muted/60 text-muted-foreground">
      Client
    </span>
  );
};

const Navbar = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const location = useLocation();
  const { getItemCount } = useCart();
  const { user, signOut, isAdmin, isAmbassador, rolesLoading } = useAuth();
  const itemCount = getItemCount();

  const roleKind: "admin" | "ambassador" | "client" | null =
    user && !rolesLoading ? (isAdmin ? "admin" : isAmbassador ? "ambassador" : "client") : null;
  const showCart = rolesLoading || !isAdmin;

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileDrawerOpen]);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/60 bg-background/90 shadow-sm backdrop-blur-lg">
      <nav className="relative z-[60] vsm-container flex h-16 items-center justify-between gap-3 md:h-20">
        <VsmBrandMark subtitle="Collection" className="relative z-50" />

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`font-display text-sm uppercase tracking-wider transition-colors duration-300 hover:text-primary ${
                location.pathname === link.path ? "text-primary" : "text-foreground"
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {roleKind && <RoleBadge variant={roleKind} />}

          {showCart && (
            <Link to="/panier" className="relative">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingBag className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>
          )}

          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              {rolesLoading ? (
                <div className="h-8 w-8 animate-pulse rounded-md bg-muted" aria-hidden />
              ) : isAdmin ? (
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <Link to="/admin">
                    <LayoutDashboard className="h-4 w-4" />
                    Administration
                  </Link>
                </Button>
              ) : isAmbassador ? (
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <Link to="/ambassadeur">
                    <Sparkles className="h-4 w-4" />
                    Espace ambassadeur
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <Link to="/mon-compte">
                    <User className="h-4 w-4" />
                    Mon compte
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Link to="/connexion" className="hidden md:block">
              <Button variant="outline" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                Connexion
              </Button>
            </Link>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-expanded={mobileDrawerOpen}
            aria-controls="site-mobile-drawer"
            aria-label={mobileDrawerOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMobileDrawerOpen((o) => !o)}
          >
            {mobileDrawerOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </nav>

      {/* Mobile: tiroir latéral (même principe que l’admin) + assombrissement du contenu */}
      <div
        className={cn(
          "fixed inset-x-0 top-16 bottom-0 z-[45] bg-black/60 transition-opacity duration-300 md:hidden",
          mobileDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
        onClick={() => setMobileDrawerOpen(false)}
      />

      <aside
        id="site-mobile-drawer"
        className={cn(
          "fixed bottom-0 right-0 top-16 z-[46] flex h-[calc(100dvh-4rem)] min-h-0 w-[min(20rem,90vw)] flex-col border-l border-border shadow-2xl transition-transform duration-300 ease-out md:hidden",
          mobileDrawerOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
        style={{
          backgroundColor: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
        }}
        aria-hidden={!mobileDrawerOpen}
      >
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-b border-border/80 p-3 pt-4" aria-label="Navigation principale">
          <ul className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.path;
              return (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-sm px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {link.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 space-y-1 border-t border-border p-3">
          {roleKind && (
            <div className="mb-2 flex justify-center px-2">
              <RoleBadge variant={roleKind} />
            </div>
          )}

          {showCart && (
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" asChild>
              <Link to="/panier" onClick={() => setMobileDrawerOpen(false)}>
                <ShoppingBag className="h-5 w-5" />
                Panier
                {itemCount > 0 ? ` (${itemCount})` : ""}
              </Link>
            </Button>
          )}

          {user ? (
            <>
              {rolesLoading ? (
                <div className="h-11 w-full animate-pulse rounded-sm bg-muted" aria-hidden />
              ) : isAdmin ? (
                <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                  <Link to="/admin" onClick={() => setMobileDrawerOpen(false)}>
                    <LayoutDashboard className="h-5 w-5" />
                    Administration
                  </Link>
                </Button>
              ) : isAmbassador ? (
                <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                  <Link to="/ambassadeur" onClick={() => setMobileDrawerOpen(false)}>
                    <Sparkles className="h-5 w-5" />
                    Espace ambassadeur
                  </Link>
                </Button>
              ) : (
                <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                  <Link to="/mon-compte" onClick={() => setMobileDrawerOpen(false)}>
                    <User className="h-5 w-5" />
                    Mon compte
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={() => {
                  void signOut();
                  setMobileDrawerOpen(false);
                }}
              >
                <LogOut className="h-5 w-5" />
                Déconnexion
              </Button>
            </>
          ) : (
            <Button variant="ghost" className="w-full justify-start gap-2 font-medium" asChild>
              <Link to="/connexion" onClick={() => setMobileDrawerOpen(false)}>
                <User className="h-5 w-5" />
                Connexion
              </Link>
            </Button>
          )}
        </div>
      </aside>
    </header>
  );
};

export default Navbar;
