import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Check,
  Loader2,
  Share2,
  Copy,
  Truck,
  Shield,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useProduct } from "@/hooks/useProducts";
import { toast } from "@/hooks/use-toast";
import ProductReviews from "@/components/product/ProductReviews";
import { getProductPath } from "@/lib/slug";

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();
  const { data: product, isLoading } = useProduct(slug);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    if (product?.colors?.length) setSelectedColor(product.colors[0]);
  }, [product]);

  useEffect(() => {
    if (product?.variants && selectedColor) {
      const sizesForColor = product.variants
        .filter((v) => v.color === selectedColor && v.stock > 0)
        .map((v) => v.size);
      setSelectedSize(sizesForColor.length > 0 ? sizesForColor[0] : null);
    }
  }, [selectedColor, product]);

  const formatPrice = (price: number) => price.toLocaleString("fr-CD") + " FC";

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar />
        <section className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold uppercase">Produit non trouvé</h1>
            <Link to="/boutique">
              <Button variant="hero" className="mt-4">
                Retour à la boutique
              </Button>
            </Link>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  const images = product.images?.length ? product.images : [product.image];
  const hasVariants = product.variants && product.variants.length > 0;

  const sizesForColor =
    hasVariants && selectedColor
      ? [...new Set(product.variants!.filter((v) => v.color === selectedColor).map((v) => v.size))]
      : product.sizes || [];

  const getVariantStock = (color: string, size: string) => {
    if (!hasVariants) return null;
    return product.variants!.find((v) => v.color === color && v.size === size)?.stock ?? 0;
  };

  const currentStock =
    hasVariants && selectedColor && selectedSize
      ? getVariantStock(selectedColor, selectedSize)
      : null;

  const canAddToCart = hasVariants
    ? !!(selectedColor && selectedSize && currentStock !== null && currentStock > 0)
    : product.inStock;

  const isAvailable = hasVariants
    ? currentStock !== null && currentStock > 0
    : product.inStock;

  const handleAddToCart = () => {
    addItem(product, { size: selectedSize || undefined, color: selectedColor || undefined });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const productUrl = `${window.location.origin}${getProductPath(product)}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(productUrl);
    toast({ title: "Lien copié" });
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url: productUrl });
      } else {
        await handleCopyLink();
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      {/* Hero plein écran — mise en avant produit */}
      <section className="relative border-b border-border bg-gradient-to-b from-secondary/40 to-background pt-24 md:pt-28">
        <div className="vsm-container max-w-7xl pb-10">
          <nav className="mb-6 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Link to="/boutique" className="hover:text-primary">
              Boutique
            </Link>
            <span>/</span>
            <span className="text-foreground">{product.category}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Galerie — vignettes verticales + image principale */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-7"
            >
              <div className="flex flex-col gap-4 md:flex-row">
                {images.length > 1 && (
                  <div className="order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col md:overflow-visible">
                    {images.map((img, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedImage(index)}
                        className={`shrink-0 overflow-hidden rounded-sm border-2 transition-all ${
                          selectedImage === index
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={img}
                          alt=""
                          className="h-16 w-16 object-cover md:h-20 md:w-20"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative order-1 min-h-[320px] flex-1 overflow-hidden rounded-sm bg-secondary md:order-2 md:min-h-[520px]">
                  <img
                    src={images[selectedImage]}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                  {product.badge && (
                    <span className="absolute left-4 top-4 bg-primary px-3 py-1 font-display text-xs font-bold uppercase text-primary-foreground">
                      {product.badge}
                    </span>
                  )}
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedImage((p) => (p - 1 + images.length) % images.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedImage((p) => (p + 1) % images.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Panneau achat — sticky, style premium */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="lg:col-span-5"
            >
              <div className="lg:sticky lg:top-28">
                <div className="rounded-sm border border-border bg-card p-6 shadow-lg md:p-8">
                  <p className="font-display text-xs uppercase tracking-[0.25em] text-primary">
                    {product.category}
                  </p>
                  <h1 className="mt-2 font-display text-3xl font-bold uppercase leading-tight md:text-4xl">
                    {product.name}
                  </h1>

                  <div className="mt-5 flex items-baseline gap-3">
                    <span className="font-display text-3xl font-bold text-primary">
                      {formatPrice(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-lg text-muted-foreground line-through">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>

                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground md:text-base">
                    {product.description}
                  </p>

                  {product.colors && product.colors.length > 0 && (
                    <div className="mt-6">
                      <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wider">
                        Couleur — <span className="text-primary">{selectedColor}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {product.colors.map((color) => {
                          const out =
                            hasVariants &&
                            product.variants!.filter((v) => v.color === color).every((v) => v.stock === 0);
                          return (
                            <button
                              key={color}
                              type="button"
                              disabled={out}
                              onClick={() => setSelectedColor(color)}
                              className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase transition-colors ${
                                selectedColor === color
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:border-primary"
                              } ${out ? "opacity-40" : ""}`}
                            >
                              {color}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {sizesForColor.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wider">
                        Taille
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sizesForColor.map((size) => {
                          const out =
                            hasVariants &&
                            selectedColor &&
                            getVariantStock(selectedColor, size) === 0;
                          return (
                            <button
                              key={size}
                              type="button"
                              disabled={out}
                              onClick={() => setSelectedSize(size)}
                              className={`min-w-[44px] rounded-sm border px-3 py-2 text-sm font-medium ${
                                selectedSize === size
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:border-primary"
                              } ${out ? "opacity-40" : ""}`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex items-center gap-2 text-sm">
                    <span
                      className={`h-2 w-2 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-red-500"}`}
                    />
                    {isAvailable ? "En stock" : "Rupture de stock"}
                  </div>

                  <Button
                    variant="hero"
                    size="xl"
                    className="mt-6 w-full gap-2"
                    onClick={handleAddToCart}
                    disabled={!canAddToCart}
                  >
                    {isAdded ? (
                      <>
                        <Check className="h-5 w-5" />
                        Ajouté !
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5" />
                        Ajouter au panier
                      </>
                    )}
                  </Button>

                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleShare}>
                      <Share2 className="h-4 w-4" />
                      Partager
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleCopyLink}>
                      <Copy className="h-4 w-4" />
                      Copier le lien
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 rounded-sm border border-border/60 bg-card/50 px-3 py-3">
                    <Truck className="h-4 w-4 shrink-0 text-primary" />
                    Livraison Kinshasa &amp; environs
                  </div>
                  <div className="flex items-center gap-2 rounded-sm border border-border/60 bg-card/50 px-3 py-3">
                    <Shield className="h-4 w-4 shrink-0 text-primary" />
                    Qualité VSM Collection
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="vsm-container pb-20">
        <ProductReviews productId={Number(product.id)} />
      </section>

      <Footer />
    </main>
  );
};

export default ProductDetail;
