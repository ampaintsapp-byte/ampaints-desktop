import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle } from "lucide-react";
import type { ColorWithVariantAndProduct } from "@shared/schema";
import { getEffectiveRate } from "@shared/schema";

interface ProductCardProps {
  color: ColorWithVariantAndProduct;
  onAddToCart: (color: ColorWithVariantAndProduct) => void;
  onClick: (color: ColorWithVariantAndProduct) => void;
}

const StockQuantity = ({ stock, required = 0 }: { stock: number; required?: number }) => {
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 10;
  const hasInsufficientStock = required > stock;

  if (isOutOfStock) {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 text-xs px-2 py-1">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Out of Stock
      </Badge>
    );
  } else if (hasInsufficientStock) {
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs px-2 py-1">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Low: {stock} (Need: {required})
      </Badge>
    );
  } else if (isLowStock) {
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs px-2 py-1">
        Low: {stock}
      </Badge>
    );
  } else {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 text-xs px-2 py-1">
        {stock}
      </Badge>
    );
  }
};

export function ProductCard({ color, onAddToCart, onClick }: ProductCardProps) {
  return (
    <Card 
      className="bg-white hover:shadow-lg transition-all cursor-pointer shadow-sm"
      onClick={() => onClick(color)}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Top: Company & Product */}
          <div>
            <div className="text-base font-semibold text-gray-900 truncate uppercase">
              {color.variant.product.company}
            </div>
            <div className="text-sm text-gray-600 truncate uppercase">
              {color.variant.product.productName}
            </div>
          </div>

          {/* One Line: Color Code Badge, Color Name, Packing Size - Left Aligned */}
          <div className="flex items-center gap-2 py-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-semibold px-3 py-1 text-sm uppercase">
              {color.colorCode}
            </Badge>
            <div className="text-sm font-semibold text-gray-900 uppercase">
              {color.colorName} - {color.variant.packingSize}
            </div>
          </div>

          {/* Stock (Left) & Price (Right) Row */}
          <div className="flex items-center justify-between pt-2">
            <StockQuantity stock={color.stockQuantity} />
            <div className="text-xl font-bold text-blue-600">
              Rs. {Math.round(parseFloat(getEffectiveRate(color)))}
              {color.rateOverride && <span className="text-xs text-orange-500 ml-1">*</span>}
            </div>
          </div>

          {/* Bottom: Add to Cart Button */}
          <Button
            className="w-full h-9 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium uppercase shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(color);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add to Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
