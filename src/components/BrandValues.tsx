import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Globe, Award, Heart, Zap } from "lucide-react";

const values = [
{
  icon: Globe,
  title: "Made in DRC",
  description: "Fièrement conçu et fabriqué en République Démocratique du Congo, pour le monde entier."
},
{
  icon: Award,
  title: "Qualité Premium",
  description: "Matériaux de haute qualité, coutures renforcées, finitions soignées sur chaque pièce."
},
{
  icon: Heart,
  title: "Style Authentique",
  description: "Un design unique qui reflète notre culture urbaine et notre vision du streetwear."
},
{
  icon: Zap,
  title: "Éditions Limitées",
  description: "Des collections exclusives en quantité limitée pour un style unique."
}];


const BrandValues = forwardRef<HTMLElement>((_, ref) => {
  return (
    <section ref={ref} className="vsm-section relative overflow-hidden bg-card">
      {/* Background Glow */}
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="vsm-container relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center">
          
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">
            Nos Valeurs
          </p>
          <h2 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight md:text-5xl">
            L'ADN VSM
          </h2>
        </motion.div>

        {/* Values Grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value, index) =>
          <motion.div
            key={value.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="group text-center">
            
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-sm border border-border bg-secondary transition-all duration-300 group-hover:border-primary group-hover:bg-primary">
                <value.icon className="h-7 w-7 transition-colors group-hover:text-primary-foreground" />
              </div>
              <h3 className="font-display text-xl font-semibold uppercase tracking-wide">
                {value.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {value.description}
              </p>
            </motion.div>
          )}
        </div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 text-center">
          
          

          
        </motion.div>
      </div>
    </section>);

});

BrandValues.displayName = "BrandValues";

export default BrandValues;