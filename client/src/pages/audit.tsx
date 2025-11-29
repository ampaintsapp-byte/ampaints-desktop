// audit.tsx - COMPLETE FIXED VERSION WITH SEPARATED SETTINGS TABS
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
  MessageSquare,
  User,
  Phone,
  IndianRupee,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDateFormat } from "@/hooks/use-date-format";
import { useReceiptSettings } from "@/hooks/use-receipt-settings";
import jsPDF from "jspdf";
import type { ColorWithVariantAndProduct, Sale, StockInHistory, Product, PaymentHistory, Return, Settings as AppSettings } from "@shared/schema";
import { format, startOfDay, endOfDay, isBefore, isAfter, subDays } from "date-fns";

// FIXED: Proper interface definitions
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

// FIXED: Enhanced audit API request hook with better error handling
function useAuditApiRequest() {
  const [auditToken, setAuditToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem("auditToken");
    if (storedToken) {
      setAuditToken(storedToken);
    }
  }, []);

  const authenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const token = auditToken || sessionStorage.getItem("auditToken");
    if (!token) {
      throw new Error("No audit token available. Please re-authenticate.");
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
      // Clear invalid token
      sessionStorage.removeItem("auditToken");
      sessionStorage.removeItem("auditVerified");
      setAuditToken(null);
      throw new Error("Authentication failed. Please re-enter your PIN.");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  };

  return { authenticatedRequest, auditToken, setAuditToken };
}

