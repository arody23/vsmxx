import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface HeroSlide {
  id: number;
  image: string;
  title: string;
  subtitle: string;
}

const HeroSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const {
    data: slides = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["hero-slides-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", [
          "hero_1_image",
          "hero_1_title",
          "hero_1_subtitle",
          "hero_2_image",
          "hero_2_title",
          "hero_2_subtitle",
          "hero_3_image",
          "hero_3_title",
          "hero_3_subtitle",
        ]);

      if (error) throw error;

      const map: Record<string, string> = {};
      (data || []).forEach((setting) => {
        map[setting.key] = setting.value || "";
      });

      return [1, 2, 3]
        .map((index) => ({
          id: index,
          image: map[`hero_${index}_image`] || "",
          title: map[`hero_${index}_title`] || "",
          subtitle: map[`hero_${index}_subtitle`] || "",
        }))
        .filter((slide) => slide.image && slide.title);
    },
    staleTime: 60 * 1000,
    retry: 2,
  });

  useEffect(() => {
    if (currentSlide >= slides.length && slides.length > 0) {
      setCurrentSlide(0);
    }
  }, [slides.length, currentSlide]);

  const nextSlide = useCallback(() => {
    if (slides.length === 0) return;
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [nextSlide, slides.length]);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
  };

  if (isLoading) {
    return (
      <section className="relative flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </section>
    );
  }

  if (isError || slides.length === 0) {
    return (
      <section className="relative flex h-screen w-full items-center justify-center bg-background">
        <div className="vsm-container text-center">
          <h1 className="font-display text-4xl font-bold uppercase md:text-6xl">
            VSM Collection
          </h1>
          <p className="mt-4 text-muted-foreground">
            Bannières héros indisponibles pour le moment.
          </p>
          <Link to="/boutique" className="mt-6 inline-block">
            <Button variant="hero" size="xl">
              Voir la boutique
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={slides[currentSlide].id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.7, ease: [0.43, 0.13, 0.23, 0.96] }}
          className="absolute inset-0"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${slides[currentSlide].image})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="vsm-container relative z-10 flex h-full items-center">
        <div className="max-w-2xl space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={slides[currentSlide].id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-4"
            >
              <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">
                {slides[currentSlide].subtitle}
              </p>
              <h2 className="font-display text-5xl font-bold uppercase tracking-tight md:text-7xl lg:text-8xl">
                {slides[currentSlide].title}
              </h2>
              <p className="max-w-md text-lg text-muted-foreground">
                Vivre avec style. Premium streetwear made in DRC, worn worldwide.
              </p>
            </motion.div>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-wrap gap-4 pt-4"
          >
            <Link to="/boutique">
              <Button variant="hero" size="xl">
                Découvrir la collection
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-3">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => {
                setDirection(index > currentSlide ? 1 : -1);
                setCurrentSlide(index);
              }}
              className={`h-2 transition-all duration-300 ${
                index === currentSlide
                  ? "w-8 bg-primary"
                  : "w-2 bg-foreground/30 hover:bg-foreground/50"
              }`}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 right-8 hidden items-center gap-2 md:flex"
      >
        <span className="font-display text-xs uppercase tracking-wider text-muted-foreground">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="h-6 w-[1px] bg-primary"
        />
      </motion.div>
    </section>
  );
};

export default HeroSlider;
