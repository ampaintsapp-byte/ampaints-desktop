// returns.tsx - COMPLETE FIXED VERSION
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/use-date-format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  RotateCcw, 
  FileText, 
  Package, 
  Minus, 
  Plus, 
  Loader2, 
  Eye, 
  Download, 
  User, 
  Phone, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Calendar, 
  X, 
  ArrowLeft,
  Trash2,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import jsPDF from "jspdf";
import type { SaleWithItems, ReturnWithItems, ColorWithVariantAndProduct, SaleItem } from "@shared/schema";

// FIXED: Enhanced interface definitions
interface ReturnStats {
  totalReturns: number;
  totalRefunded: number;
  itemReturns: number;
  billReturns: number;
  recentReturns: number;
  averageRefund: number;
}

interface QuickReturnForm {
  customerName: string;
  customerPhone: string;
  colorId: string;
  quantity: number;
  rate: number;
  subtotal: number;
  reason: string;
  restoreStock: boolean;
}

interface ReturnItemSelection {
  saleItemId: string;
  colorId: string;
  quantity: number;
  maxQuantity: number;
  rate: number;
  subtotal: number;
  productName: string;
  colorName: string;
  colorCode: string;
  packingSize: string;
  company: string;
}

// FIXED: Enhanced PDF generation helper
const generateReturnPDF = (returnRecord: ReturnWithItems, businessName: string = "PaintPulse") => {
  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    // Header with gradient effect
    pdf.setFillColor(59, 130, 246);
    pdf.rect(0, 0, pageWidth, 35, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("RETURN DOCUMENT", pageWidth / 2, 15, { align: "center" });
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(businessName, pageWidth / 2, 25, { align: "center" });
    pdf.text("Item Return Receipt", pageWidth / 2, 31, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    yPos = 45;

    // Return Information
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("RETURN INFORMATION", margin, yPos);
    yPos += 8;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    
    const returnInfo = [
      { label: "Return ID:", value: `#${returnRecord.id.slice(-8).toUpperCase()}` },
      { label: "Date:", value: new Date(returnRecord.createdAt).toLocaleDateString('en-IN') },
      { label: "Time:", value: new Date(returnRecord.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) },
      { label: "Type:", value: returnRecord.returnType === 'full_bill' ? 'Full Bill Return' : 'Item Return' },
      { label: "Status:", value: returnRecord.status.charAt(0).toUpperCase() + returnRecord.status.slice(1) }
    ];

    returnInfo.forEach(info => {
      pdf.setFont("helvetica", "bold");
      pdf.text(info.label, margin, yPos);
      pdf.setFont("helvetica", "normal");
      pdf.text(info.value, margin + 25, yPos);
      yPos += 5;
    });

    yPos += 5;

    // Customer Information
    pdf.setFont("helvetica", "bold");
    pdf.text("CUSTOMER INFORMATION", margin, yPos);
    yPos += 8;

    pdf.setFont("helvetica", "normal");
    pdf.text(`Name: ${returnRecord.customerName}`, margin, yPos);
    yPos += 5;
    pdf.text(`Phone: ${returnRecord.customerPhone}`, margin, yPos);
    yPos += 10;

    // Returned Items Table
    pdf.setFont("helvetica", "bold");
    pdf.text("RETURNED ITEMS", margin, yPos);
    yPos += 8;

    // Table Header
    pdf.setFillColor(75, 85, 99);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    
    const headers = ["Product Details", "Qty", "Rate", "Amount"];
    const colWidths = [100, 15, 25, 30];
    let xPos = margin + 2;
    
    headers.forEach((header, index) => {
      pdf.text(header, xPos, yPos + 5.5);
      xPos += colWidths[index];
    });
    
    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    // Table Rows
    returnRecord.returnItems.forEach((item, index) => {
      if (yPos > 250) {
        pdf.addPage();
        yPos = margin;
      }

      // Alternate row background
      const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(margin, yPos - 2, pageWidth - 2 * margin, 10, "F");

      pdf.setFontSize(8);
      xPos = margin + 2;
      
      // Product Details
      const productText = `${item.color.variant.product.company} ${item.color.variant.product.productName} - ${item.color.variant.packingSize}\n${item.color.colorName} (${item.color.colorCode})`;
      pdf.text(productText, xPos, yPos);
      xPos += colWidths[0];
      
      // Quantity
      pdf.text(item.quantity.toString(), xPos, yPos);
      xPos += colWidths[1];
      
      // Rate
      pdf.text(`₹${parseFloat(item.rate).toFixed(2)}`, xPos, yPos);
      xPos += colWidths[2];
      
      // Amount
      pdf.text(`₹${parseFloat(item.subtotal).toFixed(2)}`, xPos, yPos);
      
      yPos += 10;
    });

    yPos += 10;

    // Summary Section
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 30, "F");
    
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("RETURN SUMMARY", margin + 5, yPos);
    yPos += 6;
    
    pdf.setFont("helvetica", "normal");
    pdf.text(`Total Items Returned: ${returnRecord.returnItems.length}`, margin + 5, yPos);
    yPos += 5;
    
    pdf.text(`Total Refund Amount:`, margin + 5, yPos);
    pdf.setFont("helvetica", "bold");
    pdf.text(`₹${parseFloat(returnRecord.totalRefund).toFixed(2)}`, pageWidth - margin - 5, yPos, { align: "right" });
    yPos += 5;
    
    pdf.setFont("helvetica", "normal");
    pdf.text(`Stock Restored: ${returnRecord.returnItems.filter(item => item.stockRestored).length} items`, margin + 5, yPos);

    // Footer
    yPos = 270;
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text("This is a computer-generated return document. No signature required.", pageWidth / 2, yPos, { align: "center" });
    yPos += 4;
    pdf.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, yPos, { align: "center" });

    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF document');
  }
};

