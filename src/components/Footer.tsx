import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";

const socialLinks = [
{ name: "Facebook", icon: Facebook, url: "https://facebook.com/vsmcollection" },
{ name: "Instagram", icon: Instagram, url: "https://instagram.com/vsmcollection" },
];

const footerLinks = {
  company: [
    { label: "Accueil", to: "/" },
    { label: "Boutique", to: "/boutique" },
    { label: "À propos", to: "/a-propos" },
    { label: "Contact", to: "/contact" },
  ],
  legal: [
    { label: "Livraison", to: "/contact" },
    { label: "Retours & échanges", to: "/contact" },
    { label: "Devenir Ambassadeur", to: "/devenir-ambassadeur" },
  ],
};

const Footer = forwardRef<HTMLElement>((_, ref) => {
  return (
    <footer ref={ref} className="relative overflow-hidden border-t border-border bg-card">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(352,84%,49%,0.12),transparent_55%)]" />
      <div className="vsm-container relative py-14 md:py-16">
        <div className="mb-10 grid gap-8 rounded-sm border border-border/60 bg-background/40 p-6 md:grid-cols-3">
          <div className="space-y-3">
            <p className="font-display text-xs uppercase tracking-[0.28em] text-primary">VSM Collection</p>
            <h3 className="font-display text-2xl font-bold uppercase">Streetwear Premium</h3>
            <p className="text-sm text-muted-foreground">
              Made in DRC, Worn Worldwide. Des collections audacieuses, une finition premium, et une identité forte.
            </p>
          </div>
          <div className="grid gap-2 text-sm">
            <p className="font-display text-xs uppercase tracking-[0.24em] text-muted-foreground">Contact</p>
            <a href="tel:+243976028479" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
              <Phone className="h-4 w-4 text-primary" /> +243 97 60 28 479
            </a>
            <a href="mailto:contact@vsmcollection.com" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
              <Mail className="h-4 w-4 text-primary" /> contact@vsmcollection.com
            </a>
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" /> Ngiri-Ngiri, Kinshasa, RDC
            </p>
          </div>
          <div className="space-y-3">
            <p className="font-display text-xs uppercase tracking-[0.24em] text-muted-foreground">Réseaux</p>
            <div className="flex gap-2">
              {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                  title={social.name}
                  className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-secondary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Suivez nos sorties, lookbooks et éditions limitées.</p>
          </div>
          </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="mb-3 font-display text-xs uppercase tracking-[0.24em] text-muted-foreground">Navigation</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {footerLinks.company.map((item) => (
                <Link key={item.label} to={item.to} className="text-sm text-muted-foreground hover:text-primary">
                  {item.label}
              </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 font-display text-xs uppercase tracking-[0.24em] text-muted-foreground">Support</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {footerLinks.legal.map((item) => (
                <Link key={item.label} to={item.to} className="text-sm text-muted-foreground hover:text-primary">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-center md:flex-row">
          <p className="text-sm text-muted-foreground">© 2026 VSM Collection. Tous droits réservés.</p>
          <p className="text-sm text-muted-foreground">Built for premium street culture.</p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";
export default Footer;