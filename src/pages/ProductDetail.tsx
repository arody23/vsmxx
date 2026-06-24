import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Loader2, Share2, Copy, MessageCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useProduct } from "@/hooks/useProducts";
import { toast } from "@/hooks/use-toast";
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
    if (product) {
      if (product.colors && product.colors.length > 0) setSelectedColor(product.colors[0]);
    }
  }, [product]);

  useEffect(() => {
    if (product?.variants && selectedColor) {
      const sizesForColor = product.variants
        .filter(v => v.color === selectedColor && v.stock > 0)
        .map(v => v.size);
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
              <Button variant="hero" className="mt-4">Retour à la boutique</Button>
            </Link>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  const images = product.images && product.images.length > 0 ? product.images : [product.image];
  const hasVariants = product.variants && product.variants.length > 0;

  const sizesForColor = hasVariants && selectedColor
    ? [...new Set(product.variants!.filter(v => v.color === selectedColor).map(v => v.size))]
    : product.sizes || [];

  const getVariantStock = (color: string, size: string) => {
    if (!hasVariants) return null;
    const variant = product.variants!.find(v => v.color === color && v.size === size);
    return variant?.stock ?? 0;
  };

  const currentStock = hasVariants && selectedColor && selectedSize
    ? getVariantStock(selectedColor, selectedSize)
    : null;

  const canAddToCart = hasVariants
    ? (selectedColor && selectedSize && currentStock !== null && currentStock > 0)
    : product.inStock;

  const isAvailable = hasVariants
    ? currentStock !== null && currentStock > 0
    : product.inStock;

  const handleAddToCart = () => {
    addItem(product, { size: selectedSize || undefined, color: selectedColor || undefined });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const nextImage = () => setSelectedImage((prev) => (prev + 1) % images.length);
  const prevImage = () => setSelectedImage((prev) => (prev - 1 + images.length) % images.length);
  const productUrl = `${window.location.origin}${getProductPath(product)}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(productUrl);
    toast({ title: "Lien copié", description: "Le lien du produit a été copié." });
  };

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `Découvre ce produit: ${product.name}`,
          url: productUrl,
        });
      } else {
        await handleCopyLink();
      }
    } catch {
      // annulé par l'utilisateur
    }
  };

  const openShare = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pb-20 pt-28 md:pt-32">
        <div className="vsm-container max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 md:mb-8">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-primary">Accueil</Link>
              <span>/</span>
              <Link to="/boutique" className="hover:text-primary">Boutique</Link>
              <span>/</span>
              <span className="truncate text-foreground">{product.name}</span>
            </nav>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-14 xl:gap-20">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 lg:sticky lg:top-28">
              <div className="relative aspect-square overflow-hidden rounded-sm bg-secondary lg:aspect-[4/5] xl:max-h-[min(80vh,720px)]">
                <img src={images[selectedImage]} alt={product.name} className="h-full w-full object-cover" />
                {images.length > 1 && (
                  <>
                    <button type="button" onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm hover:bg-background">
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button type="button" onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm hover:bg-background">
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}
                {product.badge && (
                  <span className="absolute left-4 top-4 rounded-sm bg-primary px-3 py-1 font-display text-sm font-bold uppercase text-primary-foreground">
                    {product.badge}
                  </span>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible">
                  {images.map((img, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedImage(index)}
                      className={`flex-shrink-0 overflow-hidden rounded-sm border-2 transition-colors lg:flex-shrink ${selectedImage === index ? "border-primary" : "border-transparent"}`}
                    >
                      <img src={img} alt={`${product.name} ${index + 1}`} className="h-20 w-20 object-cover lg:h-full lg:w-full lg:aspect-square" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6 lg:space-y-8"
            >
              <div>
                <p className="font-display text-sm uppercase tracking-[0.2em] text-primary">{product.category}</p>
                <h1 className="mt-2 font-display text-3xl font-bold uppercase md:text-4xl xl:text-5xl">{product.name}</h1>
              </div>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">{product.description}</p>
              <div className="flex items-baseline gap-3 border-b border-border pb-6">
                <span className="font-display text-3xl font-bold text-primary md:text-4xl">{formatPrice(product.price)}</span>
                {product.originalPrice && (
                  <span className="text-lg text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                )}
              </div>

              {product.colors && product.colors.length > 0 && (
                <div>
                  <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider">
                    Couleur: <span className="text-primary">{selectedColor}</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((color) => {
                      const colorStock = hasVariants
                        ? product.variants!.filter(v => v.color === color).reduce((s, v) => s + v.stock, 0)
                        : null;
                      const outOfStock = colorStock === 0;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`rounded-sm border px-4 py-2 font-display text-sm font-medium uppercase tracking-wide transition-colors ${
                            selectedColor === color
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary"
                          } ${outOfStock ? "opacity-40" : ""}`}
                          disabled={outOfStock}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {sizesForColor.length > 0 && (
                <div>
                  <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider">Taille</h3>
                  <div className="flex flex-wrap gap-2">
                    {sizesForColor.map((size) => {
                      const sizeStock = hasVariants && selectedColor
                        ? getVariantStock(selectedColor, size)
                        : null;
                      const outOfStock = sizeStock === 0;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`min-w-[48px] rounded-sm border px-4 py-2 font-display text-sm font-medium transition-colors ${
                            selectedSize === size
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary"
                          } ${outOfStock ? "opacity-40" : ""}`}
                          disabled={outOfStock}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${isAvailable ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm text-muted-foreground">
                  {isAvailable ? "Disponible" : "Rupture de stock"}
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <Button variant="hero" size="xl" className="w-full flex-1 gap-2" onClick={handleAddToCart} disabled={!canAddToCart}>
                  {isAdded ? (<><Check className="h-5 w-5" />Ajouté au panier!</>) : (<><ShoppingCart className="h-5 w-5" />Ajouter au panier</>)}
                </Button>
              </div>

              <div className="rounded-sm border border-border bg-card p-4 md:p-5">
                <p className="mb-3 font-display text-sm font-semibold uppercase tracking-wider">Partager ce produit</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleNativeShare}>
                    <Share2 className="h-4 w-4" /> Partager
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" /> Copier lien
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      openShare(
                        `https://wa.me/?text=${encodeURIComponent(`Découvre ${product.name} sur VSM: ${productUrl}`)}`
                      )
                    }
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`)
                    }
                  >
                    Facebook
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="col-span-2 md:col-span-1"
                    onClick={() =>
                      openShare(
                        `https://twitter.com/intent/tweet?text=${encodeURIComponent(product.name)}&url=${encodeURIComponent(productUrl)}`
                      )
                    }
                  >
                    X
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Instagram n'autorise pas le partage de lien direct depuis le web : utilise « Copier lien ».
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default ProductDetail;
