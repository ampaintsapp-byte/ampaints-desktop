// unpaid-bills.tsx - Updated with detailed bill items and payment history
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  CreditCard, 
  Calendar, 
  User, 
  Phone, 
  Plus, 
  Eye, 
  Search, 
  Banknote, 
  Printer, 
  Receipt,
  Filter,
  X,
  ChevronDown,
  FileText,
  History,
  MessageSquare,
  Download,
  FileDown,
  Share2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Sale, ColorWithVariantAndProduct, PaymentHistoryWithSale } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Interfaces
interface CustomerSuggestion {
  customerName: string;
  customerPhone: string;
  lastSaleDate: string;
  totalSpent: number;
}

interface ConsolidatedCustomer {
  customerPhone: string;
  customerName: string;
  bills: Sale[];
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  oldestBillDate: Date;
  daysOverdue: number;
}

interface FilterType {
  search: string;
  amountRange: {
    min: string;
    max: string;
  };
  daysOverdue: string;
  dueDate: {
    from: string;
    to: string;
  };
  sortBy: "oldest" | "newest" | "highest" | "lowest" | "name";
}

interface SaleItem {
  id: string;
  saleId: string;
  colorId: string;
  quantity: number;
  rate: string;
  subtotal: string;
  color: {
    id: string;
    colorName: string;
    colorCode: string;
    variant: {
      id: string;
      variantName: string;
      packingSize: string;
      rate: string;
      product: {
        id: string;
        productName: string;
        company: string;
      };
    };
  };
}

interface SaleWithItems extends Sale {
  saleItems?: SaleItem[];
  paymentHistory?: PaymentHistoryWithSale[];
}

// Helper functions
const getPaymentStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge variant="default">Paid</Badge>;
    case "partial":
      return <Badge variant="secondary">Partial</Badge>;
    case "unpaid":
      return <Badge variant="outline">Unpaid</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getDaysOverdue = (createdAt: string | Date) => {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - created.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Format date to dd-mm-yyyy
const formatDate = (date: Date | string) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Format time to hh:mm:ss
const formatTime = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-PK', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
};

// Get receipt settings from localStorage
const getReceiptSettings = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const savedReceiptSettings = localStorage.getItem('posReceiptSettings');
    if (savedReceiptSettings) {
      return JSON.parse(savedReceiptSettings);
    }
  } catch (error) {
    console.error("Error loading receipt settings:", error);
  }
  
  return {
    businessName: "ALI MUHAMMAD PAINTS",
    address: "Basti Malook, Multan. 0300-868-3395",
    dealerText: "AUTHORIZED DEALER:",
    dealerBrands: "ICI-DULUX • MOBI PAINTS • WESTER 77",
    thankYou: "THANKS FOR YOUR BUSINESS",
    fontSize: "11",
    itemFontSize: "12",
    padding: "12"
  };
};

// Customer Card Actions Component
const CustomerCardActions = ({ customer, onView, onDownload, onShare }: { 
  customer: ConsolidatedCustomer;
  onView: (customer: ConsolidatedCustomer) => void;
  onDownload: (customer: ConsolidatedCustomer) => void;
  onShare: (customer: ConsolidatedCustomer) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <FileDown className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onView(customer)}>
        <FileText className="h-4 w-4 mr-2" />
        View Statement
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onDownload(customer)}>
        <Download className="h-4 w-4 mr-2" />
        Download Statement
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onShare(customer)}>
        <Share2 className="h-4 w-4 mr-2" />
        Share via WhatsApp
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// Customer Details Actions Component
const CustomerDetailsActions = ({ customer, onView, onDownload, onShare }: {
  customer: ConsolidatedCustomer;
  onView: (customer: ConsolidatedCustomer) => void;
  onDownload: (customer: ConsolidatedCustomer) => void;
  onShare: (customer: ConsolidatedCustomer) => void;
}) => (
  <div className="flex justify-end gap-2">
    <Button
      variant="outline"
      onClick={() => onView(customer)}
      className="flex items-center gap-2"
    >
      <FileText className="h-4 w-4" />
      View Statement
    </Button>
    <Button
      variant="outline"
      onClick={() => onDownload(customer)}
      className="flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      Download Statement
    </Button>
    <Button
      variant="outline"
      onClick={() => onShare(customer)}
      className="flex items-center gap-2"
    >
      <Share2 className="h-4 w-4" />
      Share via WhatsApp
    </Button>
  </div>
);

