"use client"

import { useQuery, useMutation } from "@tanstack/react-query"
import { useLocation, useParams } from "wouter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft,
  Phone,
  Calendar,
  Receipt,
  Wallet,
  CheckCircle,
  AlertCircle,
  Download,
  History,
  ShoppingBag,
  Plus,
  Landmark,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Package,
  RotateCcw,
} from "lucide-react"
import { useState, useMemo, Fragment } from "react"
import { useToast } from "@/hooks/use-toast"
import { useDateFormat } from "@/hooks/use-date-format"
import { useReceiptSettings } from "@/hooks/use-receipt-settings"
import { apiRequest, queryClient } from "@/lib/queryClient"
import type { Sale, PaymentHistory, SaleWithItems, ReturnWithItems } from "@shared/schema"
import jsPDF from "jspdf"

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale
}

type TransactionType = "bill" | "payment" | "cash_loan" | "return"

interface SaleItemDisplay {
  productName: string
  variantName: string
  colorName: string
  colorCode: string
  quantity: number
  rate: number
  subtotal: number
  quantityReturned?: number
}

interface Transaction {
  id: string
  date: Date
  type: TransactionType
  description: string
  reference: string
  debit: number
  credit: number
  balance: number
  paid: number
  totalAmount: number
  outstanding: number
  notes?: string
  dueDate?: Date | null
  status?: string
  saleId?: string
  items?: SaleItemDisplay[]
  returnItems?: number
  refundAmount?: number
}

// Utility function to safely parse numbers
const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0
  const num = typeof value === "string" ? Number.parseFloat(value) : value
  return isNaN(num) ? 0 : num
}

// Utility function to round numbers for display
const roundNumber = (num: number): number => {
  return Math.round(num * 100) / 100
}

