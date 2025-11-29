// audit.tsx - FIXED VERSION WITH PROPER AUTHENTICATION
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  Calendar,
  Package,
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  X,
  Lock,
  Settings,
  Eye,
  EyeOff,
  FileText,
  ShieldCheck,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Wallet,
  RotateCcw,
  DollarSign,
  Receipt,
  Database,
  Trash2,
  Edit,
  Cloud,
  Upload,
  Check,
  XCircle,
  Loader2,
  Users,
  Key,
  Cpu,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDateFormat } from "@/hooks/use-date-format";
import { useReceiptSettings } from "@/hooks/use-receipt-settings";
import jsPDF from "jspdf";
import type { ColorWithVariantAndProduct, Sale, StockInHistory, Product, PaymentHistory, Return, Settings as AppSettings } from "@shared/schema";
import { format, startOfDay, endOfDay, isBefore, isAfter } from "date-fns";

interface StockInHistoryWithColor extends StockInHistory {
  color: ColorWithVariantAndProduct;
}

interface StockOutItem {
  id: string;
  saleId: string;
  colorId: string;
  quantity: number;
  rate: string;
  subtotal: string;
  color: ColorWithVariantAndProduct;
  sale: Sale;
  soldAt: Date;
  customerName: string;
  customerPhone: string;
}

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale | null;
}

interface ConsolidatedCustomer {
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  sales: Sale[];
}

// Custom hook for authenticated API calls
function useAuditApiRequest() {
  const [auditToken, setAuditToken] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const storedToken = sessionStorage.getItem("auditToken");
    const storedVerified = sessionStorage.getItem("auditVerified");
    
    if (storedVerified === "true" && storedToken) {
      setAuditToken(storedToken);
      setIsVerified(true);
    }
  }, []);

  const authenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const token = auditToken || sessionStorage.getItem("auditToken");
    if (!token) {
      throw new Error("No audit token available");
    }

    const headers = {
      "Content-Type": "application/json",
      "X-Audit-Token": token,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      sessionStorage.removeItem("auditToken");
      sessionStorage.removeItem("auditVerified");
      setAuditToken(null);
      setIsVerified(false);
      throw new Error("Authentication failed. Please re-enter your PIN.");
    }

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  };

  return { authenticatedRequest, auditToken, setAuditToken, isVerified, setIsVerified };
}

// Custom hook for authenticated queries
function useAuditQuery<T>(url: string, options?: any) {
  const { authenticatedRequest, auditToken, isVerified } = useAuditApiRequest();
  
  return useQuery<T>({
    queryKey: [url, auditToken],
    queryFn: () => authenticatedRequest(url),
    enabled: isVerified && !!auditToken,
    ...options,
  });
}