export default function UnpaidBills() {
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<SaleWithItems | null>(null);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [showBillPaymentHistory, setShowBillPaymentHistory] = useState(false);
  
  const [manualBalanceDialogOpen, setManualBalanceDialogOpen] = useState(false);
  const [manualBalanceForm, setManualBalanceForm] = useState({
    customerName: "",
    customerPhone: "",
    totalAmount: "",
    dueDate: "",
    notes: ""
  });
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  
  const { toast } = useToast();

  const [filters, setFilters] = useState<FilterType>({
    search: "",
    amountRange: {
      min: "",
      max: ""
    },
    daysOverdue: "",
    dueDate: {
      from: "",
      to: ""
    },
    sortBy: "oldest"
  });

  // Queries
  const { data: customerSuggestions = [] } = useQuery<CustomerSuggestion[]>({
    queryKey: ["/api/customers/suggestions"],
  });

  const { data: unpaidSales = [], isLoading } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales/unpaid"],
  });

  const { data: customerPaymentHistory = [] } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: [`/api/payment-history/customer/${selectedCustomerPhone}`],
    enabled: !!selectedCustomerPhone && showPaymentHistory,
  });

  // Fetch detailed bill data when a bill is selected
  const { data: billDetails } = useQuery<SaleWithItems>({
    queryKey: ["/api/sales", selectedBill?.id],
    enabled: !!selectedBill?.id && showBillDetails,
  });

  // Mutations
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number; paymentMethod?: string; notes?: string }) => {
      return await apiRequest("POST", `/api/sales/${data.saleId}/payment`, { 
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: [`/api/payment-history/customer/${selectedCustomerPhone}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales", selectedBill?.id] });
      toast({ title: "Payment recorded successfully" });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentMethod("cash");
      setPaymentNotes("");
    },
    onError: (error: Error) => {
      console.error("Payment recording error:", error);
      toast({ title: "Failed to record payment", variant: "destructive" });
    },
  });

  const createManualBalanceMutation = useMutation({
    mutationFn: async (data: { customerName: string; customerPhone: string; totalAmount: string; dueDate?: string; notes?: string }) => {
      return await apiRequest("POST", "/api/sales/manual-balance", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ 
        title: "New pending balance added successfully",
        description: "A new separate bill has been created for this customer"
      });
      setManualBalanceDialogOpen(false);
      setManualBalanceForm({
        customerName: "",
        customerPhone: "",
        totalAmount: "",
        dueDate: "",
        notes: ""
      });
    },
    onError: (error: Error) => {
      console.error("Create manual balance error:", error);
      toast({ title: "Failed to add pending balance", variant: "destructive" });
    },
  });

  // Memoized computations
  const consolidatedCustomers = useMemo(() => {
    const customerMap = new Map<string, ConsolidatedCustomer>();
    
    unpaidSales.forEach(sale => {
      const phone = sale.customerPhone;
      const existing = customerMap.get(phone);
      
      const totalAmount = parseFloat(sale.totalAmount);
      const totalPaid = parseFloat(sale.amountPaid);
      const outstanding = totalAmount - totalPaid;
      const billDate = new Date(sale.createdAt);
      const daysOverdue = getDaysOverdue(billDate);
      
      if (existing) {
        existing.bills.push(sale);
        existing.totalAmount += totalAmount;
        existing.totalPaid += totalPaid;
        existing.totalOutstanding += outstanding;
        if (billDate < existing.oldestBillDate) {
          existing.oldestBillDate = billDate;
          existing.daysOverdue = daysOverdue;
        }
      } else {
        customerMap.set(phone, {
          customerPhone: phone,
          customerName: sale.customerName,
          bills: [sale],
          totalAmount,
          totalPaid,
          totalOutstanding: outstanding,
          oldestBillDate: billDate,
          daysOverdue,
        });
      }
    });
    
    return Array.from(customerMap.values());
  }, [unpaidSales]);

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = [...consolidatedCustomers];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(customer => 
        customer.customerName.toLowerCase().includes(searchLower) ||
        customer.customerPhone.includes(searchLower)
      );
    }

    if (filters.amountRange.min) {
      const min = parseFloat(filters.amountRange.min);
      filtered = filtered.filter(customer => customer.totalOutstanding >= min);
    }
    if (filters.amountRange.max) {
      const max = parseFloat(filters.amountRange.max);
      filtered = filtered.filter(customer => customer.totalOutstanding <= max);
    }

    if (filters.daysOverdue) {
      const days = parseInt(filters.daysOverdue);
      filtered = filtered.filter(customer => customer.daysOverdue >= days);
    }

    if (filters.dueDate.from || filters.dueDate.to) {
      const fromDate = filters.dueDate.from ? new Date(filters.dueDate.from) : null;
      const toDate = filters.dueDate.to ? new Date(filters.dueDate.to) : null;
      
      filtered = filtered.filter(customer => {
        return customer.bills.some(bill => {
          if (!bill.dueDate) return false;
          const dueDate = new Date(bill.dueDate);
          
          if (fromDate && toDate) {
            return dueDate >= fromDate && dueDate <= toDate;
          } else if (fromDate) {
            return dueDate >= fromDate;
          } else if (toDate) {
            return dueDate <= toDate;
          }
          return false;
        });
      });
    }

    switch (filters.sortBy) {
      case "newest":
        filtered.sort((a, b) => b.oldestBillDate.getTime() - a.oldestBillDate.getTime());
        break;
      case "highest":
        filtered.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
        break;
      case "lowest":
        filtered.sort((a, b) => a.totalOutstanding - b.totalOutstanding);
        break;
      case "name":
        filtered.sort((a, b) => a.customerName.localeCompare(b.customerName));
        break;
      case "oldest":
      default:
        filtered.sort((a, b) => a.oldestBillDate.getTime() - b.oldestBillDate.getTime());
        break;
    }

    return filtered;
  }, [consolidatedCustomers, filters]);

  const selectedCustomer = consolidatedCustomers.find(c => c.customerPhone === selectedCustomerPhone);
  const hasActiveFilters = filters.search || filters.amountRange.min || filters.amountRange.max || filters.daysOverdue || filters.dueDate.from || filters.dueDate.to;

  // Event handlers
  const handleRecordPayment = async () => {
    if (!selectedCustomer || !paymentAmount) {
      toast({ title: "Please enter payment amount", variant: "destructive" });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      toast({ title: "Payment amount must be positive", variant: "destructive" });
      return;
    }

    if (amount > selectedCustomer.totalOutstanding) {
      toast({ 
        title: `Payment amount exceeds outstanding balance`, 
        variant: "destructive" 
      });
      return;
    }

    const sortedBills = [...selectedCustomer.bills].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let remainingPayment = amount;
    const paymentsToApply: { saleId: string; amount: number }[] = [];

    for (const bill of sortedBills) {
      if (remainingPayment <= 0) break;
      
      const billTotal = parseFloat(bill.totalAmount);
      const billPaid = parseFloat(bill.amountPaid);
      const billOutstanding = billTotal - billPaid;
      
      if (billOutstanding > 0) {
        const paymentForThisBill = Math.min(remainingPayment, billOutstanding);
        paymentsToApply.push({ saleId: bill.id, amount: paymentForThisBill });
        remainingPayment -= paymentForThisBill;
      }
    }

    try {
      for (const payment of paymentsToApply) {
        await recordPaymentMutation.mutateAsync({
          saleId: payment.saleId,
          amount: payment.amount,
          paymentMethod,
          notes: paymentNotes
        });
      }
      
      toast({ 
        title: `Payment of Rs. ${Math.round(amount).toLocaleString()} recorded successfully`,
        description: `Method: ${paymentMethod}${paymentNotes ? ` - ${paymentNotes}` : ''}`
      });
      
      setSelectedCustomerPhone(null);
    } catch (error) {
      console.error("Payment processing error:", error);
      toast({ title: "Failed to record payment", variant: "destructive" });
    }
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      amountRange: { min: "", max: "" },
      daysOverdue: "",
      dueDate: { from: "", to: "" },
      sortBy: "oldest"
    });
  };

  const selectCustomer = (customer: CustomerSuggestion) => {
    setManualBalanceForm(prev => ({
      ...prev,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone
    }));
    setCustomerSuggestionsOpen(false);
  };

  // View bill details
  const handleViewBillDetails = (bill: Sale) => {
    setSelectedBill(bill as SaleWithItems);
    setShowBillDetails(true);
  };

  // Helper function to get product line
  const getProductLine = (item: SaleItem) => {
    return `${item.color.variant.product.productName} - ${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
  };

  // Generate detailed customer statement PDF with glassy design
  const generateCustomerPDFStatement = (customer: ConsolidatedCustomer) => {
    const receiptSettings = getReceiptSettings();
    const currentDate = formatDate(new Date());
    const currentTime = formatTime(new Date());
    
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Customer Statement - ${customer.customerName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { 
            font-family: 'Segoe UI', system-ui, sans-serif; 
            color: #2d3748; 
            margin: 0; 
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            max-width: 100%;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            box-shadow: 
              0 20px 40px rgba(0, 0, 0, 0.1),
              0 0 0 1px rgba(255, 255, 255, 0.2);
            overflow: hidden;
            margin: 20px;
          }
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%);
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
            position: relative;
          }
          .header p {
            margin: 8px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
            position: relative;
          }
          .store-info {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            padding: 20px;
            margin: 20px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            text-align: center;
          }
          .store-info h2 {
            margin: 0 0 12px 0;
            color: #1a202c;
            font-size: 20px;
            font-weight: 600;
          }
          .customer-info {
            background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
            color: white;
            padding: 24px;
            margin: 20px;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
          }
          .customer-info h3 {
            margin: 0 0 16px 0;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .info-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          }
          .info-label {
            font-weight: 500;
            opacity: 0.9;
          }
          .info-value {
            font-weight: 600;
          }
          .section {
            margin: 20px;
          }
          .section-title {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 16px 20px;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 20px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          }
          th {
            background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
            color: white;
            text-align: left;
            padding: 12px 16px;
            font-size: 12px;
            font-weight: 600;
          }
          td {
            padding: 12px 16px;
            font-size: 11px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          }
          .amount {
            text-align: right;
            font-family: 'SF Mono', Monaco, monospace;
            font-weight: 600;
          }
          .total-row {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            font-weight: 700;
          }
          .total-row td {
            border-bottom: none;
            color: #92400e;
          }
          .status {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
            text-align: center;
          }
          .status-paid {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
          }
          .status-partial {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
          }
          .status-unpaid {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin: 20px;
          }
          .summary-card {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            padding: 20px;
            border-radius: 16px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
          }
          .summary-card:hover {
            transform: translateY(-4px);
          }
          .summary-card h3 {
            margin: 0 0 8px 0;
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .summary-card p {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
          }
          .summary-card.outstanding p {
            color: #dc2626;
          }
          .footer {
            background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
            color: white;
            padding: 24px;
            text-align: center;
            margin-top: 30px;
          }
          .footer p {
            margin: 4px 0;
            font-size: 12px;
            opacity: 0.8;
          }
          .notes {
            background: rgba(56, 189, 248, 0.1);
            padding: 12px 16px;
            border-radius: 8px;
            border-left: 4px solid #0ea5e9;
            margin: 8px 0;
            font-size: 11px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }
          .items-table th {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            text-align: left;
            padding: 14px 16px;
            font-size: 12px;
            font-weight: 600;
          }
          .items-table td {
            padding: 12px 16px;
            font-size: 11px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          }
          .items-table .amount {
            text-align: right;
            font-family: 'SF Mono', Monaco, monospace;
            font-weight: 600;
          }
          .payment-history {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 20px;
            margin: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }
          .payment-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          }
          .payment-item:last-child {
            border-bottom: none;
          }
          .payment-method {
            background: #e5e7eb;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Customer Statement</h1>
            <p>Comprehensive Financial Overview • ${currentDate} at ${currentTime}</p>
          </div>

          <div class="store-info">
            <h2>${receiptSettings.businessName}</h2>
            <p>${receiptSettings.address}</p>
            <p><strong>${receiptSettings.dealerText}</strong> ${receiptSettings.dealerBrands}</p>
          </div>

          <div class="customer-info">
            <h3>👤 Customer Profile</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Customer Name:</span>
                <span class="info-value">${customer.customerName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Phone Number:</span>
                <span class="info-value">${customer.customerPhone}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total Bills:</span>
                <span class="info-value">${customer.bills.length}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Oldest Bill:</span>
                <span class="info-value">${formatDate(customer.oldestBillDate)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Days Overdue:</span>
                <span class="info-value">${customer.daysOverdue} days</span>
              </div>
              <div class="info-item">
                <span class="info-label">Statement Date:</span>
                <span class="info-value">${currentDate}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">
              💰 Outstanding Bills • ${customer.bills.length} Total
            </div>
            <table>
              <thead>
                <tr>
                  <th>Bill Date</th>
                  <th>Bill ID</th>
                  <th>Total Amount</th>
                  <th>Amount Paid</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
    `;
    
    customer.bills.forEach((bill) => {
      const billTotal = parseFloat(bill.totalAmount);
      const billPaid = parseFloat(bill.amountPaid);
      const billOutstanding = billTotal - billPaid;
      const billDate = new Date(bill.createdAt);
      const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
      
      const statusClass = bill.paymentStatus === 'paid' ? 'status-paid' : 
                         bill.paymentStatus === 'partial' ? 'status-partial' : 'status-unpaid';
      const statusText = bill.paymentStatus.toUpperCase();
      
      pdfHTML += `
                <tr>
                  <td>${formatDate(billDate)}</td>
                  <td>${bill.id.slice(-8)}</td>
                  <td class="amount">Rs. ${billTotal.toFixed(2)}</td>
                  <td class="amount">Rs. ${billPaid.toFixed(2)}</td>
                  <td class="amount">Rs. ${billOutstanding.toFixed(2)}</td>
                  <td><span class="status ${statusClass}">${statusText}</span></td>
                  <td>${dueDate ? formatDate(dueDate) : '-'}</td>
                </tr>
      `;
      
      if (bill.isManualBalance && bill.notes) {
        pdfHTML += `
                <tr>
                  <td colspan="7" class="notes">
                    <strong>Note:</strong> ${bill.notes}
                  </td>
                </tr>
        `;
      }
    });
    
    pdfHTML += `
                <tr class="total-row">
                  <td colspan="2"><strong>TOTAL OUTSTANDING</strong></td>
                  <td class="amount"><strong>Rs. ${customer.totalAmount.toFixed(2)}</strong></td>
                  <td class="amount"><strong>Rs. ${customer.totalPaid.toFixed(2)}</strong></td>
                  <td class="amount"><strong>Rs. ${customer.totalOutstanding.toFixed(2)}</strong></td>
                  <td colspan="2"></td>
                </tr>
              </tbody>
            </table>
          </div>
    `;

    // Payment History Section
    if (customerPaymentHistory.length > 0) {
      pdfHTML += `
          <div class="section">
            <div class="section-title">
              💳 Payment History • ${customerPaymentHistory.length} Records
            </div>
            <table>
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Bill Date</th>
                  <th>Payment Method</th>
                  <th>Amount Paid</th>
                  <th>New Balance</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      customerPaymentHistory.forEach((payment) => {
        pdfHTML += `
                <tr>
                  <td>${formatDate(payment.createdAt)}</td>
                  <td>${formatDate(payment.sale.createdAt)}</td>
                  <td>${payment.paymentMethod}</td>
                  <td class="amount">Rs. ${parseFloat(payment.amount).toFixed(2)}</td>
                  <td class="amount">Rs. ${parseFloat(payment.newBalance).toFixed(2)}</td>
                  <td>${payment.notes || '-'}</td>
                </tr>
        `;
      });
      
      pdfHTML += `
              </tbody>
            </table>
          </div>
      `;
    }

    // Summary Section
    pdfHTML += `
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Total Bills</h3>
              <p>${customer.bills.length}</p>
            </div>
            <div class="summary-card">
              <h3>Total Amount</h3>
              <p>Rs. ${customer.totalAmount.toFixed(2)}</p>
            </div>
            <div class="summary-card">
              <h3>Amount Paid</h3>
              <p>Rs. ${customer.totalPaid.toFixed(2)}</p>
            </div>
            <div class="summary-card outstanding">
              <h3>Outstanding Balance</h3>
              <p>Rs. ${customer.totalOutstanding.toFixed(2)}</p>
            </div>
          </div>

          <div class="footer">
            <p>${receiptSettings.businessName} • ${receiptSettings.address}</p>
            <p>Customer Statement for ${customer.customerName} • Generated on ${currentDate}</p>
            <p><strong>${receiptSettings.thankYou}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return pdfHTML;
  };

  // Generate detailed bill PDF
  const generateBillPDF = (bill: SaleWithItems) => {
    const receiptSettings = getReceiptSettings();
    const billDate = new Date(bill.createdAt);
    const formattedDate = formatDate(billDate);
    const formattedTime = formatTime(billDate);
    
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bill Details - ${bill.id.slice(-8)}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { 
            font-family: 'Segoe UI', system-ui, sans-serif; 
            color: #2d3748; 
            margin: 0; 
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            max-width: 100%;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            box-shadow: 
              0 20px 40px rgba(0, 0, 0, 0.1),
              0 0 0 1px rgba(255, 255, 255, 0.2);
            overflow: hidden;
            margin: 20px;
          }
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%);
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
            position: relative;
          }
          .header p {
            margin: 8px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
            position: relative;
          }
          .store-info {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            padding: 20px;
            margin: 20px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            text-align: center;
          }
          .store-info h2 {
            margin: 0 0 12px 0;
            color: #1a202c;
            font-size: 20px;
            font-weight: 600;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px;
          }
          .info-card {
            background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
            color: white;
            padding: 20px;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
          }
          .info-card h3 {
            margin: 0 0 16px 0;
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .info-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          }
          .info-label {
            font-weight: 500;
            opacity: 0.9;
          }
          .info-value {
            font-weight: 600;
          }
          .amount-section {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 24px;
            margin: 20px;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(245, 158, 11, 0.3);
          }
          .amount-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            text-align: center;
          }
          .amount-item {
            padding: 16px;
          }
          .amount-label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 8px;
          }
          .amount-value {
            font-size: 20px;
            font-weight: 700;
            font-family: 'SF Mono', Monaco, monospace;
          }
          .payment-status {
            display: inline-block;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 14px;
            margin: 16px 0 0 0;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          }
          .status-paid {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          }
          .status-partial {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          }
          .status-unpaid {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          }
          .section {
            margin: 20px;
          }
          .section-title {
            background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
            color: white;
            padding: 16px 20px;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 20px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 16px rgba(107, 114, 128, 0.3);
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }
          .items-table th {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            text-align: left;
            padding: 14px 16px;
            font-size: 12px;
            font-weight: 600;
          }
          .items-table td {
            padding: 12px 16px;
            font-size: 11px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          }
          .items-table .amount {
            text-align: right;
            font-family: 'SF Mono', Monaco, monospace;
            font-weight: 600;
          }
          .total-row {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            font-weight: 700;
          }
          .total-row td {
            border-bottom: none;
            color: #92400e;
          }
          .footer {
            background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
            color: white;
            padding: 24px;
            text-align: center;
            margin-top: 30px;
          }
          .footer p {
            margin: 4px 0;
            font-size: 12px;
            opacity: 0.8;
          }
          .barcode {
            text-align: center;
            margin: 20px 0;
            font-family: monospace;
            letter-spacing: 2px;
            color: #6b7280;
          }
          .thank-you {
            text-align: center;
            margin: 20px 0;
            font-style: italic;
            color: #6b7280;
            font-size: 14px;
          }
          .payment-history {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 20px;
            margin: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }
          .payment-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          }
          .payment-item:last-child {
            border-bottom: none;
          }
          .payment-method {
            background: #e5e7eb;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 Bill Details</h1>
            <p>Complete Transaction Information • ${formattedDate} at ${formattedTime}</p>
          </div>

          <div class="store-info">
            <h2>${receiptSettings.businessName}</h2>
            <p>${receiptSettings.address}</p>
            <p><strong>${receiptSettings.dealerText}</strong> ${receiptSettings.dealerBrands}</p>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <h3>📄 Bill Information</h3>
              <div class="info-item">
                <span class="info-label">Bill ID:</span>
                <span class="info-value">${bill.id.slice(-8).toUpperCase()}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Date:</span>
                <span class="info-value">${formattedDate}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Time:</span>
                <span class="info-value">${formattedTime}</span>
              </div>
              ${bill.dueDate ? `
              <div class="info-item">
                <span class="info-label">Due Date:</span>
                <span class="info-value">${formatDate(bill.dueDate)}</span>
              </div>
              ` : ''}
            </div>

            <div class="info-card">
              <h3>👤 Customer Information</h3>
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">${bill.customerName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Phone:</span>
                <span class="info-value">${bill.customerPhone}</span>
              </div>
            </div>
          </div>
    `;

    // Items Table
    if (bill.saleItems && bill.saleItems.length > 0) {
      pdfHTML += `
        <div class="section">
          <div class="section-title">🛒 Items Details • ${bill.saleItems.length} Items</div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Product Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      bill.saleItems.forEach((item, index) => {
        const productLine = `${item.color.variant.product.productName} - ${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
        
        pdfHTML += `
              <tr>
                <td>${productLine}</td>
                <td>${item.quantity}</td>
                <td class="amount">Rs. ${Math.round(parseFloat(item.rate)).toLocaleString()}</td>
                <td class="amount">Rs. ${Math.round(parseFloat(item.subtotal)).toLocaleString()}</td>
              </tr>
        `;
      });
      
      pdfHTML += `
              <tr class="total-row">
                <td colspan="3"><strong>GRAND TOTAL</strong></td>
                <td class="amount"><strong>Rs. ${Math.round(parseFloat(bill.totalAmount)).toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Payment History Section
    if (bill.paymentHistory && bill.paymentHistory.length > 0) {
      pdfHTML += `
        <div class="section">
          <div class="section-title">💳 Payment History • ${bill.paymentHistory.length} Payments</div>
          <div class="payment-history">
      `;
      
      bill.paymentHistory.forEach((payment, index) => {
        pdfHTML += `
            <div class="payment-item">
              <div>
                <div style="font-weight: 600; margin-bottom: 4px;">${formatDate(payment.createdAt)}</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="payment-method">${payment.paymentMethod.toUpperCase()}</span>
                  ${payment.notes ? `<span style="font-size: 10px; color: #6b7280;">${payment.notes}</span>` : ''}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-family: 'SF Mono', Monaco, monospace; font-weight: 700; color: #059669; font-size: 14px;">
                  +Rs. ${Math.round(parseFloat(payment.amount)).toLocaleString()}
                </div>
                <div style="font-size: 10px; color: #6b7280;">
                  Balance: Rs. ${Math.round(parseFloat(payment.newBalance)).toLocaleString()}
                </div>
              </div>
            </div>
        `;
      });
      
      pdfHTML += `
          </div>
        </div>
      `;
    }

    // Amount Summary
    const outstanding = parseFloat(bill.totalAmount) - parseFloat(bill.amountPaid);
    
    pdfHTML += `
      <div class="amount-section">
        <div class="amount-grid">
          <div class="amount-item">
            <div class="amount-label">Total Amount</div>
            <div class="amount-value">Rs. ${Math.round(parseFloat(bill.totalAmount)).toLocaleString()}</div>
          </div>
          <div class="amount-item">
            <div class="amount-label">Amount Paid</div>
            <div class="amount-value">Rs. ${Math.round(parseFloat(bill.amountPaid)).toLocaleString()}</div>
          </div>
          <div class="amount-item">
            <div class="amount-label">Balance Due</div>
            <div class="amount-value">
              Rs. ${Math.round(outstanding).toLocaleString()}
            </div>
          </div>
        </div>
        
        <div style="text-align: center;">
          <div class="payment-status ${
            bill.paymentStatus === 'paid' ? 'status-paid' : 
            bill.paymentStatus === 'partial' ? 'status-partial' : 'status-unpaid'
          }">
            ${bill.paymentStatus.toUpperCase()} 
            ${bill.paymentStatus === 'partial' ? 'PAYMENT' : ''}
          </div>
        </div>
      </div>

      <div class="barcode">
        ▮▮ ▮ ▮▮▮ ▮ ▮▮▮ ▮ ▮▮ ▮▮▮<br/>
        <small>Bill ID: ${bill.id.slice(-8).toUpperCase()}</small>
      </div>

      <div class="thank-you">
        ${receiptSettings.thankYou}! 🎨<br/>
        We appreciate your trust in ${receiptSettings.businessName}
      </div>

      <div class="footer">
        <p>${receiptSettings.businessName} • ${receiptSettings.address}</p>
        <p>Generated on ${formatDate(new Date())} • This is a computer-generated bill</p>
      </div>
    </body>
    </html>
    `;

    return pdfHTML;
  };

  // Download PDF for individual customer
  const downloadCustomerPDFStatement = (customer: ConsolidatedCustomer) => {
    const pdfHTML = generateCustomerPDFStatement(customer);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statement_${customer.customerName}_${formatDate(new Date()).replace(/\//g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({ 
      title: "Statement Downloaded", 
      description: `Customer statement for ${customer.customerName} has been downloaded` 
    });
  };

  // View PDF for individual customer
  const viewCustomerPDFStatement = (customer: ConsolidatedCustomer) => {
    const pdfHTML = generateCustomerPDFStatement(customer);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    toast({ 
      title: "Statement Opened", 
      description: `Customer statement for ${customer.customerName} is ready for viewing/printing` 
    });
  };

  // View PDF for individual bill
  const viewBillPDF = (bill: SaleWithItems) => {
    const pdfHTML = generateBillPDF(bill);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    toast({ 
      title: "Bill Opened", 
      description: `Bill details are ready for viewing/printing` 
    });
  };

  // Share customer statement via WhatsApp
  const shareCustomerStatement = (customer: ConsolidatedCustomer) => {
    const message = `📊 *${getReceiptSettings().businessName} - Customer Statement*

*Customer:* ${customer.customerName}
*Phone:* ${customer.customerPhone}
*Statement Date:* ${formatDate(new Date())}

*Outstanding Summary:*
📋 Total Bills: ${customer.bills.length}
💰 Total Amount: Rs. ${customer.totalAmount.toFixed(2)}
💳 Amount Paid: Rs. ${customer.totalPaid.toFixed(2)}
⚖️ Outstanding: Rs. ${customer.totalOutstanding.toFixed(2)}
📅 Oldest Bill: ${formatDate(customer.oldestBillDate)}
⏰ Days Overdue: ${customer.daysOverdue} days

*Contact Information:*
🏪 ${getReceiptSettings().businessName}
📍 ${getReceiptSettings().address}

Please clear your outstanding balance at your earliest convenience.

${getReceiptSettings().thankYou}`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customer.customerPhone.replace('+', '')}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    toast({ 
      title: "Statement Shared", 
      description: `Customer statement sent to ${customer.customerName} via WhatsApp` 
    });
  };

  // Generate PDF statement for all customers
  const generatePDFStatement = () => {
    const receiptSettings = getReceiptSettings();
    const currentDate = formatDate(new Date());
    
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Unpaid Bills Summary</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; color: #2d3748; margin: 0; padding: 20px; }
          .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0; color: #2563eb; font-size: 28px; }
          .header p { margin: 5px 0; color: #666; font-size: 14px; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { background: #2563eb; color: white; padding: 10px 15px; font-size: 16px; font-weight: bold; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f3f4f6; text-align: left; padding: 10px; font-size: 12px; border-bottom: 2px solid #ddd; }
          td { padding: 8px 10px; font-size: 11px; border-bottom: 1px solid #eee; }
          .amount { text-align: right; font-family: monospace; font-weight: 600; }
          .total-row { background: #fef3c7; font-weight: bold; border-top: 2px solid #2563eb; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Unpaid Bills Summary</h1>
          <p>Generated on ${currentDate}</p>
        </div>

        <div class="section">
          <div class="section-title">All Unpaid Bills (${filteredAndSortedCustomers.length} Customers)</div>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th class="amount">Total</th>
                <th class="amount">Paid</th>
                <th class="amount">Outstanding</th>
                <th>Bills</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    filteredAndSortedCustomers.forEach(customer => {
      pdfHTML += `
            <tr>
              <td>${customer.customerName}</td>
              <td>${customer.customerPhone}</td>
              <td class="amount">Rs. ${customer.totalAmount.toFixed(2)}</td>
              <td class="amount">Rs. ${customer.totalPaid.toFixed(2)}</td>
              <td class="amount">Rs. ${customer.totalOutstanding.toFixed(2)}</td>
              <td>${customer.bills.length}</td>
            </tr>
      `;
    });
    
    const totalOutstanding = filteredAndSortedCustomers.reduce((sum, c) => sum + c.totalOutstanding, 0);
    
    pdfHTML += `
            <tr class="total-row">
              <td colspan="2"><strong>Grand Total</strong></td>
              <td class="amount"><strong>Rs. ${filteredAndSortedCustomers.reduce((sum, c) => sum + c.totalAmount, 0).toFixed(2)}</strong></td>
              <td class="amount"><strong>Rs. ${filteredAndSortedCustomers.reduce((sum, c) => sum + c.totalPaid, 0).toFixed(2)}</strong></td>
              <td class="amount"><strong>Rs. ${totalOutstanding.toFixed(2)}</strong></td>
              <td><strong>${filteredAndSortedCustomers.reduce((sum, c) => sum + c.bills.length, 0)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>${receiptSettings.businessName} • Statement generated on ${currentDate}</p>
        <p>This is a system-generated report</p>
      </div>
    </body>
    </html>
    `;

    // Create blob and open in new tab for printing
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    toast({ title: "PDF Statement opened for printing" });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Unpaid Bills
            </h1>
            <p className="text-sm text-muted-foreground">Track and manage outstanding payments</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="default" 
              onClick={() => setManualBalanceDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Pending Balance
            </Button>

            <Button 
              variant="outline" 
              onClick={generatePDFStatement}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              PDF Statement
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-9"
            />
          </div>

          <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Filters</h4>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Amount Range</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Min"
                        value={filters.amountRange.min}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          amountRange: { ...prev.amountRange, min: e.target.value }
                        }))}
                        type="number"
                      />
                      <Input
                        placeholder="Max"
                        value={filters.amountRange.max}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          amountRange: { ...prev.amountRange, max: e.target.value }
                        }))}
                        type="number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Minimum Days Overdue</Label>
                    <Input
                      placeholder="e.g., 30"
                      value={filters.daysOverdue}
                      onChange={(e) => setFilters(prev => ({ ...prev, daysOverdue: e.target.value }))}
                      type="number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Due Date Range</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="From"
                        value={filters.dueDate.from}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          dueDate: { ...prev.dueDate, from: e.target.value }
                        }))}
                        type="date"
                      />
                      <Input
                        placeholder="To"
                        value={filters.dueDate.to}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          dueDate: { ...prev.dueDate, to: e.target.value }
                        }))}
                        type="date"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Sort By</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={filters.sortBy === "oldest" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: "oldest" }))}
                      >
                        Oldest First
                      </Button>
                      <Button
                        variant={filters.sortBy === "newest" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: "newest" }))}
                      >
                        Newest First
                      </Button>
                      <Button
                        variant={filters.sortBy === "highest" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: "highest" }))}
                      >
                        Highest Amount
                      </Button>
                      <Button
                        variant={filters.sortBy === "lowest" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, sortBy: "lowest" }))}
                      >
                        Lowest Amount
                      </Button>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="w-full mt-2"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filters Applied
          </Badge>
          {filters.search && (
            <Badge variant="outline">
              Search: "{filters.search}"
            </Badge>
          )}
          {filters.amountRange.min && (
            <Badge variant="outline">
              Min: Rs. {parseFloat(filters.amountRange.min).toLocaleString()}
            </Badge>
          )}
          {filters.amountRange.max && (
            <Badge variant="outline">
              Max: Rs. {parseFloat(filters.amountRange.max).toLocaleString()}
            </Badge>
          )}
          {filters.daysOverdue && (
            <Badge variant="outline">
              {filters.daysOverdue}+ Days Overdue
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="ml-auto h-6 px-2"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredAndSortedCustomers.length} of {consolidatedCustomers.length} customers
        </p>
        {hasActiveFilters && (
          <p className="text-sm text-muted-foreground">
            Total Outstanding: Rs. {Math.round(filteredAndSortedCustomers.reduce((sum, customer) => sum + customer.totalOutstanding, 0)).toLocaleString()}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAndSortedCustomers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">
              {hasActiveFilters ? "No customers match your filters" : "No unpaid bills"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? "Try adjusting your filters" : "All payments are up to date"}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedCustomers.map((customer) => {
            return (
              <Card key={customer.customerPhone} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        {customer.customerName}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {customer.customerPhone}
                      </div>
                    </div>
                    <CustomerCardActions
                      customer={customer}
                      onView={viewCustomerPDFStatement}
                      onDownload={downloadCustomerPDFStatement}
                      onShare={shareCustomerStatement}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
                      <p className="text-2xl font-bold text-red-600">
                        Rs. {Math.round(customer.totalOutstanding).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Total Bills</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {customer.bills.length}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span className="font-medium">Rs. {Math.round(customer.totalAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount Paid:</span>
                      <span className="font-medium text-green-600">Rs. {Math.round(customer.totalPaid).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Oldest Bill:</span>
                      <span className="font-medium">{formatDate(customer.oldestBillDate)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days Overdue:</span>
                      <Badge variant={customer.daysOverdue > 30 ? "destructive" : "secondary"}>
                        {customer.daysOverdue} days
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedCustomerPhone(customer.customerPhone);
                        setPaymentDialogOpen(true);
                      }}
                    >
                      <Banknote className="h-4 w-4 mr-2" />
                      Record Payment
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCustomerPhone(customer.customerPhone);
                        setShowPaymentHistory(true);
                      }}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {selectedCustomer?.customerName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Outstanding Balance:</span>
                  <span className="text-lg font-bold text-red-600">
                    Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount *</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="digital">Digital Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Notes (Optional)</Label>
                <Textarea
                  id="paymentNotes"
                  placeholder="Add any notes about this payment"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || recordPaymentMutation.isPending}
            >
              {recordPaymentMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Record Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Balance Dialog */}
      <Dialog open={manualBalanceDialogOpen} onOpenChange={setManualBalanceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Pending Balance</DialogTitle>
            <DialogDescription>
              Create a new pending balance entry for a customer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                placeholder="Enter customer name"
                value={manualBalanceForm.customerName}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, customerName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone Number *</Label>
              <div className="relative">
                <Input
                  id="customerPhone"
                  placeholder="Enter phone number"
                  value={manualBalanceForm.customerPhone}
                  onChange={(e) => setManualBalanceForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                  onFocus={() => setCustomerSuggestionsOpen(true)}
                />
                <Popover open={customerSuggestionsOpen} onOpenChange={setCustomerSuggestionsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search customers..." />
                      <CommandList>
                        <CommandEmpty>No customers found.</CommandEmpty>
                        <CommandGroup>
                          {customerSuggestions.map((customer) => (
                            <CommandItem
                              key={customer.customerPhone}
                              onSelect={() => selectCustomer(customer)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{customer.customerName}</span>
                                <span className="text-sm text-muted-foreground">{customer.customerPhone}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Amount *</Label>
              <Input
                id="totalAmount"
                type="number"
                placeholder="Enter amount"
                value={manualBalanceForm.totalAmount}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, totalAmount: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={manualBalanceForm.dueDate}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this pending balance"
                value={manualBalanceForm.notes}
                onChange={(e) => setManualBalanceForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManualBalanceDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createManualBalanceMutation.mutate(manualBalanceForm)}
              disabled={!manualBalanceForm.customerName || !manualBalanceForm.customerPhone || !manualBalanceForm.totalAmount || createManualBalanceMutation.isPending}
            >
              {createManualBalanceMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pending Balance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={showPaymentHistory} onOpenChange={setShowPaymentHistory}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              Payment history for {selectedCustomer?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {customerPaymentHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payment history found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {customerPaymentHistory.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{payment.paymentMethod}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(payment.createdAt)}
                        </span>
                      </div>
                      {payment.notes && (
                        <p className="text-sm text-muted-foreground">{payment.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        +Rs. {Math.round(parseFloat(payment.amount)).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Balance: Rs. {Math.round(parseFloat(payment.newBalance)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill Details Dialog */}
      <Dialog open={showBillDetails} onOpenChange={setShowBillDetails}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
            <DialogDescription>
              Detailed information for bill {selectedBill?.id.slice(-8)}
            </DialogDescription>
          </DialogHeader>

          {billDetails && (
            <div className="space-y-6">
              {/* Bill Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                <div>
                  <h4 className="font-semibold mb-2">Bill Information</h4>
                  <div className="space-y-1 text-sm">
                    <p>Date: {formatDate(billDetails.createdAt)}</p>
                    <p>Bill ID: {billDetails.id.slice(-8)}</p>
                    {billDetails.dueDate && (
                      <p>Due Date: {formatDate(billDetails.dueDate)}</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Customer Information</h4>
                  <div className="space-y-1 text-sm">
                    <p>Name: {billDetails.customerName}</p>
                    <p>Phone: {billDetails.customerPhone}</p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              {billDetails.saleItems && billDetails.saleItems.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Items</h4>
                  <div className="border rounded-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 text-sm font-medium">Product</th>
                          <th className="text-right p-3 text-sm font-medium">Qty</th>
                          <th className="text-right p-3 text-sm font-medium">Rate</th>
                          <th className="text-right p-3 text-sm font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billDetails.saleItems.map((item) => (
                          <tr key={item.id} className="border-b">
                            <td className="p-3 text-sm">
                              {getProductLine(item)}
                            </td>
                            <td className="p-3 text-sm text-right">{item.quantity}</td>
                            <td className="p-3 text-sm text-right">Rs. {Math.round(parseFloat(item.rate)).toLocaleString()}</td>
                            <td className="p-3 text-sm text-right font-medium">Rs. {Math.round(parseFloat(item.subtotal)).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 font-semibold">
                          <td colSpan={3} className="p-3 text-sm text-right">Total Amount:</td>
                          <td className="p-3 text-sm text-right">Rs. {Math.round(parseFloat(billDetails.totalAmount)).toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-semibold">Rs. {Math.round(parseFloat(billDetails.totalAmount)).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-lg font-semibold text-green-600">Rs. {Math.round(parseFloat(billDetails.amountPaid)).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Balance Due</p>
                  <p className="text-lg font-semibold text-red-600">
                    Rs. {Math.round(parseFloat(billDetails.totalAmount) - parseFloat(billDetails.amountPaid)).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => viewBillPDF(billDetails)}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Bill
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBillPaymentHistory(true);
                    setShowBillDetails(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  Payment History
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bill Payment History Dialog */}
      <Dialog open={showBillPaymentHistory} onOpenChange={setShowBillPaymentHistory}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bill Payment History</DialogTitle>
            <DialogDescription>
              Payment history for bill {selectedBill?.id.slice(-8)}
            </DialogDescription>
          </DialogHeader>

          {billDetails?.paymentHistory && billDetails.paymentHistory.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {billDetails.paymentHistory.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{payment.paymentMethod}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(payment.createdAt)}
                      </span>
                    </div>
                    {payment.notes && (
                      <p className="text-sm text-muted-foreground">{payment.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      +Rs. {Math.round(parseFloat(payment.amount)).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      New Balance: Rs. {Math.round(parseFloat(payment.newBalance)).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payment history found for this bill</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}