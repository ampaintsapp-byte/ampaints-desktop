import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit2, Check, X, TrendingUp, Search, Package, DollarSign, Layers, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { VariantWithProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

const VISIBLE_LIMIT = 50;
const VISIBLE_LIMIT_INCREMENT = 30;

export default function RateManagement() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT);
  const { toast } = useToast();

  const { data: variants = [], isLoading } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
  });

  const updateRateMutation = useMutation({
    mutationFn: async (data: { id: string; rate: number }) => {
      return await apiRequest("PATCH", `/api/variants/${data.id}/rate`, { rate: data.rate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      toast({ title: "Rate updated successfully" });
      setEditingId(null);
      setEditRate("");
    },
    onError: () => {
      toast({ title: "Failed to update rate", variant: "destructive" });
    },
  });

  const startEditing = (id: string, currentRate: string) => {
    setEditingId(id);
    setEditRate(Math.round(parseFloat(currentRate)).toString());
  };

  const saveRate = (id: string) => {
    const rate = parseFloat(editRate);
    if (isNaN(rate) || rate <= 0) {
      toast({ title: "Please enter a valid rate", variant: "destructive" });
      return;
    }
    updateRateMutation.mutate({ id, rate });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditRate("");
  };

  const uniqueCompanies = useMemo(() => {
    const companies = new Set(variants.map(v => v.product.company));
    return Array.from(companies).sort();
  }, [variants]);

  const uniqueProducts = useMemo(() => {
    const products = new Set(variants.map(v => v.product.productName));
    return Array.from(products).sort();
  }, [variants]);

  const uniqueSizes = useMemo(() => {
    const sizes = new Set(variants.map(v => v.packingSize));
    return Array.from(sizes).sort();
  }, [variants]);

  const filteredVariants = useMemo(() => {
    return variants.filter((variant) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || 
        variant.product.company.toLowerCase().includes(query) ||
        variant.product.productName.toLowerCase().includes(query) ||
        variant.packingSize.toLowerCase().includes(query);
      
      const matchesCompany = companyFilter === "all" || variant.product.company === companyFilter;
      const matchesProduct = productFilter === "all" || variant.product.productName === productFilter;
      const matchesSize = sizeFilter === "all" || variant.packingSize === sizeFilter;
      
      return matchesSearch && matchesCompany && matchesProduct && matchesSize;
    });
  }, [variants, searchQuery, companyFilter, productFilter, sizeFilter]);

  const visibleVariants = filteredVariants.slice(0, visibleLimit);

  const stats = useMemo(() => {
    const totalProducts = new Set(variants.map(v => v.productId)).size;
    const totalVariants = variants.length;
    const rates = variants.map(v => parseFloat(v.rate)).filter(r => !isNaN(r));
    const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    const totalCompanies = uniqueCompanies.length;
    return { totalProducts, totalVariants, avgRate, totalCompanies };
  }, [variants, uniqueCompanies]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800" data-testid="text-rate-management-title">
              Rate Management
            </h1>
            <p className="text-sm text-slate-500">Manage pricing for all product variants</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Products</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums">{stats.totalProducts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
              <Layers className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Variants</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums">{stats.totalVariants}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg Rate</p>
              <p className="text-lg font-bold text-amber-600 font-mono tabular-nums">
                Rs. {Math.round(stats.avgRate).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Companies</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums">{stats.totalCompanies}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Card with Filters and Table */}
      <Card className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {/* Filters Header */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-transparent">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by company, product, or size..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-rates"
                className="pl-9 border-slate-200 bg-white"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex gap-2 flex-wrap">
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger data-testid="select-company-filter" className="border-slate-200 bg-white min-w-[150px]">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="all">All Companies</SelectItem>
                  {uniqueCompanies.map((company) => (
                    <SelectItem key={company} value={company}>{company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger data-testid="select-product-filter" className="border-slate-200 bg-white min-w-[150px]">
                  <SelectValue placeholder="Product" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="all">All Products</SelectItem>
                  {uniqueProducts.map((product) => (
                    <SelectItem key={product} value={product}>{product}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger data-testid="select-size-filter" className="border-slate-200 bg-white min-w-[120px]">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="all">All Sizes</SelectItem>
                  {uniqueSizes.map((size) => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(searchQuery || companyFilter !== "all" || productFilter !== "all" || sizeFilter !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setCompanyFilter("all");
                    setProductFilter("all");
                    setSizeFilter("all");
                  }}
                  data-testid="button-clear-filters"
                  className="border-slate-200"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {(searchQuery || companyFilter !== "all" || productFilter !== "all" || sizeFilter !== "all") && (
            <p className="text-sm text-slate-500 mt-3">
              Showing <span className="font-medium text-slate-800">{filteredVariants.length}</span> of {variants.length} variants
            </p>
          )}
        </div>

        {/* Table */}
        {filteredVariants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-100 rounded-2xl mb-4">
              <TrendingUp className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {variants.length === 0 ? "No products found" : "No results found"}
            </h3>
            <p className="text-sm text-slate-500">
              {variants.length === 0 
                ? "Add products to manage their rates"
                : "Try adjusting your filters"
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Company</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Rate (Rs.)</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleVariants.map((variant) => (
                  <TableRow 
                    key={variant.id}
                    data-testid={`rate-row-${variant.id}`}
                    className="hover:bg-slate-50"
                  >
                    <TableCell>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        {variant.product.company}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{variant.product.productName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                        {variant.packingSize}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === variant.id ? (
                        <Input
                          type="number"
                          step="1"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          className="w-28 text-right border-slate-200 ml-auto"
                          data-testid={`input-edit-rate-${variant.id}`}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRate(variant.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                      ) : (
                        <span className="font-mono font-semibold text-indigo-600 tabular-nums">
                          Rs. {Math.round(parseFloat(variant.rate)).toLocaleString('en-IN')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === variant.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => saveRate(variant.id)}
                            disabled={updateRateMutation.isPending}
                            data-testid={`button-save-rate-${variant.id}`}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelEditing}
                            disabled={updateRateMutation.isPending}
                            data-testid={`button-cancel-edit-${variant.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditing(variant.id, variant.rate)}
                          data-testid={`button-edit-rate-${variant.id}`}
                          className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Load More Button */}
        {filteredVariants.length > visibleLimit && (
          <div className="flex justify-center p-4 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
              className="border-slate-200"
            >
              Load More ({filteredVariants.length - visibleLimit} remaining)
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
