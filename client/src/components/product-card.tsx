import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, Package } from "lucide-react";
import type { ColorWithVariantAndProduct, Settings } from "@shared/schema";
import { getEffectiveRate } from "@shared/schema";

interface ProductCardProps {
  color: ColorWithVariantAndProduct;
  onAddToCart: (color: ColorWithVariantAndProduct) => void;
  onClick: (color: ColorWithVariantAndProduct) => void;
  settings?: Settings;
}

const StockQuantity = ({ stock, required = 0, showBorder = false }: { stock: number; required?: number; showBorder?: boolean }) => {
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 10;
  const hasInsufficientStock = required > stock;
  const borderClass = showBorder ? "" : "border-0";

  if (isOutOfStock) {
    return (
      <Badge variant="outline" className={`bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 text-xs px-2 py-1 ${borderClass}`}>
        <AlertTriangle className="h-3 w-3 mr-1" />
        Out of Stock
      </Badge>
    );
  } else if (hasInsufficientStock) {
    return (
      <Badge variant="outline" className={`bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-xs px-2 py-1 ${borderClass}`}>
        <AlertTriangle className="h-3 w-3 mr-1" />
        Low: {stock} (Need: {required})
      </Badge>
    );
  } else if (isLowStock) {
    return (
      <Badge variant="outline" className={`bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-xs px-2 py-1 ${borderClass}`}>
        Low: {stock}
      </Badge>
    );
  } else {
    return (
      <Badge variant="outline" className={`bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs px-2 py-1 ${borderClass}`}>
        {stock}
      </Badge>
    );
  }
};

export function ProductCard({ color, onAddToCart, onClick, settings }: ProductCardProps) {
  const cardBorderStyle = settings?.cardBorderStyle ?? 'shadow';
  const cardShadowSize = settings?.cardShadowSize ?? 'sm';
  const cardButtonColor = settings?.cardButtonColor ?? 'indigo-600';
  const cardPriceColor = settings?.cardPriceColor ?? 'indigo-600';
  const showStockBadgeBorder = settings?.showStockBadgeBorder ?? false;

  const getCardClassName = () => {
    let baseClass = "bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm transition-all cursor-pointer rounded-xl border border-slate-100 dark:border-slate-700/50";
    
    if (cardBorderStyle === 'shadow') {
      const shadowSizes: Record<string, string> = {
        sm: 'shadow-sm hover:shadow-lg',
        md: 'shadow-md hover:shadow-xl',
        lg: 'shadow-lg hover:shadow-2xl',
      };
      return `${baseClass} ${shadowSizes[cardShadowSize] || shadowSizes.sm}`;
    } else if (cardBorderStyle === 'border') {
      return `${baseClass} border-2 border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600`;
    } else {
      return `${baseClass} hover:bg-slate-50 dark:hover:bg-zinc-700/50`;
    }
  };

  const getButtonClassName = () => {
    const buttonColors: Record<string, string> = {
      'gray-900': 'bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700',
      'indigo-600': 'bg-gradient-to-r from-indigo-500 to-indigo-600',
      'blue-600': 'bg-gradient-to-r from-blue-500 to-blue-600',
      'green-600': 'bg-gradient-to-r from-emerald-500 to-emerald-600',
      'purple-600': 'bg-gradient-to-r from-purple-500 to-purple-600',
      'red-600': 'bg-gradient-to-r from-red-500 to-red-600',
    };
    return buttonColors[cardButtonColor] || 'bg-gradient-to-r from-indigo-500 to-indigo-600';
  };

  const getPriceClassName = () => {
    const priceColors: Record<string, string> = {
      'indigo-600': 'text-indigo-600 dark:text-indigo-400',
      'blue-600': 'text-blue-600 dark:text-blue-400',
      'green-600': 'text-emerald-600 dark:text-emerald-400',
      'purple-600': 'text-purple-600 dark:text-purple-400',
      'gray-900': 'text-slate-900 dark:text-slate-100',
      'orange-600': 'text-orange-600 dark:text-orange-400',
    };
    return priceColors[cardPriceColor] || 'text-indigo-600 dark:text-indigo-400';
  };

  return (
    <Card 
      className={getCardClassName()}
      onClick={() => onClick(color)}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Top: Company & Product with Icon */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-slate-900 dark:text-white truncate uppercase">
                {color.variant.product.company}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 truncate uppercase">
                {color.variant.product.productName}
              </div>
            </div>
          </div>

          {/* Color Code Badge, Color Name, Packing Size */}
          <div className="flex items-center gap-2 py-2 flex-wrap">
            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold px-3 py-1 text-sm uppercase border-0 shadow-sm">
              {color.colorCode}
            </Badge>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase">
              {color.colorName} - {color.variant.packingSize}
            </div>
          </div>

          {/* Stock (Left) & Price (Right) Row */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
            <StockQuantity stock={color.stockQuantity} showBorder={showStockBadgeBorder} />
            <div className={`text-xl font-bold font-mono tabular-nums ${getPriceClassName()}`}>
              Rs. {Math.round(parseFloat(getEffectiveRate(color))).toLocaleString()}
              {color.rateOverride && <span className="text-xs text-amber-500 dark:text-amber-400 ml-1">*</span>}
            </div>
          </div>

          {/* Bottom: Add to Cart Button */}
          <Button
            className={`w-full ${getButtonClassName()} text-white text-sm font-medium uppercase border-0 shadow-none`}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(color);
            }}
            data-testid={`button-add-to-cart-${color.id}`}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add to Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
