import { useState, useMemo, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/hooks/use-debounce";

const VISIBLE_LIMIT_INITIAL = 50;
const VISIBLE_LIMIT_INCREMENT = 30;
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Calendar,
  Receipt,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  X,
  FileText,
  Users,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  BarChart3,
  RotateCcw,
} from "lucide-react";
import { Link } from "wouter";
import type { Sale, PaymentHistory, Return } from "@shared/schema";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { useDateFormat } from "@/hooks/use-date-format";

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale | null;
}

type SortField = "date" | "amount" | "customer";
type SortDirection = "asc" | "desc";

export default function Reports() {
  const { formatDateShort, parseDate: parseDateFromHook } = useDateFormat();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data: allSalesRaw = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    refetchOnWindowFocus: true,
  });

  const { data: paymentHistoryRaw = [], isLoading: historyLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    refetchOnWindowFocus: true,
  });

  const { data: returnsRaw = [], isLoading: returnsLoading } = useQuery<Return[]>({
    queryKey: ["/api/returns"],
    refetchOnWindowFocus: true,
  });

  const allSales = useDeferredValue(allSalesRaw);
  const paymentHistory = useDeferredValue(paymentHistoryRaw);
  const returns = useDeferredValue(returnsRaw);

  const parseDate = (dateStr: string | Date | null): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts[0].length === 4) {
        return parseISO(dateStr);
      } else {
        const [day, month, year] = parts.map(Number);
        return new Date(year, month - 1, day);
      }
    }
    return new Date(dateStr);
  };

  const formatDisplayDate = (dateStr: string | Date | null): string => {
    return formatDateShort(dateStr);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setPaymentStatusFilter("all");
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo || paymentStatusFilter !== "all";

  const filteredSales = useMemo(() => {
    let filtered = [...allSales];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (sale) =>
          sale.customerName.toLowerCase().includes(query) ||
          sale.customerPhone.includes(query)
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom));
      filtered = filtered.filter((sale) => {
        const saleDate = parseDate(sale.createdAt);
        return saleDate && !isBefore(saleDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo));
      filtered = filtered.filter((sale) => {
        const saleDate = parseDate(sale.createdAt);
        return saleDate && !isAfter(saleDate, toDate);
      });
    }

    if (paymentStatusFilter !== "all") {
      filtered = filtered.filter((sale) => sale.paymentStatus === paymentStatusFilter);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
          break;
        case "amount":
          comparison = parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
          break;
        case "customer":
          comparison = a.customerName.localeCompare(b.customerName);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [allSales, debouncedSearchQuery, dateFrom, dateTo, paymentStatusFilter, sortField, sortDirection]);
  
  const visibleSales = useMemo(() => {
    return filteredSales.slice(0, visibleLimit);
  }, [filteredSales, visibleLimit]);

  const filteredPayments = useMemo(() => {
    let filtered = [...paymentHistory];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (payment) =>
          payment.customerPhone.includes(query) ||
          (payment.sale?.customerName?.toLowerCase().includes(query))
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(new Date(dateFrom));
      filtered = filtered.filter((payment) => {
        const paymentDate = parseDate(payment.createdAt);
        return paymentDate && !isBefore(paymentDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(new Date(dateTo));
      filtered = filtered.filter((payment) => {
        const paymentDate = parseDate(payment.createdAt);
        return paymentDate && !isAfter(paymentDate, toDate);
      });
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
          break;
        case "amount":
          comparison = parseFloat(a.amount) - parseFloat(b.amount);
          break;
        case "customer":
          const nameA = a.sale?.customerName || "";
          const nameB = b.sale?.customerName || "";
          comparison = nameA.localeCompare(nameB);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [paymentHistory, debouncedSearchQuery, dateFrom, dateTo, sortField, sortDirection]);
  
  const visiblePayments = useMemo(() => {
    return filteredPayments.slice(0, visibleLimit);
  }, [filteredPayments, visibleLimit]);

  const unpaidSales = useMemo(() => {
    return filteredSales.filter((sale) => sale.paymentStatus !== "paid");
  }, [filteredSales]);

  const paidSales = useMemo(() => {
    return filteredSales.filter((sale) => sale.paymentStatus === "paid");
  }, [filteredSales]);

  const filteredSalesTotal = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }, [filteredSales]);

  const filteredSalesPaid = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
  }, [filteredSales]);

  const filteredSalesOutstanding = useMemo(() => {
    return filteredSalesTotal - filteredSalesPaid;
  }, [filteredSalesTotal, filteredSalesPaid]);

  const unpaidSalesTotal = useMemo(() => {
    return unpaidSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }, [unpaidSales]);

  const unpaidSalesPaid = useMemo(() => {
    return unpaidSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
  }, [unpaidSales]);

  const unpaidSalesOutstanding = useMemo(() => {
    return unpaidSalesTotal - unpaidSalesPaid;
  }, [unpaidSalesTotal, unpaidSalesPaid]);

  const filteredPaymentsTotal = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  }, [filteredPayments]);

  const stats = useMemo(() => {
    const totalSalesAmount = allSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
    const totalPaidAmount = allSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
    const totalUnpaidAmount = totalSalesAmount - totalPaidAmount;
    const totalRecoveryPayments = paymentHistory.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    const totalReturnsAmount = returns.reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
    const returnsCount = returns.length;
    
    const unpaidBillsCount = allSales.filter((sale) => sale.paymentStatus !== "paid").length;
    const paidBillsCount = allSales.filter((sale) => sale.paymentStatus === "paid").length;
    const totalBillsCount = allSales.length;

    const uniqueCustomers = new Set(allSales.map((sale) => sale.customerPhone)).size;

    return {
      totalSalesAmount,
      totalPaidAmount,
      totalUnpaidAmount,
      totalRecoveryPayments,
      totalReturnsAmount,
      returnsCount,
      unpaidBillsCount,
      paidBillsCount,
      totalBillsCount,
      totalPaymentRecords: paymentHistory.length,
      uniqueCustomers,
    };
  }, [allSales, paymentHistory, returns]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1" />
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700">Paid</Badge>;
      case "partial":
        return <Badge className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">Partial</Badge>;
      case "unpaid":
        return <Badge className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-700">Unpaid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const TableSummary = ({ tab }: { tab: string }) => {
    switch (tab) {
      case "all-sales":
        return (
          <div className="flex flex-wrap justify-between items-center p-4 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-slate-700/50">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Showing <span className="text-slate-900 dark:text-white">{filteredSales.length}</span> bills
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Total:</span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  Rs. {filteredSalesTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Paid:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  Rs. {filteredSalesPaid.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Outstanding:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  Rs. {filteredSalesOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        );
      
      case "unpaid-bills":
        return (
          <div className="flex flex-wrap justify-between items-center p-4 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-slate-700/50">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Showing <span className="text-slate-900 dark:text-white">{unpaidSales.length}</span> unpaid bills
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Bill Total:</span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  Rs. {unpaidSalesTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Paid:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  Rs. {unpaidSalesPaid.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Outstanding:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  Rs. {unpaidSalesOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        );
      
      case "recovery-payments":
        return (
          <div className="flex flex-wrap justify-between items-center p-4 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-slate-700/50">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Showing <span className="text-slate-900 dark:text-white">{filteredPayments.length}</span> payment records
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Total Recovery:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  Rs. {filteredPaymentsTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const isLoading = salesLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="p-6 space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white shadow-lg">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <BarChart3 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-reports-title">
                Financial Reports
              </h1>
              <p className="text-white/80 text-sm">Complete overview of sales, payments, and unpaid bills</p>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-xl" />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" data-testid="card-total-sales">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Sales</span>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                Rs. {Math.round(stats.totalSalesAmount).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stats.totalBillsCount} bills total</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" data-testid="card-paid-amount">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Paid Amount</span>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Rs. {Math.round(stats.totalPaidAmount).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stats.paidBillsCount} paid bills</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" data-testid="card-unpaid-amount">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Unpaid Amount</span>
                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                  <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                Rs. {Math.round(stats.totalUnpaidAmount).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stats.unpaidBillsCount} unpaid bills</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" data-testid="card-recovery-payments">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Recovery</span>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                Rs. {Math.round(stats.totalRecoveryPayments).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stats.totalPaymentRecords} records</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" data-testid="card-returns">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Returns</span>
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <RotateCcw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                Rs. {Math.round(stats.totalReturnsAmount).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stats.returnsCount} returns total</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card className="rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search customer name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-xl"
                    data-testid="input-search"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-auto border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-xl"
                    data-testid="input-date-from"
                  />
                  <span className="text-slate-400">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-auto border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-xl"
                    data-testid="input-date-to"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeTab !== "recovery-payments" && (
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger className="w-[140px] border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-xl" data-testid="select-payment-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters} 
                    data-testid="button-clear-filters"
                    className="text-slate-600 dark:text-slate-400"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-slate-100 dark:bg-zinc-800 rounded-xl p-1">
            <TabsTrigger 
              value="overview" 
              data-testid="tab-overview"
              className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <FileText className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="all-sales" 
              data-testid="tab-all-sales"
              className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <Receipt className="h-4 w-4 mr-2" />
              All Sales ({filteredSales.length})
            </TabsTrigger>
            <TabsTrigger 
              value="unpaid-bills" 
              data-testid="tab-unpaid-bills"
              className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Unpaid ({unpaidSales.length})
            </TabsTrigger>
            <TabsTrigger 
              value="recovery-payments" 
              data-testid="tab-recovery-payments"
              className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Recovery ({filteredPayments.length})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Customer Summary</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Total Customers</span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{stats.uniqueCustomers}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Customers with Unpaid</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                        {new Set(allSales.filter(s => s.paymentStatus !== "paid").map(s => s.customerPhone)).size}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Bill Summary</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Total Bills</span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{stats.totalBillsCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Paid Bills</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{stats.paidBillsCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Unpaid Bills</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{stats.unpaidBillsCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Payment Summary</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Collection Rate</span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                        {stats.totalSalesAmount > 0
                          ? ((stats.totalPaidAmount / stats.totalSalesAmount) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Avg Bill Amount</span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                        Rs. {stats.totalBillsCount > 0 ? Math.round(stats.totalSalesAmount / stats.totalBillsCount).toLocaleString('en-IN') : 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Unpaid Bills */}
            <Card className="rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-semibold text-slate-900 dark:text-white">Recent Unpaid Bills</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-zinc-900/50">
                      <TableHead className="text-slate-600 dark:text-slate-400">Customer</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Phone</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Bill Amount</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Paid</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Outstanding</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidSales.slice(0, 5).map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50">
                        <TableCell className="font-medium">
                          <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                            {sale.customerName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{sale.customerPhone}</TableCell>
                        <TableCell className="tabular-nums text-slate-900 dark:text-white">Rs. {parseFloat(sale.totalAmount).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                          Rs. {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                          Rs. {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{formatDisplayDate(sale.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {unpaidSales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 dark:text-slate-400 py-12">
                          No unpaid bills found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* All Sales Tab */}
          <TabsContent value="all-sales">
            <Card className="rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-zinc-900/50">
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          Customer <SortIcon field="customer" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Phone</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          Amount <SortIcon field="amount" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Paid</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Outstanding</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Status</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          Date <SortIcon field="date" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50">
                        <TableCell className="font-medium">
                          <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                            {sale.customerName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{sale.customerPhone}</TableCell>
                        <TableCell className="tabular-nums text-slate-900 dark:text-white">Rs. {parseFloat(sale.totalAmount).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                          Rs. {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-rose-600 dark:text-rose-400 tabular-nums">
                          Rs. {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{formatDisplayDate(sale.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredSales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 dark:text-slate-400 py-12">
                          No sales found matching your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {filteredSales.length > visibleLimit && (
                  <div className="flex justify-center py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                      data-testid="button-load-more-sales-reports"
                      className="border-slate-200 dark:border-slate-700"
                    >
                      Load More ({filteredSales.length - visibleLimit} remaining)
                    </Button>
                  </div>
                )}
              </div>
              <TableSummary tab="all-sales" />
            </Card>
          </TabsContent>

          {/* Unpaid Bills Tab */}
          <TabsContent value="unpaid-bills">
            <Card className="rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-zinc-900/50">
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          Customer <SortIcon field="customer" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Phone</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          Bill Amount <SortIcon field="amount" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Paid</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Outstanding</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Due Date</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          Bill Date <SortIcon field="date" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-unpaid-${sale.id}`} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50">
                        <TableCell className="font-medium">
                          <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                            {sale.customerName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{sale.customerPhone}</TableCell>
                        <TableCell className="tabular-nums text-slate-900 dark:text-white">Rs. {parseFloat(sale.totalAmount).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                          Rs. {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                          Rs. {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{sale.dueDate ? formatDisplayDate(sale.dueDate) : "Not set"}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{formatDisplayDate(sale.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {unpaidSales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-500 dark:text-slate-400 py-12">
                          No unpaid bills found matching your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <TableSummary tab="unpaid-bills" />
            </Card>
          </TabsContent>

          {/* Recovery Payments Tab */}
          <TabsContent value="recovery-payments">
            <Card className="rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-zinc-900/50">
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          Customer <SortIcon field="customer" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Phone</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          Payment <SortIcon field="amount" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Previous Balance</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">New Balance</TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Method</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          Date <SortIcon field="date" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-slate-600 dark:text-slate-400">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePayments.map((payment) => (
                      <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50">
                        <TableCell className="font-medium">
                          <Link href={`/customer/${encodeURIComponent(payment.customerPhone)}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                            {payment.sale?.customerName || "Unknown"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{payment.customerPhone}</TableCell>
                        <TableCell className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                          Rs. {parseFloat(payment.amount).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-slate-500 dark:text-slate-400 tabular-nums">
                          Rs. {parseFloat(payment.previousBalance).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="tabular-nums text-slate-900 dark:text-white">
                          Rs. {parseFloat(payment.newBalance).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-0 capitalize">
                            {payment.paymentMethod || "cash"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{formatDisplayDate(payment.createdAt)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-500 dark:text-slate-400">
                          {payment.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPayments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-500 dark:text-slate-400 py-12">
                          No recovery payments found matching your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {filteredPayments.length > visibleLimit && (
                  <div className="flex justify-center py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                      data-testid="button-load-more-payments-reports"
                      className="border-slate-200 dark:border-slate-700"
                    >
                      Load More ({filteredPayments.length - visibleLimit} remaining)
                    </Button>
                  </div>
                )}
              </div>
              <TableSummary tab="recovery-payments" />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
