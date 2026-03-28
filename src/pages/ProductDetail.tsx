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

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();
  const { data: product, isLoading } = useProduct(id);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    if (product) {
      if (product.colors && product.colors.length > 0) setSelectedColor(product.colors[0]);
    }
  }, [product]);

  // When color changes, reset size
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
            <h1 className="font-display text-2xl font-bold">Produit non trouvé</h1>
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

  // Get sizes available for selected color
  const sizesForColor = hasVariants && selectedColor
    ? [...new Set(product.variants!.filter(v => v.color === selectedColor).map(v => v.size))]
    : product.sizes || [];

  // Get stock for selected variant
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

  const handleAddToCart = () => {
    addItem(product, { size: selectedSize || undefined, color: selectedColor || undefined });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const nextImage = () => setSelectedImage((prev) => (prev + 1) % images.length);
  const prevImage = () => setSelectedImage((prev) => (prev - 1 + images.length) % images.length);
  const productUrl = `${window.location.origin}/produit/${product.id}`;

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
      // user cancelled share
    }
  };

  const openShare = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pb-20 pt-32">
        <div className="vsm-container">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-primary">Accueil</Link>
              <span>/</span>
              <Link to="/boutique" className="hover:text-primary">Boutique</Link>
              <span>/</span>
              <span className="text-foreground">{product.name}</span>
            </nav>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-sm bg-secondary">
                <img src={images[selectedImage]} alt={product.name} className="h-full w-full object-cover" />
                {images.length > 1 && (
                  <>
                    <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm hover:bg-background">
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm hover:bg-background">
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}
                {product.badge && (
                  <span className="absolute left-4 top-4 rounded-sm bg-primary px-3 py-1 font-display text-sm font-bold text-primary-foreground">
                    {product.badge}
                  </span>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((img, index) => (
                    <button key={index} onClick={() => setSelectedImage(index)}
                      className={`flex-shrink-0 overflow-hidden rounded-sm border-2 transition-colors ${selectedImage === index ? "border-primary" : "border-transparent"}`}>
                      <img src={img} alt={`${product.name} ${index + 1}`} className="h-20 w-20 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
              <div>
                <p className="font-display text-sm uppercase tracking-[0.2em] text-primary">{product.category}</p>
                <h1 className="mt-2 font-display text-3xl font-bold uppercase md:text-4xl">{product.name}</h1>
              </div>
              <p className="text-lg text-muted-foreground">{product.description}</p>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-primary">{formatPrice(product.price)}</span>
                {product.originalPrice && (
                  <span className="text-lg text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                )}
              </div>

              {/* Color selection */}
              {product.colors && product.colors.length > 0 && (
                <div>
                  <h3 className="mb-3 font-display text-sm font-semibold uppercase">
                    Couleur: <span className="text-primary">{selectedColor}</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((color) => {
                      const colorStock = hasVariants
                        ? product.variants!.filter(v => v.color === color).reduce((s, v) => s + v.stock, 0)
                        : null;
                      return (
                        <button key={color} onClick={() => setSelectedColor(color)}
                          className={`rounded-sm border px-4 py-2 text-sm font-medium transition-colors ${
                            selectedColor === color
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary"
                          } ${colorStock === 0 ? "opacity-40" : ""}`}
                          disabled={colorStock === 0}>
                          {color}
                          {colorStock !== null && <span className="ml-1 text-xs opacity-70">({colorStock})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size selection (filtered by color) */}
              {sizesForColor.length > 0 && (
                <div>
                  <h3 className="mb-3 font-display text-sm font-semibold uppercase">Taille</h3>
                  <div className="flex flex-wrap gap-2">
                    {sizesForColor.map((size) => {
                      const sizeStock = hasVariants && selectedColor
                        ? getVariantStock(selectedColor, size)
                        : null;
                      return (
                        <button key={size} onClick={() => setSelectedSize(size)}
                          className={`min-w-[48px] rounded-sm border px-4 py-2 font-display text-sm font-medium transition-colors ${
                            selectedSize === size
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary"
                          } ${sizeStock === 0 ? "opacity-40" : ""}`}
                          disabled={sizeStock === 0}>
                          {size}
                          {sizeStock !== null && <span className="ml-1 text-xs opacity-70">({sizeStock})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stock indicator */}
              {hasVariants && selectedColor && selectedSize && (
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${currentStock && currentStock > 0 ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-sm text-muted-foreground">
                    {currentStock && currentStock > 0
                      ? `${currentStock} pièce${currentStock > 1 ? "s" : ""} en stock`
                      : "Rupture de stock"}
                  </span>
                </div>
              )}

              <Button variant="hero" size="xl" className="w-full gap-2" onClick={handleAddToCart} disabled={!canAddToCart}>
                {isAdded ? (<><Check className="h-5 w-5" />Ajouté au panier!</>) : (<><ShoppingCart className="h-5 w-5" />Ajouter au panier</>)}
              </Button>

              <div className="rounded-sm border border-border bg-card p-4">
                <p className="mb-3 text-sm font-medium">Partager ce produit</p>
                <div className="flex flex-wrap gap-2">
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
                    onClick={() =>
                      openShare(
                        `https://twitter.com/intent/tweet?text=${encodeURIComponent(product.name)}&url=${encodeURIComponent(productUrl)}`
                      )
                    }
                  >
                    X
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Instagram n'autorise pas le partage de lien direct depuis le web: utilise “Copier lien” puis colle-le en story/bio.
                </p>
              </div>

              {!hasVariants && (
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${product.inStock ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-sm text-muted-foreground">{product.inStock ? "En stock" : "Rupture de stock"}</span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default ProductDetail;