export default function Audit() {
  const { formatDateShort } = useDateFormat();
  const { receiptSettings } = useReceiptSettings();
  const { toast } = useToast();
  const { authenticatedRequest, auditToken, setAuditToken, isVerified, setIsVerified } = useAuditApiRequest();

  const [pinInput, setPinInput] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [isDefaultPin, setIsDefaultPin] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(true);
  
  const [activeTab, setActiveTab] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");

  // Settings Tabs State
  const [settingsTab, setSettingsTab] = useState("pin");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // Cloud Sync State
  const [cloudUrl, setCloudUrl] = useState("");
  const [showCloudUrl, setShowCloudUrl] = useState(false);
  const [cloudConnectionStatus, setCloudConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "exporting" | "importing">("idle");
  const [lastExportCounts, setLastExportCounts] = useState<any>(null);
  const [lastImportCounts, setLastImportCounts] = useState<any>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(5); // minutes

  // Check if PIN is set
  const { data: hasPin } = useQuery<{ hasPin: boolean; isDefault?: boolean }>({
    queryKey: ["/api/audit/has-pin"],
    enabled: !isVerified,
  });

  // Regular queries (no authentication needed)
  const { data: colors = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: isVerified,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: isVerified,
  });

  const { data: stockInHistory = [], isLoading: stockInLoading } = useQuery<StockInHistoryWithColor[]>({
    queryKey: ["/api/stock-in/history"],
    enabled: isVerified,
  });

  const { data: allSales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    enabled: isVerified,
  });

  const { data: paymentHistory = [], isLoading: paymentsLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    enabled: isVerified,
  });

  // Authenticated queries using custom hook
  const { data: stockOutHistory = [], isLoading: stockOutLoading } = useAuditQuery<StockOutItem[]>(
    "/api/audit/stock-out"
  );

  const { data: unpaidBills = [], isLoading: unpaidLoading } = useAuditQuery<Sale[]>(
    "/api/audit/unpaid-bills"
  );

  const { data: auditPayments = [], isLoading: auditPaymentsLoading } = useAuditQuery<PaymentHistoryWithSale[]>(
    "/api/audit/payments"
  );

  const { data: auditReturns = [], isLoading: returnsLoading } = useAuditQuery<Return[]>(
    "/api/audit/returns"
  );

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
    enabled: isVerified,
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async (permissions: Partial<AppSettings>) => {
      const response = await apiRequest("PATCH", "/api/settings", permissions);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Permissions Updated",
        description: "Access control settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to Update",
        description: "Could not save permission settings.",
        variant: "destructive",
      });
    },
  });

  const handlePermissionChange = (key: keyof AppSettings, value: boolean) => {
    updatePermissionsMutation.mutate({ [key]: value });
  };

  const verifyPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const response = await fetch("/api/audit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "PIN verification failed");
      }
      return response.json();
    },
    onSuccess: (data: { ok: boolean; isDefault?: boolean; auditToken?: string }) => {
      if (data.ok && data.auditToken) {
        setIsVerified(true);
        setAuditToken(data.auditToken);
        setShowPinDialog(false);
        setIsDefaultPin(data.isDefault || false);
        setPinError("");
        if (data.isDefault) {
          toast({
            title: "Default PIN Used",
            description: "Please change your PIN in the Settings tab for security.",
            variant: "destructive",
          });
        }
        sessionStorage.setItem("auditVerified", "true");
        sessionStorage.setItem("auditToken", data.auditToken);
      }
    },
    onError: (error: Error) => {
      setPinError(error.message || "Invalid PIN. Please try again.");
      setPinInput(["", "", "", ""]);
    },
  });

  const changePinMutation = useMutation({
    mutationFn: async ({ currentPin, newPin }: { currentPin: string; newPin: string }) => {
      const response = await fetch("/api/audit/pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to change PIN");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "PIN Changed",
        description: "Your audit PIN has been successfully updated.",
      });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setIsDefaultPin(false);
      queryClient.invalidateQueries({ queryKey: ["/api/audit/has-pin"] });
    },
    onError: (error: Error) => {
      toast({
        title: "PIN Change Failed",
        description: error.message || "Failed to change PIN. Please check your current PIN.",
        variant: "destructive",
      });
    },
  });

  // Cloud Sync Functions
  const handleTestConnection = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter a PostgreSQL connection URL.",
        variant: "destructive",
      });
      return;
    }

    setCloudConnectionStatus("testing");
    try {
      const data = await authenticatedRequest("/api/cloud/test-connection", {
        method: "POST",
        body: JSON.stringify({ connectionUrl: cloudUrl }),
      });
      
      if (data.ok) {
        setCloudConnectionStatus("success");
        toast({
          title: "Connection Successful",
          description: "Successfully connected to cloud database.",
        });
      } else {
        setCloudConnectionStatus("error");
        toast({
          title: "Connection Failed",
          description: data.error || "Could not connect to cloud database.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setCloudConnectionStatus("error");
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to cloud database.",
        variant: "destructive",
      });
    }
  };

  const handleSaveCloudSettings = async () => {
    try {
      const data = await authenticatedRequest("/api/cloud/save-settings", {
        method: "POST",
        body: JSON.stringify({ 
          connectionUrl: cloudUrl, 
          syncEnabled: true,
          cloudSyncEnabled: autoSyncEnabled 
        }),
      });
      
      if (data.ok) {
        toast({
          title: "Settings Saved",
          description: "Cloud database settings saved successfully.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      }
    } catch (error: any) {
      toast({
        title: "Failed to Save",
        description: error.message || "Could not save cloud settings.",
        variant: "destructive",
      });
    }
  };

  const handleExportToCloud = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter and save a PostgreSQL connection URL first.",
        variant: "destructive",
      });
      return;
    }

    await handleSaveCloudSettings();

    setCloudSyncStatus("exporting");
    try {
      const data = await authenticatedRequest("/api/cloud/export", {
        method: "POST",
      });
      
      if (data.ok) {
        setLastExportCounts(data.counts);
        toast({
          title: "Export Successful",
          description: `Exported ${data.counts.products} products, ${data.counts.colors} colors, ${data.counts.sales} sales to cloud.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      } else {
        toast({
          title: "Export Failed",
          description: data.error || "Could not export to cloud database.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Could not export to cloud database.",
        variant: "destructive",
      });
    } finally {
      setCloudSyncStatus("idle");
    }
  };

  const handleImportFromCloud = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter and save a PostgreSQL connection URL first.",
        variant: "destructive",
      });
      return;
    }

    await handleSaveCloudSettings();

    setCloudSyncStatus("importing");
    try {
      const data = await authenticatedRequest("/api/cloud/import", {
        method: "POST",
      });
      
      if (data.ok) {
        setLastImportCounts(data.counts);
        toast({
          title: "Import Successful",
          description: `Imported ${data.counts.products} products, ${data.counts.colors} colors, ${data.counts.sales} sales from cloud.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      } else {
        toast({
          title: "Import Failed",
          description: data.error || "Could not import from cloud database.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Could not import from cloud database.",
        variant: "destructive",
      });
    } finally {
      setCloudSyncStatus("idle");
    }
  };

  const toggleAutoSync = async (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    await handleSaveCloudSettings();
    
    if (enabled) {
      toast({
        title: "Auto-Sync Enabled",
        description: `Data will sync automatically every ${syncInterval} minutes.`,
      });
    } else {
      toast({
        title: "Auto-Sync Disabled",
        description: "Automatic synchronization has been turned off.",
      });
    }
  };

  // Initialize cloud URL from settings when they load
  useEffect(() => {
    if (appSettings?.cloudDatabaseUrl && !cloudUrl) {
      setCloudUrl(appSettings.cloudDatabaseUrl);
      if (appSettings.cloudSyncEnabled) {
        setCloudConnectionStatus("success");
        setAutoSyncEnabled(true);
      }
    }
  }, [appSettings?.cloudDatabaseUrl, appSettings?.cloudSyncEnabled]);

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPinInput = [...pinInput];
    newPinInput[index] = value.slice(-1);
    setPinInput(newPinInput);
    setPinError("");

    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }

    if (index === 3 && value) {
      const fullPin = newPinInput.join("");
      if (fullPin.length === 4) {
        verifyPinMutation.mutate(fullPin);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pinInput[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePinChange = () => {
    if (newPin !== confirmPin) {
      toast({
        title: "PIN Mismatch",
        description: "New PIN and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 4 digits.",
        variant: "destructive",
      });
      return;
    }

    changePinMutation.mutate({
      currentPin: currentPin || "0000",
      newPin: newPin,
    });
  };

  const companies = useMemo(() => {
    const uniqueCompanies = new Set(products.map(p => p.company));
    return Array.from(uniqueCompanies).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (companyFilter === "all") return products;
    return products.filter(p => p.company === companyFilter);
  }, [products, companyFilter]);

  const stockMovements = useMemo(() => {
    const movements: {
      id: string;
      date: Date;
      type: "IN" | "OUT";
      company: string;
      product: string;
      variant: string;
      colorCode: string;
      colorName: string;
      quantity: number;
      previousStock?: number;
      newStock?: number;
      reference: string;
      customer?: string;
      notes?: string;
    }[] = [];

    stockInHistory.forEach(record => {
      movements.push({
        id: record.id,
        date: new Date(record.createdAt),
        type: "IN",
        company: record.color?.variant?.product?.company || "-",
        product: record.color?.variant?.product?.productName || "-",
        variant: record.color?.variant?.packingSize || "-",
        colorCode: record.color?.colorCode || "-",
        colorName: record.color?.colorName || "-",
        quantity: record.quantity,
        previousStock: record.previousStock,
        newStock: record.newStock,
        reference: `Stock In: ${record.stockInDate}`,
        notes: record.notes || undefined,
      });
    });

    stockOutHistory.forEach(record => {
      movements.push({
        id: record.id,
        date: new Date(record.soldAt),
        type: "OUT",
        company: record.color?.variant?.product?.company || "-",
        product: record.color?.variant?.product?.productName || "-",
        variant: record.color?.variant?.packingSize || "-",
        colorCode: record.color?.colorCode || "-",
        colorName: record.color?.colorName || "-",
        quantity: record.quantity,
        reference: `Bill #${record.saleId.slice(0, 8).toUpperCase()}`,
        customer: record.customerName,
      });
    });

    return movements.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [stockInHistory, stockOutHistory]);

  const filteredStockMovements = useMemo(() => {
    let filtered = [...stockMovements];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.colorCode.toLowerCase().includes(query) ||
        m.colorName.toLowerCase().includes(query) ||
        m.product.toLowerCase().includes(query) ||
        m.company.toLowerCase().includes(query) ||
        (m.customer && m.customer.toLowerCase().includes(query))
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom));
      filtered = filtered.filter(m => !isBefore(m.date, fromDate));
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo));
      filtered = filtered.filter(m => !isAfter(m.date, toDate));
    }

    if (companyFilter !== "all") {
      filtered = filtered.filter(m => m.company === companyFilter);
    }

    if (productFilter !== "all") {
      filtered = filtered.filter(m => m.product === productFilter);
    }

    if (movementTypeFilter !== "all") {
      filtered = filtered.filter(m => m.type === movementTypeFilter);
    }

    return filtered;
  }, [stockMovements, searchQuery, dateFrom, dateTo, companyFilter, productFilter, movementTypeFilter]);

  const filteredSales = useMemo(() => {
    let filtered = [...allSales];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sale =>
        sale.customerName.toLowerCase().includes(query) ||
        sale.customerPhone.includes(query) ||
        sale.id.toLowerCase().includes(query)
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom));
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return !isBefore(saleDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo));
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.createdAt);
        return !isAfter(saleDate, toDate);
      });
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allSales, searchQuery, dateFrom, dateTo]);

  const stockSummary = useMemo(() => {
    const totalIn = stockInHistory.reduce((acc, r) => acc + r.quantity, 0);
    const totalOut = stockOutHistory.reduce((acc, r) => acc + r.quantity, 0);
    const currentStock = colors.reduce((acc, c) => acc + c.stockQuantity, 0);
    return { totalIn, totalOut, currentStock };
  }, [stockInHistory, stockOutHistory, colors]);

  const salesSummary = useMemo(() => {
    const totalSales = allSales.reduce((acc, s) => acc + parseFloat(s.totalAmount), 0);
    const totalPaid = allSales.reduce((acc, s) => acc + parseFloat(s.amountPaid), 0);
    const totalOutstanding = totalSales - totalPaid;
    const totalBills = allSales.length;
    const paidBills = allSales.filter(s => s.paymentStatus === "paid").length;
    return { totalSales, totalPaid, totalOutstanding, totalBills, paidBills };
  }, [allSales]);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setCompanyFilter("all");
    setProductFilter("all");
    setMovementTypeFilter("all");
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo || companyFilter !== "all" || productFilter !== "all" || movementTypeFilter !== "all";

  // PDF download functions
  const downloadStockAuditPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 25, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(receiptSettings.businessName, pageWidth / 2, 10, { align: "center" });
    pdf.setFontSize(12);
    pdf.text("STOCK AUDIT REPORT", pageWidth / 2, 18, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    yPos = 35;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated: ${formatDateShort(new Date())}`, margin, yPos);
    if (dateFrom || dateTo) {
      pdf.text(`Period: ${dateFrom || "Start"} to ${dateTo || "Present"}`, margin + 80, yPos);
    }
    yPos += 8;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 15, "F");
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total Stock In: ${stockSummary.totalIn}`, margin + 5, yPos + 10);
    pdf.text(`Total Stock Out: ${stockSummary.totalOut}`, margin + 70, yPos + 10);
    pdf.text(`Current Stock: ${stockSummary.currentStock}`, margin + 140, yPos + 10);
    pdf.text(`Net Movement: ${stockSummary.totalIn - stockSummary.totalOut}`, margin + 200, yPos + 10);
    yPos += 22;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    const headers = ["Date", "Type", "Company", "Product", "Size", "Color", "Qty", "Reference", "Customer"];
    const colWidths = [25, 15, 35, 35, 25, 40, 15, 45, 40];
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      pdf.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    const maxRows = Math.min(filteredStockMovements.length, 25);
    for (let i = 0; i < maxRows; i++) {
      const m = filteredStockMovements[i];
      if (yPos > pageHeight - 20) break;

      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
      }

      pdf.setFontSize(7);
      xPos = margin + 2;
      pdf.text(formatDateShort(m.date), xPos, yPos + 4); xPos += colWidths[0];
      
      if (m.type === "IN") {
        pdf.setTextColor(34, 197, 94);
      } else {
        pdf.setTextColor(239, 68, 68);
      }
      pdf.text(m.type, xPos, yPos + 4); xPos += colWidths[1];
      pdf.setTextColor(0, 0, 0);
      
      pdf.text(m.company.substring(0, 15), xPos, yPos + 4); xPos += colWidths[2];
      pdf.text(m.product.substring(0, 15), xPos, yPos + 4); xPos += colWidths[3];
      pdf.text(m.variant, xPos, yPos + 4); xPos += colWidths[4];
      pdf.text(`${m.colorCode} - ${m.colorName}`.substring(0, 20), xPos, yPos + 4); xPos += colWidths[5];
      pdf.text(m.type === "IN" ? `+${m.quantity}` : `-${m.quantity}`, xPos, yPos + 4); xPos += colWidths[6];
      pdf.text(m.reference.substring(0, 22), xPos, yPos + 4); xPos += colWidths[7];
      pdf.text((m.customer || "-").substring(0, 18), xPos, yPos + 4);
      yPos += 6;
    }

    if (filteredStockMovements.length > maxRows) {
      pdf.setFontSize(8);
      pdf.text(`... and ${filteredStockMovements.length - maxRows} more records`, margin, yPos + 5);
    }

    pdf.save(`Stock-Audit-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`);
    toast({ title: "PDF Downloaded", description: "Stock Audit Report has been downloaded." });
  };

  const downloadSalesAuditPDF = () => {
    // Implementation for sales audit PDF
    toast({ title: "Feature Coming Soon", description: "Sales audit PDF download will be available soon." });
  };

  const downloadUnpaidPDF = () => {
    // Implementation for unpaid bills PDF
    toast({ title: "Feature Coming Soon", description: "Unpaid bills PDF download will be available soon." });
  };

  const downloadPaymentsPDF = () => {
    // Implementation for payments PDF
    toast({ title: "Feature Coming Soon", description: "Payments PDF download will be available soon." });
  };

  const downloadReturnsPDF = () => {
    // Implementation for returns PDF
    toast({ title: "Feature Coming Soon", description: "Returns PDF download will be available soon." });
  };

  if (showPinDialog) {
    return (
      <Dialog open={showPinDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center text-xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Audit PIN Verification
            </DialogTitle>
            <DialogDescription className="text-center">
              Enter your 4-digit PIN to access Audit Reports
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            
            {hasPin && !hasPin.hasPin && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Default PIN is <strong>0000</strong>. Please change it after login.
                </p>
              </div>
            )}

            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  id={`pin-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={pinInput[index]}
                  onChange={(e) => handlePinInput(index, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(index, e)}
                  className="w-14 h-14 text-center text-2xl font-bold border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus={index === 0}
                  autoComplete="off"
                />
              ))}
            </div>

            {pinError && (
              <p className="text-center text-sm text-destructive">{pinError}</p>
            )}

            {verifyPinMutation.isPending && (
              <div className="flex justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isLoading = colorsLoading || stockInLoading || stockOutLoading || salesLoading || paymentsLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Audit Reports</h1>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4">
          <TabsList className="h-12 flex-wrap">
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="unpaid" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Unpaid Bills
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="returns" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Returns
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Stock Tab */}
        <TabsContent value="stock" className="flex-1 overflow-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Stock Audit</h2>
            <Button onClick={downloadStockAuditPDF} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Total Stock In</span>
                    </div>
                    <p className="text-2xl font-bold">{stockSummary.totalIn}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Total Stock Out</span>
                    </div>
                    <p className="text-2xl font-bold">{stockSummary.totalOut}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Current Stock</span>
                    </div>
                    <p className="text-2xl font-bold">{stockSummary.currentStock}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Net Movement</span>
                    </div>
                    <p className="text-2xl font-bold">{stockSummary.totalIn - stockSummary.totalOut}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Stock Movement History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStockMovements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>{formatDateShort(movement.date)}</TableCell>
                          <TableCell>
                            <Badge variant={movement.type === "IN" ? "default" : "destructive"}>
                              {movement.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{movement.company}</TableCell>
                          <TableCell>{movement.product}</TableCell>
                          <TableCell>{movement.colorName}</TableCell>
                          <TableCell>{movement.quantity}</TableCell>
                          <TableCell>{movement.reference}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Other tabs would be implemented similarly */}
        <TabsContent value="sales" className="flex-1 overflow-auto p-4">
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Sales Audit</h3>
            <p className="text-muted-foreground">Sales audit features coming soon</p>
          </div>
        </TabsContent>

        <TabsContent value="unpaid" className="flex-1 overflow-auto p-4">
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Unpaid Bills Audit</h3>
            <p className="text-muted-foreground">Unpaid bills audit features coming soon</p>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="flex-1 overflow-auto p-4">
          <div className="text-center py-8">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Payments Audit</h3>
            <p className="text-muted-foreground">Payments audit features coming soon</p>
          </div>
        </TabsContent>

        <TabsContent value="returns" className="flex-1 overflow-auto p-4">
          <div className="text-center py-8">
            <RotateCcw className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Returns Audit</h3>
            <p className="text-muted-foreground">Returns audit features coming soon</p>
          </div>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="flex-1 overflow-auto p-4">
          <div className="max-w-4xl mx-auto">
            <Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full">
              <TabsList className="grid grid-cols-4 mb-6">
                <TabsTrigger value="pin" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  PIN Settings
                </TabsTrigger>
                <TabsTrigger value="permissions" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Permissions
                </TabsTrigger>
                <TabsTrigger value="cloud" className="flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  Cloud Sync
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  System
                </TabsTrigger>
              </TabsList>

              {/* PIN SETTINGS TAB */}
              <TabsContent value="pin" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Change Audit PIN
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isDefaultPin && (
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-md">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <p className="text-sm text-yellow-700">
                          You are using the default PIN. Please change it for security.
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="currentPin">Current PIN</Label>
                      <div className="relative">
                        <Input
                          id="currentPin"
                          type={showCurrentPin ? "text" : "password"}
                          value={currentPin}
                          onChange={(e) => setCurrentPin(e.target.value)}
                          placeholder={isDefaultPin ? "Default: 0000" : "Enter current PIN"}
                          maxLength={4}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowCurrentPin(!showCurrentPin)}
                        >
                          {showCurrentPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPin">New PIN</Label>
                      <div className="relative">
                        <Input
                          id="newPin"
                          type={showNewPin ? "text" : "password"}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value)}
                          placeholder="Enter new 4-digit PIN"
                          maxLength={4}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowNewPin(!showNewPin)}
                        >
                          {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPin">Confirm New PIN</Label>
                      <div className="relative">
                        <Input
                          id="confirmPin"
                          type={showConfirmPin ? "text" : "password"}
                          value={confirmPin}
                          onChange={(e) => setConfirmPin(e.target.value)}
                          placeholder="Confirm new PIN"
                          maxLength={4}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0"
                          onClick={() => setShowConfirmPin(!showConfirmPin)}
                        >
                          {showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <Button
                      onClick={handlePinChange}
                      className="w-full"
                      disabled={changePinMutation.isPending}
                    >
                      {changePinMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4 mr-2" />
                      )}
                      Change PIN
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* PERMISSIONS TAB */}
              <TabsContent value="permissions" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Access Control Permissions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="border-b pb-3">
                        <h4 className="font-medium flex items-center gap-2 mb-3">
                          <Package className="h-4 w-4" />
                          Stock Management
                        </h4>
                        <div className="space-y-3 pl-6">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Edit Products/Variants/Colors</Label>
                              <p className="text-xs text-muted-foreground">Allow editing stock items</p>
                            </div>
                            <Switch
                              checked={appSettings?.permStockEdit ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permStockEdit", checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Delete Products/Variants/Colors</Label>
                              <p className="text-xs text-muted-foreground">Allow deleting stock items</p>
                            </div>
                            <Switch
                              checked={appSettings?.permStockDelete ?? true}
                              onCheckedChange={(checked) => handlePermissionChange("permStockDelete", checked)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CLOUD SYNC TAB */}
              <TabsContent value="cloud" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cloud className="h-5 w-5 text-blue-500" />
                      Cloud Database Sync
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cloudUrl">PostgreSQL Connection URL</Label>
                        <div className="relative">
                          <Input
                            id="cloudUrl"
                            type={showCloudUrl ? "text" : "password"}
                            value={cloudUrl}
                            onChange={(e) => {
                              setCloudUrl(e.target.value);
                              setCloudConnectionStatus("idle");
                            }}
                            placeholder="postgresql://user:password@host/database"
                            className="pr-20"
                          />
                          <div className="absolute right-0 top-0 flex">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowCloudUrl(!showCloudUrl)}
                            >
                              {showCloudUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handleTestConnection}
                        variant="outline"
                        className="w-full"
                        disabled={cloudConnectionStatus === "testing" || !cloudUrl.trim()}
                      >
                        {cloudConnectionStatus === "testing" ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          "Test Connection"
                        )}
                      </Button>

                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={handleExportToCloud}
                          variant="default"
                          disabled={cloudSyncStatus !== "idle" || !cloudUrl.trim()}
                          className="flex items-center gap-2"
                        >
                          {cloudSyncStatus === "exporting" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {cloudSyncStatus === "exporting" ? "Exporting..." : "Export to Cloud"}
                        </Button>

                        <Button
                          onClick={handleImportFromCloud}
                          variant="outline"
                          disabled={cloudSyncStatus !== "idle" || !cloudUrl.trim()}
                          className="flex items-center gap-2"
                        >
                          {cloudSyncStatus === "importing" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {cloudSyncStatus === "importing" ? "Importing..." : "Import from Cloud"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SYSTEM TAB */}
              <TabsContent value="system" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      System Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Database Records</Label>
                        <div className="text-2xl font-bold text-primary">
                          {allSales.length + products.length + colors.length}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Cloud Status</Label>
                        <div className="flex items-center gap-2">
                          {cloudConnectionStatus === "success" ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className={cloudConnectionStatus === "success" ? "text-green-600" : "text-red-600"}>
                            {cloudConnectionStatus === "success" ? "Connected" : "Not Connected"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}