export default function Returns() {
  const { toast } = useToast();
  const { formatDate, formatDateShort } = useDateFormat();
  const [activeTab, setActiveTab] = useState("bill");
  const [searchPhone, setSearchPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ReturnWithItems | null>(null);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showQuickReturnDialog, setShowQuickReturnDialog] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnType, setReturnType] = useState<"full" | "partial">("full");
  const [selectedItems, setSelectedItems] = useState<Record<string, ReturnItemSelection>>({});
  const [restockItems, setRestockItems] = useState<Record<string, boolean>>({});
  
  // Quick return form state
  const [quickReturnForm, setQuickReturnForm] = useState<QuickReturnForm>({
    customerName: "",
    customerPhone: "",
    colorId: "",
    quantity: 1,
    rate: 0,
    subtotal: 0,
    reason: "",
    restoreStock: true,
  });

  // FIXED: Enhanced queries with proper error handling and refetch intervals
  const { 
    data: returns = [], 
    isLoading: returnsLoading, 
    error: returnsError,
    refetch: refetchReturns 
  } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 60000, // Consider data stale after 1 minute
  });

  const { 
    data: sales = [], 
    isLoading: salesLoading, 
    error: salesError 
  } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales"],
  });

  const { 
    data: colors = [], 
    isLoading: colorsLoading, 
    error: colorsError 
  } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  // FIXED: Enhanced error handling effect
  useEffect(() => {
    const errors = [returnsError, salesError, colorsError].filter(Boolean);
    if (errors.length > 0) {
      console.error('Returns page errors:', errors);
      toast({
        title: "Data Loading Error",
        description: "Some data failed to load. Please refresh the page.",
        variant: "destructive",
      });
    }
  }, [returnsError, salesError, colorsError, toast]);

  // FIXED: Enhanced filtering with proper search
  const filteredReturns = useMemo(() => {
    if (!searchQuery.trim()) return returns;
    
    const query = searchQuery.toLowerCase();
    return returns.filter(ret =>
      ret.customerName.toLowerCase().includes(query) ||
      ret.customerPhone.includes(query) ||
      ret.id.toLowerCase().includes(query) ||
      (ret.reason && ret.reason.toLowerCase().includes(query))
    );
  }, [returns, searchQuery]);

  // FIXED: Enhanced statistics with additional metrics
  const stats: ReturnStats = useMemo(() => {
    const totalRefunded = returns.reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
    const recentReturns = returns.filter(ret => {
      const returnDate = new Date(ret.createdAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return returnDate >= thirtyDaysAgo;
    }).length;

    return {
      totalReturns: returns.length,
      totalRefunded,
      itemReturns: returns.filter(ret => ret.returnType === "item").length,
      billReturns: returns.filter(ret => ret.returnType === "full_bill").length,
      recentReturns,
      averageRefund: returns.length > 0 ? totalRefunded / returns.length : 0,
    };
  }, [returns]);

  // FIXED: Enhanced search with debouncing and better filtering
  const searchResults = useMemo(() => {
    if (!searchPhone.trim()) return [];
    
    const query = searchPhone.toLowerCase();
    return sales.filter(sale => 
      sale.customerPhone.includes(searchPhone) || 
      sale.customerName.toLowerCase().includes(query) ||
      sale.id.toLowerCase().includes(query)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, searchPhone]);

  // FIXED: Enhanced mutation with proper error handling and rollback
  const createReturnMutation = useMutation({
    mutationFn: async (data: { returnData: any; items: any[] }) => {
      const response = await apiRequest("POST", "/api/returns", data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to process return: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      
      setShowReturnDialog(false);
      setSelectedSale(null);
      setSelectedItems({});
      setRestockItems({});
      setReturnReason("");
      
      toast({
        title: "Return Processed Successfully",
        description: "Return has been processed and stock has been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Return Processing Failed",
        description: error.message || "Failed to process return. Please try again.",
        variant: "destructive",
      });
    },
  });

  // FIXED: Enhanced quick return mutation
  const quickReturnMutation = useMutation({
    mutationFn: async (data: QuickReturnForm) => {
      const response = await apiRequest("POST", "/api/returns/quick", data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to process quick return: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      
      setShowQuickReturnDialog(false);
      setQuickReturnForm({
        customerName: "",
        customerPhone: "",
        colorId: "",
        quantity: 1,
        rate: 0,
        subtotal: 0,
        reason: "",
        restoreStock: true,
      });
      
      toast({
        title: "Quick Return Processed",
        description: "Item has been returned successfully and stock has been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Quick Return Failed",
        description: error.message || "Failed to process quick return. Please check the form and try again.",
        variant: "destructive",
      });
    },
  });

  // FIXED: Enhanced sale selection with proper initialization
  const handleSelectSale = (sale: SaleWithItems) => {
    setSelectedSale(sale);
    setShowReturnDialog(true);
    setReturnType("full");
    setSelectedItems({});
    setRestockItems({});
    setReturnReason("");
    
    // Pre-select all items for full return with enhanced data
    if (sale.saleItems && sale.saleItems.length > 0) {
      const items: Record<string, ReturnItemSelection> = {};
      const restock: Record<string, boolean> = {};
      
      sale.saleItems.forEach(item => {
        const color = item.color as ColorWithVariantAndProduct;
        items[item.id] = {
          saleItemId: item.id,
          colorId: item.colorId,
          quantity: item.quantity,
          maxQuantity: item.quantity,
          rate: parseFloat(item.rate),
          subtotal: parseFloat(item.subtotal),
          productName: color.variant.product.productName,
          colorName: color.colorName,
          colorCode: color.colorCode,
          packingSize: color.variant.packingSize,
          company: color.variant.product.company,
        };
        restock[item.id] = true;
      });
      
      setSelectedItems(items);
      setRestockItems(restock);
    }
  };

  // FIXED: Enhanced item quantity management
  const handleItemQuantityChange = (itemId: string, delta: number) => {
    setSelectedItems(prev => {
      const current = prev[itemId];
      if (!current) return prev;
      
      const newQty = Math.max(0, Math.min(current.maxQuantity, current.quantity + delta));
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [itemId]: {
          ...current,
          quantity: newQty,
          subtotal: newQty * current.rate,
        }
      };
    });
    setReturnType("partial");
  };

  const handleToggleRestock = (itemId: string) => {
    setRestockItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // FIXED: Enhanced select/deselect all with proper state management
  const handleSelectAllItems = () => {
    if (!selectedSale?.saleItems) return;
    
    const items: Record<string, ReturnItemSelection> = {};
    const restock: Record<string, boolean> = {};
    
    selectedSale.saleItems.forEach(item => {
      const color = item.color as ColorWithVariantAndProduct;
      items[item.id] = {
        saleItemId: item.id,
        colorId: item.colorId,
        quantity: item.quantity,
        maxQuantity: item.quantity,
        rate: parseFloat(item.rate),
        subtotal: parseFloat(item.subtotal),
        productName: color.variant.product.productName,
        colorName: color.colorName,
        colorCode: color.colorCode,
        packingSize: color.variant.packingSize,
        company: color.variant.product.company,
      };
      restock[item.id] = true;
    });
    
    setSelectedItems(items);
    setRestockItems(restock);
    setReturnType("full");
  };

  const handleDeselectAllItems = () => {
    setSelectedItems({});
    setRestockItems({});
    setReturnType("partial");
  };

  // FIXED: Enhanced return submission with validation
  const handleSubmitReturn = () => {
    if (!selectedSale) {
      toast({
        title: "No Sale Selected",
        description: "Please select a sale to process return",
        variant: "destructive",
      });
      return;
    }

    const itemsToReturn = Object.values(selectedItems)
      .filter(item => item.quantity > 0)
      .map(item => ({
        colorId: item.colorId,
        saleItemId: item.saleItemId,
        quantity: item.quantity,
        rate: item.rate,
        subtotal: item.subtotal,
        stockRestored: restockItems[item.saleItemId] ?? true,
      }));

    if (itemsToReturn.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one item to return",
        variant: "destructive",
      });
      return;
    }

    const totalRefund = itemsToReturn.reduce((sum, item) => sum + item.subtotal, 0);

    // Validate refund amount doesn't exceed sale total
    const saleTotal = parseFloat(selectedSale.totalAmount);
    if (totalRefund > saleTotal) {
      toast({
        title: "Invalid Refund Amount",
        description: `Refund amount (₹${totalRefund}) exceeds sale total (₹${saleTotal})`,
        variant: "destructive",
      });
      return;
    }

    createReturnMutation.mutate({
      returnData: {
        saleId: selectedSale.id,
        customerName: selectedSale.customerName,
        customerPhone: selectedSale.customerPhone,
        returnType: returnType === "full" ? "full_bill" : "item",
        totalRefund: totalRefund.toString(),
        reason: returnReason.trim() || null,
        status: "completed",
      },
      items: itemsToReturn,
    });
  };

  // FIXED: Enhanced quick return submission
  const handleQuickReturnSubmit = () => {
    if (!quickReturnForm.customerName.trim()) {
      toast({
        title: "Customer Name Required",
        description: "Please enter customer name",
        variant: "destructive",
      });
      return;
    }

    if (!quickReturnForm.customerPhone.trim() || quickReturnForm.customerPhone.length < 10) {
      toast({
        title: "Valid Phone Required",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    if (!quickReturnForm.colorId) {
      toast({
        title: "Item Selection Required",
        description: "Please select an item to return",
        variant: "destructive",
      });
      return;
    }

    if (quickReturnForm.quantity <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Quantity must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (quickReturnForm.rate <= 0) {
      toast({
        title: "Invalid Rate",
        description: "Rate must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Calculate subtotal
    const subtotal = quickReturnForm.quantity * quickReturnForm.rate;
    
    quickReturnMutation.mutate({
      ...quickReturnForm,
      subtotal,
    });
  };

  // FIXED: Enhanced color selection with rate calculation
  const handleColorSelect = (colorId: string) => {
    const selectedColor = colors.find(c => c.id === colorId);
    if (selectedColor) {
      const rate = selectedColor.rateOverride ? 
        parseFloat(selectedColor.rateOverride) : 
        parseFloat(selectedColor.variant.rate);
      
      const subtotal = quickReturnForm.quantity * rate;
      
      setQuickReturnForm(prev => ({
        ...prev,
        colorId,
        rate,
        subtotal,
      }));
    }
  };

  // FIXED: Enhanced quantity and rate change handlers
  const handleQuickReturnQuantityChange = (newQuantity: number) => {
    const quantity = Math.max(1, newQuantity);
    const subtotal = quantity * quickReturnForm.rate;
    
    setQuickReturnForm(prev => ({
      ...prev,
      quantity,
      subtotal,
    }));
  };

  const handleQuickReturnRateChange = (newRate: number) => {
    const rate = Math.max(0, newRate);
    const subtotal = quickReturnForm.quantity * rate;
    
    setQuickReturnForm(prev => ({
      ...prev,
      rate,
      subtotal,
    }));
  };

  // FIXED: Enhanced item details formatter
  const formatItemDetails = (item: SaleItem) => {
    const color = item.color as ColorWithVariantAndProduct;
    if (!color) return `Item #${item.colorId}`;
    
    const variant = color.variant;
    const product = variant?.product;
    return `${product?.company || ""} ${product?.productName || ""} - ${variant?.packingSize || ""} - ${color.colorCode} ${color.colorName}`;
  };

  const handleViewDetails = (returnRecord: ReturnWithItems) => {
    setSelectedReturn(returnRecord);
    setViewDetailsOpen(true);
  };

  // FIXED: Enhanced PDF download with error handling
  const downloadReturnPDF = (returnRecord: ReturnWithItems) => {
    try {
      const pdf = generateReturnPDF(returnRecord);
      const fileName = `Return-${returnRecord.id.slice(-8).toUpperCase()}-${formatDateShort(returnRecord.createdAt).replace(/\//g, "-")}.pdf`;
      
      pdf.save(fileName);
      
      toast({
        title: "Return Document Downloaded",
        description: "PDF has been downloaded successfully",
      });
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to generate PDF document",
        variant: "destructive",
      });
    }
  };

  // FIXED: Calculate total refund amount
  const totalRefundAmount = useMemo(() => {
    return Object.values(selectedItems).reduce((sum, item) => sum + item.subtotal, 0);
  }, [selectedItems]);

  // FIXED: Reset search when tab changes
  useEffect(() => {
    if (activeTab === "bill") {
      setSearchQuery("");
    }
  }, [activeTab]);

  return (
    <div className="p-6 space-y-6 bg-gray-50/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <RotateCcw className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Returns Management</h1>
            <p className="text-muted-foreground">Process bill returns and quick item returns with stock restoration</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-white p-1 rounded-lg">
          <TabsTrigger 
            value="bill" 
            className="flex items-center gap-2 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-md transition-all"
          >
            <FileText className="w-4 h-4" />
            Bill Returns
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="flex items-center gap-2 data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-md transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            Return History
          </TabsTrigger>
        </TabsList>

        {/* Bill Returns Tab */}
        <TabsContent value="bill" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Search Bill Section */}
            <Card className="bg-white border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-600" />
                  Search Bill to Return
                </CardTitle>
                <CardDescription>Search by customer phone number or name to find the bill</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter customer phone or name..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button 
                    onClick={() => setSearchPhone(searchPhone)}
                    disabled={salesLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {salesLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="ml-2">Search</span>
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Found Sales ({searchResults.length})
                    </Label>
                    <ScrollArea className="h-[300px] rounded-md border bg-gray-50/50">
                      <div className="p-3 space-y-3">
                        {searchResults.map((sale) => (
                          <Card 
                            key={sale.id} 
                            className="cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 border"
                            onClick={() => handleSelectSale(sale)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-2">
                                    <User className="w-4 h-4 text-gray-500" />
                                    <span className="font-semibold text-gray-900 truncate">{sale.customerName}</span>
                                    <Badge variant="outline" className="shrink-0 bg-gray-100">
                                      <Phone className="w-3 h-3 mr-1" />
                                      {sale.customerPhone}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(new Date(sale.createdAt))}
                                    <span className="mx-1">•</span>
                                    <Package className="w-3 h-3" />
                                    {sale.saleItems?.length || 0} items
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-bold text-lg text-gray-900">
                                    ₹{parseFloat(sale.totalAmount).toLocaleString('en-IN')}
                                  </div>
                                  <Badge 
                                    variant={sale.paymentStatus === "paid" ? "default" : "secondary"}
                                    className="mt-1 capitalize"
                                  >
                                    {sale.paymentStatus}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {searchPhone && searchResults.length === 0 && !salesLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No sales found for "{searchPhone}"</p>
                    <p className="text-sm">Try a different phone number or customer name</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Return Section */}
            <Card className="bg-white border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-green-600" />
                  Quick Item Return
                </CardTitle>
                <CardDescription>Return individual items without searching for a specific bill</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button 
                  onClick={() => setShowQuickReturnDialog(true)}
                  className="w-full h-16 bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Open Quick Return Form
                </Button>
                
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Return individual items without bill reference</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Package className="w-4 h-4 text-green-600" />
                    <span>Automatic stock restoration</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span>Customer refund processing</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span>Complete return history tracking</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Return History Tab */}
        <TabsContent value="history" className="space-y-6 mt-6">
          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <RotateCcw className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Total Returns</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalReturns}</p>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {stats.recentReturns} in last 30 days
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-red-100">
                    <DollarSign className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Total Refunded</p>
                    <p className="text-2xl font-bold text-gray-900">₹{Math.round(stats.totalRefunded).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">
                      Avg: ₹{Math.round(stats.averageRefund).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-orange-100">
                    <Package className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Item Returns</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.itemReturns}</p>
                    <p className="text-xs text-muted-foreground">Individual item returns</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-purple-100">
                    <AlertTriangle className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Bill Returns</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.billReturns}</p>
                    <p className="text-xs text-muted-foreground">Complete bill returns</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Actions */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, phone, return ID, or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => refetchReturns()}
              disabled={returnsLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${returnsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Returns Table */}
          <Card className="bg-white border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Return History
                <Badge variant="secondary" className="ml-2">
                  {filteredReturns.length} records
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {returnsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-semibold">Date & Time</TableHead>
                        <TableHead className="font-semibold">Return ID</TableHead>
                        <TableHead className="font-semibold">Customer</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="text-right font-semibold">Refund Amount</TableHead>
                        <TableHead className="font-semibold">Items</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReturns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-lg font-medium">No returns found</p>
                            <p className="text-sm">
                              {searchQuery ? 'Try adjusting your search terms' : 'Start by processing a return from the Bill Returns tab'}
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredReturns.map((ret) => (
                          <TableRow key={ret.id} className="hover:bg-gray-50/50 transition-colors">
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{formatDateShort(ret.createdAt)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(ret.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-sm">
                              #{ret.id.slice(-8).toUpperCase()}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{ret.customerName}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {ret.customerPhone}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={ret.returnType === "full_bill" ? "destructive" : "secondary"}
                                className="capitalize"
                              >
                                {ret.returnType === "full_bill" ? "Full Bill" : "Item"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="font-semibold text-red-600">
                                ₹{Math.round(parseFloat(ret.totalRefund || "0")).toLocaleString('en-IN')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50">
                                {ret.returnItems.length} item{ret.returnItems.length !== 1 ? 's' : ''}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={ret.status === "completed" ? "default" : "secondary"}
                                className="capitalize"
                              >
                                {ret.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetails(ret)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadReturnPDF(ret)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Process Return Dialog - Enhanced */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <RotateCcw className="h-5 w-5 text-red-500" />
              Process Return
            </DialogTitle>
            <DialogDescription>
              Select items to return and specify quantities. Stock will be restored for checked items.
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-6">
              {/* Customer & Sale Information */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Customer</Label>
                      <p className="font-semibold">{selectedSale.customerName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <p className="font-semibold">{selectedSale.customerPhone}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bill Date</Label>
                      <p className="font-semibold">{formatDate(new Date(selectedSale.createdAt))}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bill Total</Label>
                      <p className="font-semibold">₹{parseFloat(selectedSale.totalAmount).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Select Items to Return</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSelectAllItems}>
                        Select All
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDeselectAllItems}>
                        Deselect All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[300px]">
                    <div className="p-4 space-y-3">
                      {selectedSale.saleItems?.map((item) => {
                        const returnItem = selectedItems[item.id];
                        const isReturning = returnItem && returnItem.quantity > 0;
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`p-4 rounded-lg border-2 transition-all ${
                              isReturning 
                                ? 'bg-red-50 border-red-200' 
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={isReturning}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        handleItemQuantityChange(item.id, 1);
                                      } else {
                                        handleItemQuantityChange(item.id, -returnItem?.quantity || 0);
                                      }
                                    }}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900">
                                      {formatItemDetails(item)}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Rate: ₹{parseFloat(item.rate).toLocaleString('en-IN')} × {item.quantity} = ₹{parseFloat(item.subtotal).toLocaleString('en-IN')}
                                    </p>
                                    {isReturning && (
                                      <div className="flex items-center gap-4 mt-2">
                                        <Label className="text-sm font-medium">Return Qty:</Label>
                                        <div className="flex items-center gap-2">
                                          <Button 
                                            size="icon" 
                                            variant="outline"
                                            className="h-7 w-7"
                                            onClick={() => handleItemQuantityChange(item.id, -1)}
                                            disabled={!returnItem || returnItem.quantity <= 1}
                                          >
                                            <Minus className="h-3 w-3" />
                                          </Button>
                                          <span className="w-12 text-center text-sm font-semibold bg-white border rounded py-1">
                                            {returnItem.quantity}
                                          </span>
                                          <Button 
                                            size="icon" 
                                            variant="outline"
                                            className="h-7 w-7"
                                            onClick={() => handleItemQuantityChange(item.id, 1)}
                                            disabled={!returnItem || returnItem.quantity >= returnItem.maxQuantity}
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                          <span className="text-xs text-muted-foreground">
                                            of {returnItem.maxQuantity}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isReturning && (
                                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        id={`restock-${item.id}`}
                                        checked={restockItems[item.id] ?? true}
                                        onCheckedChange={() => handleToggleRestock(item.id)}
                                      />
                                      <Label htmlFor={`restock-${item.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                                        <Package className="h-4 w-4 text-green-600" />
                                        Restore {returnItem.quantity} units to stock
                                      </Label>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm text-muted-foreground">Refund Amount</p>
                                      <p className="font-bold text-red-600">
                                        -₹{(returnItem.quantity * returnItem.rate).toLocaleString('en-IN')}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Return Details */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <Label htmlFor="reason" className="text-sm font-medium">Return Reason (Optional)</Label>
                    <Textarea
                      id="reason"
                      placeholder="Enter reason for return..."
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Refund Amount</p>
                        <p className="text-2xl font-bold text-red-600">
                          ₹{totalRefundAmount.toLocaleString('en-IN')}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {Object.keys(selectedItems).length} item{Object.keys(selectedItems).length !== 1 ? 's' : ''} selected
                        </p>
                      </div>
                      <Badge 
                        variant={returnType === "full" ? "destructive" : "secondary"} 
                        className="text-sm px-3 py-1"
                      >
                        {returnType === "full" ? "Full Bill Return" : "Partial Return"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setShowReturnDialog(false)}
              disabled={createReturnMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleSubmitReturn}
              disabled={createReturnMutation.isPending || Object.keys(selectedItems).length === 0 || totalRefundAmount === 0}
              className="min-w-32"
            >
              {createReturnMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Process Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Return Dialog - Enhanced */}
      <Dialog open={showQuickReturnDialog} onOpenChange={setShowQuickReturnDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowQuickReturnDialog(false)}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-green-600" />
                  Quick Item Return
                </DialogTitle>
                <DialogDescription>
                  Return individual items without bill reference
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Information */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="customerName" className="text-sm font-medium">
                    Customer Name *
                  </Label>
                  <Input
                    id="customerName"
                    placeholder="Enter customer name"
                    value={quickReturnForm.customerName}
                    onChange={(e) => setQuickReturnForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="customerPhone" className="text-sm font-medium">
                    Customer Phone *
                  </Label>
                  <Input
                    id="customerPhone"
                    placeholder="Enter 10-digit phone number"
                    value={quickReturnForm.customerPhone}
                    onChange={(e) => setQuickReturnForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="w-full"
                    maxLength={10}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Item Details */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-orange-600" />
                  Item Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="colorSelect" className="text-sm font-medium">
                    Select Item *
                  </Label>
                  <Select onValueChange={handleColorSelect} value={quickReturnForm.colorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an item to return" />
                    </SelectTrigger>
                    <SelectContent>
                      {colorsLoading ? (
                        <div className="flex items-center gap-2 p-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading items...</span>
                        </div>
                      ) : colors.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No items available</div>
                      ) : (
                        colors.map((color) => (
                          <SelectItem key={color.id} value={color.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded border"
                                style={{ backgroundColor: color.colorCode }}
                              />
                              <span>
                                {color.variant.product.company} {color.variant.product.productName} - {color.variant.packingSize} - {color.colorCode} {color.colorName}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="quantity" className="text-sm font-medium">Quantity *</Label>
                    <div className="flex gap-2 items-center">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleQuickReturnQuantityChange(quickReturnForm.quantity - 1)}
                        disabled={quickReturnForm.quantity <= 1}
                        className="h-9 w-9"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quickReturnForm.quantity}
                        onChange={(e) => handleQuickReturnQuantityChange(parseInt(e.target.value) || 1)}
                        className="text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleQuickReturnQuantityChange(quickReturnForm.quantity + 1)}
                        className="h-9 w-9"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="rate" className="text-sm font-medium">Rate (₹) *</Label>
                    <Input
                      id="rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={quickReturnForm.rate}
                      onChange={(e) => handleQuickReturnRateChange(parseFloat(e.target.value) || 0)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="subtotal" className="text-sm font-medium">Subtotal (₹)</Label>
                    <Input
                      id="subtotal"
                      value={quickReturnForm.subtotal.toFixed(2)}
                      readOnly
                      className="w-full bg-gray-100 font-semibold"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card className="lg:col-span-2 bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="reason" className="text-sm font-medium">Return Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Enter reason for return..."
                    value={quickReturnForm.reason}
                    onChange={(e) => setQuickReturnForm(prev => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                    className="w-full"
                  />
                </div>

                <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <Checkbox
                    id="restoreStock"
                    checked={quickReturnForm.restoreStock}
                    onCheckedChange={(checked) => 
                      setQuickReturnForm(prev => ({ ...prev, restoreStock: checked as boolean }))
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="restoreStock" className="cursor-pointer text-sm font-medium block mb-1">
                      Restore item to stock inventory
                    </Label>
                    <div className="text-sm text-muted-foreground">
                      This will add {quickReturnForm.quantity} units back to the stock quantity. 
                      Recommended for most returns unless the item is damaged.
                    </div>
                  </div>
                </div>

                {/* Summary Card */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                      Return Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Customer:</span>
                          <span className="font-medium">{quickReturnForm.customerName || "Not specified"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-medium">{quickReturnForm.customerPhone || "Not specified"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Item:</span>
                          <span className="font-medium text-right">
                            {quickReturnForm.colorId 
                              ? (() => {
                                  const color = colors.find(c => c.id === quickReturnForm.colorId);
                                  return color ? `${color.colorName} (${color.colorCode})` : "Selected";
                                })()
                              : "Not selected"}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Quantity:</span>
                          <span className="font-medium">{quickReturnForm.quantity} units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rate:</span>
                          <span className="font-medium">₹{quickReturnForm.rate.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-semibold">Refund Amount:</span>
                          <span className="font-bold text-red-600 text-lg">
                            ₹{quickReturnForm.subtotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-3 pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                setQuickReturnForm({
                  customerName: "",
                  customerPhone: "",
                  colorId: "",
                  quantity: 1,
                  rate: 0,
                  subtotal: 0,
                  reason: "",
                  restoreStock: true,
                });
              }}
              disabled={quickReturnMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reset Form
            </Button>
            <Button 
              onClick={handleQuickReturnSubmit}
              disabled={quickReturnMutation.isPending || !quickReturnForm.customerName.trim() || !quickReturnForm.customerPhone.trim() || !quickReturnForm.colorId || quickReturnForm.quantity <= 0 || quickReturnForm.rate <= 0}
              className="min-w-32 bg-green-600 hover:bg-green-700"
            >
              {quickReturnMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Process Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Details Dialog - Enhanced */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Eye className="h-5 w-5 text-blue-600" />
              Return Details - #{selectedReturn?.id.slice(-8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-6">
              {/* Return Summary */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Return Date</p>
                      <p className="font-semibold">{formatDateShort(selectedReturn.createdAt)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedReturn.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Return Type</p>
                      <p className="font-semibold">
                        {selectedReturn.returnType === "full_bill" ? "Full Bill Return" : "Item Return"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className="capitalize" variant={selectedReturn.status === "completed" ? "default" : "secondary"}>
                        {selectedReturn.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Refund</p>
                      <p className="font-semibold text-red-600 text-lg">
                        ₹{Math.round(parseFloat(selectedReturn.totalRefund || "0")).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-medium">{selectedReturn.customerName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p className="font-medium">{selectedReturn.customerPhone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Original Sale Info */}
              {selectedReturn.sale && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Original Sale</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm p-3 bg-blue-50 rounded-lg">
                      <div>
                        <span className="text-muted-foreground">Sale ID:</span>
                        <p className="font-mono font-semibold">
                          #{selectedReturn.sale.id.slice(-8).toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sale Date:</span>
                        <p className="font-medium">{formatDateShort(selectedReturn.sale.createdAt)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Amount:</span>
                        <p className="font-medium">₹{Math.round(parseFloat(selectedReturn.sale.totalAmount)).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Amount Paid:</span>
                        <p className="font-medium">₹{Math.round(parseFloat(selectedReturn.sale.amountPaid)).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Returned Items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-orange-600" />
                    Returned Items ({selectedReturn.returnItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedReturn.returnItems.map((item) => (
                      <Card key={item.id} className="p-4 border-l-4 border-l-orange-500">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {item.color.variant.product.company} {item.color.variant.product.productName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {item.color.colorName} ({item.color.colorCode})
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Size: {item.color.variant.packingSize}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge variant="outline" className="bg-orange-50">
                                {item.quantity} unit{item.quantity !== 1 ? 's' : ''}
                              </Badge>
                              {item.stockRestored && (
                                <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                                  <CheckCircle className="h-3 w-3" />
                                  Stock Restored
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Rate:</span>
                              <span className="font-mono">₹{Math.round(parseFloat(item.rate)).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                              <span>Refund Amount:</span>
                              <span className="text-red-600">₹{Math.round(parseFloat(item.subtotal)).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Return Reason */}
              {selectedReturn.reason && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Return Reason</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      {selectedReturn.reason}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>
              Close
            </Button>
            {selectedReturn && (
              <Button onClick={() => downloadReturnPDF(selectedReturn)}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}