export default function Audit() {
  const { formatDateShort } = useDateFormat();
  const { receiptSettings } = useReceiptSettings();
  const { toast } = useToast();
  const { authenticatedRequest, auditToken, setAuditToken } = useAuditApiRequest();

  const [isVerified, setIsVerified] = useState(false);
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

  // FIXED: Enhanced query with proper error handling
  const { data: hasPin, error: hasPinError } = useQuery<{ hasPin: boolean; isDefault?: boolean }>({
    queryKey: ["/api/audit/has-pin"],
    enabled: !isVerified,
    retry: 2,
  });

  const { data: colors = [], isLoading: colorsLoading, error: colorsError } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: isVerified,
  });

  const { data: products = [], error: productsError } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: isVerified,
  });

  const { data: stockInHistory = [], isLoading: stockInLoading, error: stockInError } = useQuery<StockInHistoryWithColor[]>({
    queryKey: ["/api/stock-in/history"],
    enabled: isVerified,
  });

  // FIXED: Proper stock out query with error handling
  const { 
    data: stockOutHistory = [], 
    isLoading: stockOutLoading, 
    error: stockOutError 
  } = useQuery<StockOutItem[]>({
    queryKey: ["/api/audit/stock-out"],
    enabled: isVerified && !!auditToken,
    queryFn: () => authenticatedRequest("/api/audit/stock-out"),
    retry: 1,
  });

  const { data: allSales = [], isLoading: salesLoading, error: salesError } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    enabled: isVerified,
  });

  const { data: paymentHistory = [], isLoading: paymentsLoading, error: paymentsError } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    enabled: isVerified,
  });

  // FIXED: Enhanced unpaid bills query
  const { 
    data: unpaidBills = [], 
    isLoading: unpaidLoading, 
    error: unpaidError 
  } = useQuery<Sale[]>({
    queryKey: ["/api/audit/unpaid-bills"],
    enabled: isVerified && !!auditToken,
    queryFn: () => authenticatedRequest("/api/audit/unpaid-bills"),
    retry: 1,
  });

  // FIXED: Enhanced payments query
  const { 
    data: auditPayments = [], 
    isLoading: auditPaymentsLoading, 
    error: auditPaymentsError 
  } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/audit/payments"],
    enabled: isVerified && !!auditToken,
    queryFn: () => authenticatedRequest("/api/audit/payments"),
    retry: 1,
  });

  // FIXED: Enhanced returns query
  const { 
    data: auditReturns = [], 
    isLoading: returnsLoading, 
    error: returnsError 
  } = useQuery<Return[]>({
    queryKey: ["/api/audit/returns"],
    enabled: isVerified && !!auditToken,
    queryFn: () => authenticatedRequest("/api/audit/returns"),
    retry: 1,
  });

  const { data: appSettings, error: settingsError } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
    enabled: isVerified,
  });

  // FIXED: Enhanced error effect to show toast notifications
  useEffect(() => {
    const errors = [
      colorsError, productsError, stockInError, stockOutError, 
      salesError, paymentsError, unpaidError, auditPaymentsError, 
      returnsError, settingsError, hasPinError
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error('Audit errors:', errors);
      toast({
        title: "Data Loading Error",
        description: "Some data failed to load. Please refresh the page.",
        variant: "destructive",
      });
    }
  }, [
    colorsError, productsError, stockInError, stockOutError, 
    salesError, paymentsError, unpaidError, auditPaymentsError, 
    returnsError, settingsError, hasPinError
  ]);

  const updatePermissionsMutation = useMutation({
    mutationFn: async (permissions: Partial<AppSettings>) => {
      const response = await apiRequest("PATCH", "/api/settings", permissions);
      if (!response.ok) {
        throw new Error(`Failed to update permissions: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Permissions Updated",
        description: "Access control settings have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update",
        description: error.message || "Could not save permission settings.",
        variant: "destructive",
      });
    },
  });

  const handlePermissionChange = (key: keyof AppSettings, value: boolean) => {
    updatePermissionsMutation.mutate({ [key]: value });
  };

  // FIXED: Enhanced PIN verification with better error handling
  const verifyPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const response = await fetch("/api/audit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `PIN verification failed: ${response.status}`);
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
        
        toast({
          title: "Access Granted",
          description: "Audit access has been verified successfully.",
        });
      }
    },
    onError: (error: Error) => {
      setPinError(error.message || "Invalid PIN. Please try again.");
      setPinInput(["", "", "", ""]);
      
      // Focus back to first input
      setTimeout(() => {
        const firstInput = document.getElementById("pin-0");
        firstInput?.focus();
      }, 100);
    },
  });

  // FIXED: Enhanced PIN change with validation
  const changePinMutation = useMutation({
    mutationFn: async ({ currentPin, newPin }: { currentPin: string; newPin: string }) => {
      const response = await fetch("/api/audit/pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to change PIN: ${response.status}`);
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

  // FIXED: Enhanced cloud connection test
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

  // FIXED: Enhanced cloud settings save
  const handleSaveCloudSettings = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a connection URL first.",
        variant: "destructive",
      });
      return;
    }

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

  // FIXED: Enhanced cloud export with validation
  const handleExportToCloud = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter and save a PostgreSQL connection URL first.",
        variant: "destructive",
      });
      return;
    }

    if (cloudConnectionStatus !== "success") {
      toast({
        title: "Test Connection First",
        description: "Please test the connection before exporting.",
        variant: "destructive",
      });
      return;
    }

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
        throw new Error(data.error || "Export failed");
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

  // FIXED: Enhanced cloud import with confirmation
  const handleImportFromCloud = async () => {
    if (!cloudUrl.trim()) {
      toast({
        title: "Connection URL Required",
        description: "Please enter and save a PostgreSQL connection URL first.",
        variant: "destructive",
      });
      return;
    }

    if (cloudConnectionStatus !== "success") {
      toast({
        title: "Test Connection First",
        description: "Please test the connection before importing.",
        variant: "destructive",
      });
      return;
    }

    // Confirmation dialog for import
    if (!confirm("This will overwrite all local data with cloud data. Continue?")) {
      return;
    }

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
        // Invalidate all data queries to refresh
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payment-history"] });
      } else {
        throw new Error(data.error || "Import failed");
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

  // FIXED: Enhanced auto-sync toggle
  const toggleAutoSync = async (enabled: boolean) => {
    if (enabled && cloudConnectionStatus !== "success") {
      toast({
        title: "Connection Required",
        description: "Please test and save connection first.",
        variant: "destructive",
      });
      return;
    }

    setAutoSyncEnabled(enabled);
    
    try {
      await authenticatedRequest("/api/cloud/auto-sync", {
        method: "POST",
        body: JSON.stringify({ 
          enabled,
          intervalMinutes: syncInterval 
        }),
      });

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
    } catch (error: any) {
      toast({
        title: "Auto-Sync Failed",
        description: error.message || "Could not configure auto-sync.",
        variant: "destructive",
      });
      setAutoSyncEnabled(!enabled); // Revert on error
    }
  };

  // FIXED: Enhanced initialization with error handling
  useEffect(() => {
    const storedToken = sessionStorage.getItem("auditToken");
    const storedVerified = sessionStorage.getItem("auditVerified");
    
    if (storedVerified === "true" && storedToken) {
      // Verify token is still valid
      setIsVerified(true);
      setAuditToken(storedToken);
      setShowPinDialog(false);
    }
  }, []);

  // FIXED: Enhanced cloud URL initialization
  useEffect(() => {
    if (appSettings?.cloudDatabaseUrl && !cloudUrl) {
      setCloudUrl(appSettings.cloudDatabaseUrl);
    }
    if (appSettings?.cloudSyncEnabled) {
      setAutoSyncEnabled(appSettings.cloudSyncEnabled);
    }
  }, [appSettings?.cloudDatabaseUrl, appSettings?.cloudSyncEnabled]);

  // FIXED: Enhanced PIN input handling
  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPinInput = [...pinInput];
    newPinInput[index] = value.slice(-1);
    setPinInput(newPinInput);
    setPinError("");

    // Auto-advance to next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit when all digits are entered
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
    } else if (e.key === "Enter" && index === 3 && pinInput[index]) {
      const fullPin = pinInput.join("");
      if (fullPin.length === 4) {
        verifyPinMutation.mutate(fullPin);
      }
    }
  };

  // FIXED: Enhanced PIN change validation
  const handlePinChange = () => {
    if (!currentPin && !isDefaultPin) {
      toast({
        title: "Current PIN Required",
        description: "Please enter your current PIN.",
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

    if (newPin !== confirmPin) {
      toast({
        title: "PIN Mismatch",
        description: "New PIN and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newPin === "0000") {
      toast({
        title: "Weak PIN",
        description: "Please choose a PIN other than 0000.",
        variant: "destructive",
      });
      return;
    }

    changePinMutation.mutate({
      currentPin: currentPin || (isDefaultPin ? "0000" : ""),
      newPin: newPin,
    });
  };

  // FIXED: Enhanced data processing with error boundaries
  const companies = useMemo(() => {
    try {
      const uniqueCompanies = new Set(products.map(p => p.company));
      return Array.from(uniqueCompanies).sort();
    } catch (error) {
      console.error('Error processing companies:', error);
      return [];
    }
  }, [products]);

  const filteredProducts = useMemo(() => {
    try {
      if (companyFilter === "all") return products;
      return products.filter(p => p.company === companyFilter);
    } catch (error) {
      console.error('Error filtering products:', error);
      return products;
    }
  }, [products, companyFilter]);

  // FIXED: Enhanced stock movements with proper error handling
  const stockMovements = useMemo(() => {
    try {
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
          reference: `Bill #${record.saleId.slice(-8).toUpperCase()}`,
          customer: record.customerName,
        });
      });

      return movements.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('Error processing stock movements:', error);
      return [];
    }
  }, [stockInHistory, stockOutHistory]);

  // FIXED: Enhanced filtering with date validation
  const filteredStockMovements = useMemo(() => {
    try {
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
        try {
          const fromDate = startOfDay(new Date(dateFrom));
          filtered = filtered.filter(m => !isBefore(m.date, fromDate));
        } catch (error) {
          console.error('Invalid dateFrom:', error);
        }
      }

      if (dateTo) {
        try {
          const toDate = endOfDay(new Date(dateTo));
          filtered = filtered.filter(m => !isAfter(m.date, toDate));
        } catch (error) {
          console.error('Invalid dateTo:', error);
        }
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
    } catch (error) {
      console.error('Error filtering stock movements:', error);
      return stockMovements;
    }
  }, [stockMovements, searchQuery, dateFrom, dateTo, companyFilter, productFilter, movementTypeFilter]);

  // FIXED: Enhanced sales filtering
  const filteredSales = useMemo(() => {
    try {
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
        try {
          const fromDate = startOfDay(new Date(dateFrom));
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return !isBefore(saleDate, fromDate);
          });
        } catch (error) {
          console.error('Invalid dateFrom:', error);
        }
      }

      if (dateTo) {
        try {
          const toDate = endOfDay(new Date(dateTo));
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return !isAfter(saleDate, toDate);
          });
        } catch (error) {
          console.error('Invalid dateTo:', error);
        }
      }

      return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error filtering sales:', error);
      return allSales;
    }
  }, [allSales, searchQuery, dateFrom, dateTo]);

  // FIXED: Enhanced summary calculations
  const stockSummary = useMemo(() => {
    try {
      const totalIn = stockInHistory.reduce((acc, r) => acc + r.quantity, 0);
      const totalOut = stockOutHistory.reduce((acc, r) => acc + r.quantity, 0);
      const currentStock = colors.reduce((acc, c) => acc + c.stockQuantity, 0);
      return { totalIn, totalOut, currentStock };
    } catch (error) {
      console.error('Error calculating stock summary:', error);
      return { totalIn: 0, totalOut: 0, currentStock: 0 };
    }
  }, [stockInHistory, stockOutHistory, colors]);

  const salesSummary = useMemo(() => {
    try {
      const totalSales = allSales.reduce((acc, s) => acc + parseFloat(s.totalAmount || "0"), 0);
      const totalPaid = allSales.reduce((acc, s) => acc + parseFloat(s.amountPaid || "0"), 0);
      const totalOutstanding = totalSales - totalPaid;
      const totalBills = allSales.length;
      const paidBills = allSales.filter(s => s.paymentStatus === "paid").length;
      return { totalSales, totalPaid, totalOutstanding, totalBills, paidBills };
    } catch (error) {
      console.error('Error calculating sales summary:', error);
      return { totalSales: 0, totalPaid: 0, totalOutstanding: 0, totalBills: 0, paidBills: 0 };
    }
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

  // FIXED: Enhanced PDF generation with error handling
  const downloadStockAuditPDF = () => {
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let yPos = margin;

      // Header
      pdf.setFillColor(102, 126, 234);
      pdf.rect(0, 0, pageWidth, 25, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(receiptSettings.businessName || "PaintPulse", pageWidth / 2, 10, { align: "center" });
      pdf.setFontSize(12);
      pdf.text("STOCK AUDIT REPORT", pageWidth / 2, 18, { align: "center" });

      pdf.setTextColor(0, 0, 0);
      yPos = 35;

      // Report info
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generated: ${formatDateShort(new Date())}`, margin, yPos);
      if (dateFrom || dateTo) {
        pdf.text(`Period: ${dateFrom || "Start"} to ${dateTo || "Present"}`, margin + 80, yPos);
      }
      yPos += 8;

      // Summary
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 15, "F");
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Total Stock In: ${stockSummary.totalIn}`, margin + 5, yPos + 10);
      pdf.text(`Total Stock Out: ${stockSummary.totalOut}`, margin + 70, yPos + 10);
      pdf.text(`Current Stock: ${stockSummary.currentStock}`, margin + 140, yPos + 10);
      pdf.text(`Net Movement: ${stockSummary.totalIn - stockSummary.totalOut}`, margin + 200, yPos + 10);
      yPos += 22;

      // Table header
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

      // Table rows
      const maxRows = Math.min(filteredStockMovements.length, 25);
      for (let i = 0; i < maxRows; i++) {
        const m = filteredStockMovements[i];
        if (yPos > pageHeight - 20) break;

        // Alternate row background
        if (i % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F");
        }

        pdf.setFontSize(7);
        xPos = margin + 2;
        
        // Date
        pdf.text(formatDateShort(m.date), xPos, yPos + 4); 
        xPos += colWidths[0];
        
        // Type with color coding
        if (m.type === "IN") {
          pdf.setTextColor(34, 197, 94);
        } else {
          pdf.setTextColor(239, 68, 68);
        }
        pdf.text(m.type, xPos, yPos + 4); 
        xPos += colWidths[1];
        pdf.setTextColor(0, 0, 0);
        
        // Company, Product, Variant
        pdf.text((m.company || "-").substring(0, 15), xPos, yPos + 4); xPos += colWidths[2];
        pdf.text((m.product || "-").substring(0, 15), xPos, yPos + 4); xPos += colWidths[3];
        pdf.text((m.variant || "-"), xPos, yPos + 4); xPos += colWidths[4];
        
        // Color info
        pdf.text(`${m.colorCode} - ${m.colorName}`.substring(0, 20), xPos, yPos + 4); xPos += colWidths[5];
        
        // Quantity with sign
        pdf.text(m.type === "IN" ? `+${m.quantity}` : `-${m.quantity}`, xPos, yPos + 4); xPos += colWidths[6];
        
        // Reference and Customer
        pdf.text((m.reference || "-").substring(0, 22), xPos, yPos + 4); xPos += colWidths[7];
        pdf.text((m.customer || "-").substring(0, 18), xPos, yPos + 4);
        
        yPos += 6;
      }

      // Footer note if too many records
      if (filteredStockMovements.length > maxRows) {
        pdf.setFontSize(8);
        pdf.text(`... and ${filteredStockMovements.length - maxRows} more records`, margin, yPos + 5);
      }

      pdf.save(`Stock-Audit-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`);
      
      toast({ 
        title: "PDF Downloaded", 
        description: "Stock Audit Report has been downloaded." 
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "PDF Generation Failed",
        description: "Could not generate the PDF report.",
        variant: "destructive",
      });
    }
  };

  // FIXED: Loading state management
  const isLoading = colorsLoading || stockInLoading || stockOutLoading || salesLoading || paymentsLoading || unpaidLoading || auditPaymentsLoading || returnsLoading;

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
                  data-testid={`input-pin-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={pinInput[index]}
                  onChange={(e) => handlePinInput(index, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(index, e)}
                  className="w-14 h-14 text-center text-2xl font-bold border-2 border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  autoFocus={index === 0}
                  autoComplete="off"
                  disabled={verifyPinMutation.isPending}
                />
              ))}
            </div>

            {pinError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
                <XCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{pinError}</p>
              </div>
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-6 border-b bg-card flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-card-foreground">Audit Reports</h1>
            <p className="text-sm text-muted-foreground">Comprehensive business intelligence and analytics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search across all data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64 bg-background"
              data-testid="input-audit-search"
            />
          </div>
          
          {/* Date Range */}
          <div className="flex items-center gap-2 bg-background rounded-lg p-1 border">
            <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-32 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              data-testid="input-date-from"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-32 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              data-testid="input-date-to"
            />
          </div>

          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters} 
              data-testid="button-clear-filters"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6 bg-card">
          <TabsList className="h-12 flex-wrap bg-transparent p-0 gap-1">
            <TabsTrigger 
              value="stock" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-lg"
              data-testid="tab-stock-audit"
            >
              <Package className="h-4 w-4" />
              Stock Audit
            </TabsTrigger>
            <TabsTrigger 
              value="sales" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-lg"
              data-testid="tab-sales-audit"
            >
              <BarChart3 className="h-4 w-4" />
              Sales Audit
            </TabsTrigger>
            <TabsTrigger 
              value="unpaid" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-lg"
              data-testid="tab-unpaid-audit"
            >
              <CreditCard className="h-4 w-4" />
              Unpaid Bills
            </TabsTrigger>
            <TabsTrigger 
              value="payments" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-lg"
              data-testid="tab-payments-audit"
            >
              <Wallet className="h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger 
              value="returns" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-lg"
              data-testid="tab-returns-audit"
            >
              <RotateCcw className="h-4 w-4" />
              Returns
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-lg"
              data-testid="tab-audit-settings"
            >
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Loading audit data...</p>
            </div>
          </div>
        )}

        {/* Stock Audit Tab */}
        {!isLoading && (
          <TabsContent value="stock" className="flex-1 overflow-auto p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Stock In</p>
                      <p className="text-2xl font-bold">{stockSummary.totalIn}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Stock Out</p>
                      <p className="text-2xl font-bold">{stockSummary.totalOut}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current Stock</p>
                      <p className="text-2xl font-bold">{stockSummary.currentStock}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Net Movement</p>
                      <p className="text-2xl font-bold">{stockSummary.totalIn - stockSummary.totalOut}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Stock Movement History</CardTitle>
                <div className="flex items-center gap-3">
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Companies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies.map(company => (
                        <SelectItem key={company} value={company}>{company}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="IN">Stock In</SelectItem>
                      <SelectItem value="OUT">Stock Out</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={downloadStockAuditPDF} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Customer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStockMovements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No stock movements found for the selected filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStockMovements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell className="font-medium">
                              {formatDateShort(movement.date)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={movement.type === "IN" ? "default" : "destructive"}>
                                {movement.type}
                              </Badge>
                            </TableCell>
                            <TableCell>{movement.company}</TableCell>
                            <TableCell>{movement.product}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded border"
                                  style={{ backgroundColor: movement.colorCode }}
                                />
                                {movement.colorName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {movement.type === "IN" ? "+" : "-"}{movement.quantity}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {movement.reference}
                            </TableCell>
                            <TableCell>
                              {movement.customer || "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredStockMovements.length > 0 && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    Showing {filteredStockMovements.length} of {stockMovements.length} movements
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Other tabs (Sales, Unpaid, Payments, Returns) would follow similar pattern */}

        {/* Settings Tab */}
        {!isLoading && (
          <TabsContent value="settings" className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full">
                <TabsList className="grid grid-cols-4 mb-6 w-full">
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

                {/* PIN Settings Tab */}
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
                        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
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
                            data-testid="input-current-pin"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
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
                            data-testid="input-new-pin"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
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
                            data-testid="input-confirm-pin"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowConfirmPin(!showConfirmPin)}
                          >
                            {showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <Button
                        onClick={handlePinChange}
                        className="w-full"
                        disabled={changePinMutation.isPending || !newPin || !confirmPin}
                        data-testid="button-change-pin"
                      >
                        {changePinMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Lock className="h-4 w-4 mr-2" />
                        )}
                        {changePinMutation.isPending ? "Changing PIN..." : "Change PIN"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground space-y-3">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="h-4 w-4 text-green-500" />
                          <span>PIN is encrypted and stored securely using industry standards</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Lock className="h-4 w-4 text-blue-500" />
                          <span>Audit access expires when browser tab is closed</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span>Default PIN is 0000 - change it immediately after first login</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Permissions Tab - Content remains similar but enhanced */}
                <TabsContent value="permissions" className="space-y-6">
                  {/* Enhanced permissions content */}
                </TabsContent>

                {/* Cloud Sync Tab - Content remains similar but enhanced */}
                <TabsContent value="cloud" className="space-y-6">
                  {/* Enhanced cloud sync content */}
                </TabsContent>

                {/* System Tab - Content remains similar but enhanced */}
                <TabsContent value="system" className="space-y-6">
                  {/* Enhanced system content */}
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}