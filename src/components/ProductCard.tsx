import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { ShoppingBag, Eye } from "lucide-react";

interface ProductCardProps {
  product: Product;
  index?: number;
}

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const { addItem } = useCart();

  const formatPrice = (price: number) => {
    return price.toLocaleString("fr-CD") + " FC";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="vsm-card group"
    >
      {/* Image */}
      <Link to={`/produit/${product.id}`} className="relative block aspect-[3/4] overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* Badge */}
        {product.badge && (
          <div className="absolute left-3 top-3">
            <span className="vsm-badge">{product.badge}</span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground">
            <Eye className="h-4 w-4" />
            Voir le produit
          </span>
        </div>
      </Link>

      {/* Info */}
      <div className="space-y-2 p-4">
        <Link to={`/produit/${product.id}`}>
          <h3 className="font-display text-lg font-semibold uppercase tracking-wide hover:text-primary">
            {product.name}
          </h3>
        </Link>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-primary">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && (
              <span className="vsm-price-strike text-sm">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              addItem(product);
            }}
          >
            <ShoppingBag className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