export default function CustomerStatement() {
  const { formatDateShort } = useDateFormat()
  const { receiptSettings } = useReceiptSettings()
  const params = useParams<{ phone: string }>()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const customerPhone = params.phone || ""

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentNotes, setPaymentNotes] = useState("")

  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryWithSale | null>(null)
  const [editPaymentAmount, setEditPaymentAmount] = useState("")
  const [editPaymentMethod, setEditPaymentMethod] = useState("")
  const [editPaymentNotes, setEditPaymentNotes] = useState("")

  const [cashLoanDialogOpen, setCashLoanDialogOpen] = useState(false)
  const [cashLoanAmount, setCashLoanAmount] = useState("")
  const [cashLoanNotes, setCashLoanNotes] = useState("")
  const [cashLoanDueDate, setCashLoanDueDate] = useState("")

  const [deletePaymentDialogOpen, setDeletePaymentDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentHistoryWithSale | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRowExpand = (rowId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rowId)) {
        newSet.delete(rowId)
      } else {
        newSet.add(rowId)
      }
      return newSet
    })
  }

  const { data: allSalesWithItems = [], isLoading: salesLoading } = useQuery<SaleWithItems[]>({
    queryKey: ["/api/sales/customer", customerPhone, "with-items"],
    queryFn: async () => {
      const res = await fetch(`/api/sales/customer/${encodeURIComponent(customerPhone)}/with-items`)
      if (!res.ok) throw new Error("Failed to fetch customer sales")
      return res.json()
    },
    enabled: !!customerPhone,
    refetchOnWindowFocus: true,
  })

  const allSales = allSalesWithItems as Sale[]

  const { data: paymentHistory = [], isLoading: historyLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history/customer", customerPhone],
    queryFn: async () => {
      const res = await fetch(`/api/payment-history/customer/${encodeURIComponent(customerPhone)}`)
      if (!res.ok) throw new Error("Failed to fetch payment history")
      return res.json()
    },
    enabled: !!customerPhone,
    refetchOnWindowFocus: true,
  })

  const { data: customerReturns = [], isLoading: returnsLoading } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns/customer", customerPhone],
    queryFn: async () => {
      const res = await fetch(`/api/returns/customer/${encodeURIComponent(customerPhone)}`)
      if (!res.ok) throw new Error("Failed to fetch customer returns")
      return res.json()
    },
    enabled: !!customerPhone,
    refetchOnWindowFocus: true,
  })

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number; paymentMethod: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/sales/${data.saleId}/payment`, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customer", customerPhone] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history/customer", customerPhone] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      setPaymentDialogOpen(false)
      setPaymentAmount("")
      setPaymentNotes("")
      toast({
        title: "Payment Recorded",
        description: "Payment has been successfully recorded.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      })
    },
  })

  const updatePaymentMutation = useMutation({
    mutationFn: async (data: { id: string; amount: number; paymentMethod: string; notes: string }) => {
      const response = await apiRequest("PATCH", `/api/payment-history/${data.id}`, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history/customer", customerPhone] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customer", customerPhone] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history"] })
      setEditPaymentDialogOpen(false)
      setEditingPayment(null)
      toast({
        title: "Payment Updated",
        description: "Payment has been successfully updated.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment",
        variant: "destructive",
      })
    },
  })

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/payment-history/${id}`)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history/customer", customerPhone] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customer", customerPhone] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history"] })
      setDeletePaymentDialogOpen(false)
      setPaymentToDelete(null)
      toast({
        title: "Payment Deleted",
        description: "Payment record has been deleted.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment",
        variant: "destructive",
      })
    },
  })

  const addCashLoanMutation = useMutation({
    mutationFn: async (data: { amount: string; notes: string; dueDate: string | null }) => {
      const customerName = allSales[0]?.customerName || "Customer"
      const response = await apiRequest("POST", "/api/sales/manual-balance", {
        customerName,
        customerPhone,
        totalAmount: data.amount,
        dueDate: data.dueDate,
        notes: data.notes || `Manual balance of Rs. ${data.amount}`,
        isManualBalance: true,
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customer", customerPhone] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment-history/customer", customerPhone] })
      setCashLoanDialogOpen(false)
      setCashLoanAmount("")
      setCashLoanNotes("")
      setCashLoanDueDate("")
      toast({
        title: "Manual Balance Added",
        description: "Manual balance has been added to customer account.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add manual balance",
        variant: "destructive",
      })
    },
  })

  const paidSales = useMemo(() => allSales.filter((s) => s.paymentStatus === "paid"), [allSales])
  const unpaidSales = useMemo(() => allSales.filter((s) => s.paymentStatus !== "paid"), [allSales])

  const customerName = allSales[0]?.customerName || "Customer"

  const stats = useMemo(() => {
    const totalPurchases = allSales.reduce((sum, s) => sum + safeParseFloat(s.totalAmount), 0)
    const totalPaid = allSales.reduce((sum, s) => sum + safeParseFloat(s.amountPaid), 0)
    const totalReturns = customerReturns.reduce((sum, r) => sum + safeParseFloat(r.totalRefund), 0)
    const totalOutstanding = Math.max(0, totalPurchases - totalPaid - totalReturns)
    const totalPaymentsReceived = paymentHistory.reduce((sum, p) => sum + safeParseFloat(p.amount), 0)

    return {
      totalBills: allSales.length,
      paidBills: paidSales.length,
      unpaidBills: unpaidSales.length,
      totalPurchases: roundNumber(totalPurchases),
      totalPaid: roundNumber(totalPaid),
      totalOutstanding: roundNumber(totalOutstanding),
      totalPaymentsReceived: roundNumber(totalPaymentsReceived),
      totalReturns: roundNumber(totalReturns),
      returnCount: customerReturns.length,
    }
  }, [allSales, paidSales, unpaidSales, paymentHistory, customerReturns])

  const transactions = useMemo((): Transaction[] => {
    const txns: Transaction[] = []

    // First, collect all bills in chronological order
    const billTransactions: Transaction[] = allSalesWithItems.map((sale) => {
      const saleItems: SaleItemDisplay[] =
        sale.saleItems?.map((item) => ({
          productName: item.color?.variant?.product?.productName || "Product",
          variantName: item.color?.variant?.packingSize || "Variant",
          colorName: item.color?.colorName || "Color",
          colorCode: item.color?.colorCode || "",
          quantity: item.quantity,
          rate: safeParseFloat(item.rate),
          subtotal: safeParseFloat(item.subtotal),
          quantityReturned: (item as any).quantityReturned || 0,
        })) || []

      const totalAmt = safeParseFloat(sale.totalAmount)
      const paidAmt = safeParseFloat(sale.amountPaid)
      const outstandingAmt = Math.max(0, totalAmt - paidAmt)

      return {
        id: `bill-${sale.id}`,
        date: new Date(sale.createdAt),
        type: sale.isManualBalance ? "cash_loan" : "bill",
        description: sale.isManualBalance ? "Manual Balance" : `Bill #${sale.id.slice(0, 8)}`,
        reference: sale.id.slice(0, 8).toUpperCase(),
        debit: totalAmt,
        credit: 0,
        balance: 0,
        paid: paidAmt,
        totalAmount: totalAmt,
        outstanding: outstandingAmt,
        notes: sale.notes || undefined,
        dueDate: sale.dueDate ? new Date(sale.dueDate) : null,
        status: sale.paymentStatus,
        saleId: sale.id,
        items: saleItems.length > 0 ? saleItems : undefined,
      }
    })

    // Then collect all payments
    const paymentTransactions: Transaction[] = paymentHistory.map((payment) => ({
      id: `payment-${payment.id}`,
      date: new Date(payment.createdAt),
      type: "payment",
      description: `Payment Received (${payment.paymentMethod.toUpperCase()})`,
      reference: payment.id.slice(0, 8).toUpperCase(),
      debit: 0,
      credit: safeParseFloat(payment.amount),
      balance: 0,
      paid: 0,
      totalAmount: 0,
      outstanding: 0,
      notes: payment.notes || undefined,
      saleId: payment.saleId,
    }))

    const returnTransactions: Transaction[] = customerReturns.map((ret) => ({
      id: `return-${ret.id}`,
      date: new Date(ret.createdAt),
      type: "return" as TransactionType,
      description: `Return ${ret.returnType === "full_bill" ? "(Full Bill)" : "(Partial)"}`,
      reference: ret.id.slice(0, 8).toUpperCase(),
      debit: 0,
      credit: safeParseFloat(ret.totalRefund),
      balance: 0,
      paid: 0,
      totalAmount: 0,
      outstanding: 0,
      notes: ret.reason || undefined,
      returnItems: ret.returnItems?.length || 0,
      refundAmount: safeParseFloat(ret.totalRefund),
    }))

    // Combine and sort by date (oldest first)
    txns.push(...billTransactions, ...paymentTransactions, ...returnTransactions)
    txns.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Calculate running balance correctly
    let runningBalance = 0
    const balanceByTransaction: { [key: string]: number } = {}

    txns.forEach((txn) => {
      if (txn.type === "payment" || txn.type === "return") {
        // Payments and returns reduce the outstanding balance
        runningBalance -= txn.credit
      } else {
        // Bills and cash loans add to outstanding
        runningBalance += txn.debit
        // Subtract any payments already made on this transaction
        runningBalance -= txn.paid
      }
      balanceByTransaction[txn.id] = runningBalance
    })

    // Update transactions with calculated balances
    txns.forEach((txn) => {
      txn.balance = balanceByTransaction[txn.id] || 0
    })

    // Return in reverse order (newest first for display)
    return txns.reverse()
  }, [allSalesWithItems, paymentHistory, customerReturns])

  const scheduledPayments = useMemo(() => {
    const now = new Date()
    return unpaidSales
      .filter((s) => s.dueDate)
      .map((s) => ({
        ...s,
        dueDate: new Date(s.dueDate!),
        outstanding: safeParseFloat(s.totalAmount) - safeParseFloat(s.amountPaid),
      }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
  }, [unpaidSales])

  const getDueDateStatus = (dueDate: Date | null) => {
    if (!dueDate) return "none"
    const now = new Date()
    const due = new Date(dueDate)
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return "overdue"
    if (diffDays <= 7) return "due_soon"
    return "normal"
  }

  const handleRecordPayment = () => {
    if (!selectedSaleId || !paymentAmount) return

    const amount = Number.parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      })
      return
    }

    recordPaymentMutation.mutate({
      saleId: selectedSaleId,
      amount,
      paymentMethod,
      notes: paymentNotes,
    })
  }

  const handleUpdatePayment = () => {
    if (!editingPayment || !editPaymentAmount) return

    const amount = Number.parseFloat(editPaymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      })
      return
    }

    updatePaymentMutation.mutate({
      id: editingPayment.id,
      amount,
      paymentMethod: editPaymentMethod,
      notes: editPaymentNotes,
    })
  }

  const handleAddCashLoan = () => {
    if (!cashLoanAmount) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount for the manual balance",
        variant: "destructive",
      })
      return
    }

    const amount = Number.parseFloat(cashLoanAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    addCashLoanMutation.mutate({
      amount: cashLoanAmount,
      notes: cashLoanNotes,
      dueDate: cashLoanDueDate || null,
    })
  }

  const openEditPayment = (payment: PaymentHistoryWithSale) => {
    setEditingPayment(payment)
    setEditPaymentAmount(payment.amount.toString())
    setEditPaymentMethod(payment.paymentMethod)
    setEditPaymentNotes(payment.notes || "")
    setEditPaymentDialogOpen(true)
  }

  const selectedSale = selectedSaleId ? allSales.find((s) => s.id === selectedSaleId) : null
  const selectedSaleOutstanding = selectedSale
    ? safeParseFloat(selectedSale.totalAmount) - safeParseFloat(selectedSale.amountPaid)
    : 0

  const generateBankStatement = async () => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    let yPos = margin

    const drawHeader = () => {
      pdf.setFillColor(102, 126, 234)
      pdf.rect(0, 0, pageWidth, 35, "F")

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont("helvetica", "bold")
      pdf.text("ACCOUNT STATEMENT", pageWidth / 2, 15, { align: "center" })

      pdf.setFontSize(10)
      pdf.setFont("helvetica", "normal")
      pdf.text(receiptSettings.businessName, pageWidth / 2, 23, { align: "center" })
      pdf.text(receiptSettings.address, pageWidth / 2, 29, { align: "center" })

      pdf.setTextColor(0, 0, 0)
      yPos = 45
    }

    const addSectionHeader = (text: string) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage()
        yPos = margin
      }
      pdf.setFillColor(240, 240, 240)
      pdf.rect(margin, yPos - 4, pageWidth - 2 * margin, 8, "F")
      pdf.setFontSize(11)
      pdf.setFont("helvetica", "bold")
      pdf.text(text, margin + 3, yPos + 2)
      yPos += 10
    }

    drawHeader()

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text("Account Holder:", margin, yPos)
    pdf.setFont("helvetica", "normal")
    pdf.text(customerName, margin + 35, yPos)
    yPos += 6

    pdf.setFont("helvetica", "bold")
    pdf.text("Phone:", margin, yPos)
    pdf.setFont("helvetica", "normal")
    pdf.text(customerPhone, margin + 35, yPos)
    yPos += 6

    pdf.setFont("helvetica", "bold")
    pdf.text("Statement Date:", margin, yPos)
    pdf.setFont("helvetica", "normal")
    pdf.text(formatDateShort(new Date()), margin + 35, yPos)
    yPos += 10

    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 8

    addSectionHeader("ACCOUNT SUMMARY")

    const summaryData = [
      ["Total Bills:", stats.totalBills.toString(), "Total Purchases:", `Rs. ${stats.totalPurchases.toLocaleString()}`],
      ["Paid Bills:", stats.paidBills.toString(), "Total Paid:", `Rs. ${stats.totalPaid.toLocaleString()}`],
      ["Unpaid Bills:", stats.unpaidBills.toString(), "Total Returns:", `Rs. ${stats.totalReturns.toLocaleString()}`],
      ["Return Count:", stats.returnCount.toString(), "Outstanding:", `Rs. ${stats.totalOutstanding.toLocaleString()}`],
    ]

    pdf.setFontSize(9)
    summaryData.forEach((row) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(row[0], margin + 5, yPos)
      pdf.setFont("helvetica", "normal")
      pdf.text(row[1], margin + 35, yPos)
      pdf.setFont("helvetica", "bold")
      pdf.text(row[2], margin + 70, yPos)
      pdf.setFont("helvetica", "normal")
      pdf.text(row[3], margin + 105, yPos)
      yPos += 6
    })

    yPos += 8

    addSectionHeader("TRANSACTION HISTORY")

    // Table header
    pdf.setFillColor(50, 50, 50)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)

    pdf.text("Date", margin + 2, yPos + 5)
    pdf.text("Description", margin + 25, yPos + 5)
    pdf.text("Debit", margin + 85, yPos + 5)
    pdf.text("Credit", margin + 110, yPos + 5)
    pdf.text("Balance", pageWidth - margin - 20, yPos + 5, { align: "right" })
    yPos += 9

    pdf.setTextColor(0, 0, 0)

    // Sort transactions by date for PDF (oldest first)
    const sortedTransactions = [...transactions].reverse()

    sortedTransactions.forEach((txn, index) => {
      if (yPos > pageHeight - 20) {
        pdf.addPage()
        yPos = margin

        // Redraw table header on new page
        pdf.setFillColor(50, 50, 50)
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, "F")
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(8)
        pdf.text("Date", margin + 2, yPos + 5)
        pdf.text("Description", margin + 25, yPos + 5)
        pdf.text("Debit", margin + 85, yPos + 5)
        pdf.text("Credit", margin + 110, yPos + 5)
        pdf.text("Balance", pageWidth - margin - 20, yPos + 5, { align: "right" })
        yPos += 9
        pdf.setTextColor(0, 0, 0)
      }

      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255]
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2])
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 6, "F")

      pdf.setFontSize(7)
      pdf.text(formatDateShort(txn.date), margin + 2, yPos + 4)
      pdf.text(txn.description.substring(0, 35), margin + 25, yPos + 4)
      pdf.text(txn.debit > 0 ? `Rs. ${txn.debit.toLocaleString()}` : "-", margin + 85, yPos + 4)
      pdf.text(txn.credit > 0 ? `Rs. ${txn.credit.toLocaleString()}` : "-", margin + 110, yPos + 4)
      pdf.text(`Rs. ${Math.abs(txn.balance).toLocaleString()}`, pageWidth - margin - 3, yPos + 4, { align: "right" })

      yPos += 6
    })

    yPos += 10

    // Final balance
    pdf.setFillColor(102, 126, 234)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 12, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.text("OUTSTANDING BALANCE:", margin + 5, yPos + 8)
    pdf.text(`Rs. ${stats.totalOutstanding.toLocaleString()}`, pageWidth - margin - 5, yPos + 8, { align: "right" })

    pdf.save(`Statement-${customerName.replace(/\s+/g, "_")}-${formatDateShort(new Date()).replace(/\//g, "-")}.pdf`)

    toast({
      title: "Statement Downloaded",
      description: "Account statement PDF has been downloaded.",
    })
  }

  if (salesLoading || historyLoading || returnsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading customer data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/unpaid-bills")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customerName}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{customerPhone}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCashLoanDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Manual Balance
          </Button>
          <Button onClick={generateBankStatement}>
            <Download className="h-4 w-4 mr-2" />
            Download Statement
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Receipt className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Bills</p>
                <p className="text-2xl font-bold">{stats.totalBills}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.paidBills} paid, {stats.unpaidBills} unpaid
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Purchases</p>
                <p className="text-2xl font-bold">Rs. {stats.totalPurchases.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold">Rs. {stats.totalPaid.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <RotateCcw className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Returns</p>
                <p className="text-2xl font-bold">Rs. {stats.totalReturns.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stats.returnCount} returns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-red-600">Rs. {stats.totalOutstanding.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="transactions">
            <History className="h-4 w-4 mr-2" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="unpaid">
            <AlertCircle className="h-4 w-4 mr-2" />
            Unpaid Bills
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            <CalendarClock className="h-4 w-4 mr-2" />
            Scheduled
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((txn) => (
                        <Fragment key={txn.id}>
                          <TableRow
                            className={`${txn.items ? "cursor-pointer hover:bg-muted/50" : ""} ${
                              txn.type === "return" ? "bg-orange-50 dark:bg-orange-950/20" : ""
                            }`}
                            onClick={() => txn.items && toggleRowExpand(txn.id)}
                          >
                            <TableCell>
                              {txn.items && (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  {expandedRows.has(txn.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{formatDateShort(txn.date)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {txn.type === "bill" && <Receipt className="h-4 w-4 text-blue-500" />}
                                {txn.type === "payment" && <Wallet className="h-4 w-4 text-green-500" />}
                                {txn.type === "cash_loan" && <Landmark className="h-4 w-4 text-purple-500" />}
                                {txn.type === "return" && <RotateCcw className="h-4 w-4 text-orange-500" />}
                                <span>{txn.description}</span>
                                {txn.notes && (
                                  <Badge variant="outline" className="text-xs">
                                    {txn.notes.substring(0, 20)}...
                                  </Badge>
                                )}
                              </div>
                              {txn.type === "return" && txn.returnItems && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {txn.returnItems} items returned
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {txn.debit > 0 ? (
                                <span className="text-red-600 font-medium">Rs. {txn.debit.toLocaleString()}</span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {txn.credit > 0 ? (
                                <span className="text-green-600 font-medium">Rs. {txn.credit.toLocaleString()}</span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              Rs. {Math.abs(txn.balance).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {txn.type === "bill" && txn.status && (
                                <Badge
                                  variant={
                                    txn.status === "paid"
                                      ? "default"
                                      : txn.status === "partial"
                                        ? "secondary"
                                        : "destructive"
                                  }
                                >
                                  {txn.status}
                                </Badge>
                              )}
                              {txn.type === "payment" && (
                                <Badge className="bg-green-100 text-green-800">Received</Badge>
                              )}
                              {txn.type === "return" && (
                                <Badge className="bg-orange-100 text-orange-800">Returned</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                          {/* Expanded Row for Items */}
                          {expandedRows.has(txn.id) && txn.items && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/30 p-0">
                                <div className="p-4">
                                  <p className="text-sm font-medium mb-2">Bill Items:</p>
                                  <div className="rounded-md border bg-background">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Product</TableHead>
                                          <TableHead className="text-center">Qty</TableHead>
                                          <TableHead className="text-center">Returned</TableHead>
                                          <TableHead className="text-right">Rate</TableHead>
                                          <TableHead className="text-right">Subtotal</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {txn.items.map((item, idx) => (
                                          <TableRow key={idx}>
                                            <TableCell>
                                              <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                  <div className="font-medium">{item.productName}</div>
                                                  <div className="text-xs text-muted-foreground">
                                                    {item.variantName} - {item.colorCode} {item.colorName}
                                                  </div>
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                            <TableCell className="text-center">
                                              {item.quantityReturned && item.quantityReturned > 0 ? (
                                                <Badge variant="secondary" className="text-xs">
                                                  <RotateCcw className="h-3 w-3 mr-1" />
                                                  {item.quantityReturned}
                                                </Badge>
                                              ) : (
                                                <span className="text-muted-foreground">-</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              Rs. {item.rate.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                              Rs. {item.subtotal.toLocaleString()}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unpaid" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Unpaid Bills</CardTitle>
            </CardHeader>
            <CardContent>
              {unpaidSales.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">All bills are paid!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unpaidSales.map((sale) => {
                    const outstanding = safeParseFloat(sale.totalAmount) - safeParseFloat(sale.amountPaid)
                    const dueDateStatus = getDueDateStatus(sale.dueDate ? new Date(sale.dueDate) : null)

                    return (
                      <Card key={sale.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Bill #{sale.id.slice(0, 8).toUpperCase()}</span>
                                <Badge variant={sale.paymentStatus === "partial" ? "secondary" : "destructive"}>
                                  {sale.paymentStatus}
                                </Badge>
                                {dueDateStatus === "overdue" && <Badge variant="destructive">Overdue</Badge>}
                                {dueDateStatus === "due_soon" && (
                                  <Badge className="bg-yellow-100 text-yellow-800">Due Soon</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {formatDateShort(new Date(sale.createdAt))}
                                {sale.dueDate && ` • Due: ${formatDateShort(new Date(sale.dueDate))}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-red-600">Rs. {outstanding.toLocaleString()}</div>
                              <div className="text-sm text-muted-foreground">
                                of Rs. {safeParseFloat(sale.totalAmount).toLocaleString()}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedSaleId(sale.id)
                                setPaymentDialogOpen(true)
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Pay
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {scheduledPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarClock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No scheduled payments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledPayments.map((payment) => {
                    const dueDateStatus = getDueDateStatus(payment.dueDate)

                    return (
                      <Card key={payment.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Due: {formatDateShort(payment.dueDate)}</span>
                                {dueDateStatus === "overdue" && <Badge variant="destructive">Overdue</Badge>}
                                {dueDateStatus === "due_soon" && (
                                  <Badge className="bg-yellow-100 text-yellow-800">Due Soon</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Bill #{payment.id.slice(0, 8).toUpperCase()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">Rs. {payment.outstanding.toLocaleString()}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for Bill #{selectedSale?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding Amount:</span>
                <span className="font-bold text-red-600">Rs. {selectedSaleOutstanding.toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Amount</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add payment notes..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={recordPaymentMutation.isPending}>
              {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={editPaymentDialogOpen} onOpenChange={setEditPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Amount</Label>
              <Input type="number" value={editPaymentAmount} onChange={(e) => setEditPaymentAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={editPaymentNotes} onChange={(e) => setEditPaymentNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePayment} disabled={updatePaymentMutation.isPending}>
              {updatePaymentMutation.isPending ? "Updating..." : "Update Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Dialog */}
      <Dialog open={deletePaymentDialogOpen} onOpenChange={setDeletePaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this payment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => paymentToDelete && deletePaymentMutation.mutate(paymentToDelete.id)}
              disabled={deletePaymentMutation.isPending}
            >
              {deletePaymentMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Cash Loan / Manual Balance Dialog */}
      <Dialog open={cashLoanDialogOpen} onOpenChange={setCashLoanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Balance</DialogTitle>
            <DialogDescription>
              Add a manual balance entry for this customer (cash loan, advance, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={cashLoanAmount}
                onChange={(e) => setCashLoanAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date (Optional)</Label>
              <Input type="date" value={cashLoanDueDate} onChange={(e) => setCashLoanDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Add notes (e.g., Cash loan, Advance payment)..."
                value={cashLoanNotes}
                onChange={(e) => setCashLoanNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashLoanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCashLoan} disabled={addCashLoanMutation.isPending}>
              {addCashLoanMutation.isPending ? "Adding..." : "Add Balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
