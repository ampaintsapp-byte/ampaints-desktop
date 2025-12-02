import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import { Edit2, Check, X, TrendingUp, Search, Filter, Package, DollarSign, Layers, Tag, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { VariantWithProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function RateManagement() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
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

  const groupedVariants = filteredVariants.reduce((acc, variant) => {
    const key = `${variant.product.company}|${variant.product.productName}`;
    if (!acc[key]) {
      acc[key] = {
        company: variant.product.company,
        productName: variant.product.productName,
        variants: [],
      };
    }
    acc[key].variants.push(variant);
    return acc;
  }, {} as Record<string, { company: string; productName: string; variants: VariantWithProduct[] }>);

  const groupedArray = Object.values(groupedVariants);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="p-6 space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-6 text-white shadow-lg">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <TrendingUp className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-rate-management-title">
                Rate Management
              </h1>
              <p className="text-white/80 text-sm">Manage pricing for all product variants</p>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-xl" />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Products</span>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {stats.totalProducts}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total products</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Variants</span>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {stats.totalVariants}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total variants</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Average Rate</span>
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                Rs. {Math.round(stats.avgRate).toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all variants</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Companies</span>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {stats.totalCompanies}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total companies</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card className="rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Filter className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <span className="font-medium text-slate-900 dark:text-white">Filters</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by company, product, or size..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-rates"
                className="pl-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-xl"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 block">Company</label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger data-testid="select-company-filter" className="border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
                    <SelectItem value="all">All Companies</SelectItem>
                    {uniqueCompanies.map((company) => (
                      <SelectItem key={company} value={company}>
                        {company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 block">Product</label>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger data-testid="select-product-filter" className="border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
                    <SelectItem value="all">All Products</SelectItem>
                    {uniqueProducts.map((product) => (
                      <SelectItem key={product} value={product}>
                        {product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 block">Packing Size</label>
                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger data-testid="select-size-filter" className="border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
                    <SelectItem value="all">All Sizes</SelectItem>
                    {uniqueSizes.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(searchQuery || companyFilter !== "all" || productFilter !== "all" || sizeFilter !== "all") && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing <span className="font-medium text-slate-900 dark:text-white">{filteredVariants.length}</span> of {variants.length} variants
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setCompanyFilter("all");
                    setProductFilter("all");
                    setSizeFilter("all");
                  }}
                  data-testid="button-clear-filters"
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variants List */}
        {groupedArray.length === 0 ? (
          <Card className="rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
                <TrendingUp className="h-12 w-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {variants.length === 0 ? "No products found" : "No results found"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {variants.length === 0 
                  ? "Add products to manage their rates"
                  : "Try adjusting your filters"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedArray.map((group) => (
              <Card 
                key={`${group.company}|${group.productName}`}
                className="rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Product Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                      <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20">
                        {group.company}
                      </Badge>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{group.productName}</h3>
                      <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-0">
                        {group.variants.length} {group.variants.length === 1 ? 'size' : 'sizes'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Variants Grid */}
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.variants.map((variant) => (
                      <div 
                        key={variant.id}
                        data-testid={`rate-row-${variant.id}`}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-700/50 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-slate-100 dark:border-slate-700">
                            <Tag className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div>
                            <Badge variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                              {variant.packingSize}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {editingId === variant.id ? (
                            <>
                              <Input
                                type="number"
                                step="1"
                                value={editRate}
                                onChange={(e) => setEditRate(e.target.value)}
                                className="w-24 text-right border-slate-200 dark:border-slate-700 rounded-lg"
                                data-testid={`input-edit-rate-${variant.id}`}
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => saveRate(variant.id)}
                                disabled={updateRateMutation.isPending}
                                data-testid={`button-save-rate-${variant.id}`}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEditing}
                                disabled={updateRateMutation.isPending}
                                data-testid={`button-cancel-edit-${variant.id}`}
                                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                                Rs. {Math.round(parseFloat(variant.rate)).toLocaleString('en-IN')}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditing(variant.id, variant.rate)}
                                data-testid={`button-edit-rate-${variant.id}`}
                                className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
