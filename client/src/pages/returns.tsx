"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useDateFormat } from "@/hooks/use-date-format"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  Ban,
  Info,
} from "lucide-react"
import jsPDF from "jspdf"
import type { SaleWithItems, ReturnWithItems, ColorWithVariantAndProduct } from "@shared/schema"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ReturnStats {
  totalReturns: number
  totalRefunded: number
  itemReturns: number
  billReturns: number
}

interface QuickReturnForm {
  customerName: string
  customerPhone: string
  colorId: string
  quantity: number
  rate: number
  reason: string
  restoreStock: boolean
}

interface ExtendedSaleItem {
  id: string
  saleId: string
  colorId: string
  quantity: number
  rate: string
  subtotal: string
  quantityReturned?: number
  color: ColorWithVariantAndProduct
}

interface ExtendedSaleWithItems extends Omit<SaleWithItems, "saleItems"> {
  saleItems: ExtendedSaleItem[]
}

export default function Returns() {
  const { toast } = useToast()
  const { formatDate, formatDateShort } = useDateFormat()
  const [activeTab, setActiveTab] = useState("bill")
  const [searchPhone, setSearchPhone] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSale, setSelectedSale] = useState<ExtendedSaleWithItems | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<ReturnWithItems | null>(null)
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [showQuickReturnDialog, setShowQuickReturnDialog] = useState(false)
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)
  const [returnReason, setReturnReason] = useState("")
  const [returnType, setReturnType] = useState<"full" | "partial">("full")
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [restockItems, setRestockItems] = useState<Record<string, boolean>>({})

  // Quick return form state
  const [quickReturnForm, setQuickReturnForm] = useState<QuickReturnForm>({
    customerName: "",
    customerPhone: "",
    colorId: "",
    quantity: 1,
    rate: 0,
    reason: "",
    restoreStock: true,
  })

  const {
    data: returns = [],
    isLoading: returnsLoading,
    refetch: refetchReturns,
  } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
  })

  const { data: sales = [], isLoading: salesLoading } = useQuery<ExtendedSaleWithItems[]>({
    queryKey: ["/api/sales"],
  })

  const { data: colors = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  })

  const filteredReturns = useMemo(() => {
    return returns.filter(
      (ret) =>
        ret.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.customerPhone.includes(searchQuery) ||
        ret.id.toLowerCase().includes(searchQuery),
    )
  }, [returns, searchQuery])

  const stats: ReturnStats = useMemo(() => {
    return {
      totalReturns: returns.length,
      totalRefunded: returns.reduce((sum, ret) => sum + Number.parseFloat(ret.totalRefund || "0"), 0),
      itemReturns: returns.filter((ret) => ret.returnType === "item").length,
      billReturns: returns.filter((ret) => ret.returnType === "full_bill").length,
    }
  }, [returns])

  const searchResults = useMemo(() => {
    if (!searchPhone.trim()) return []
    return sales.filter((sale) => {
      const matchesSearch =
        sale.customerPhone.includes(searchPhone) || sale.customerName.toLowerCase().includes(searchPhone.toLowerCase())

      if (!matchesSearch) return false

      // Check if sale has any returnable items left
      const hasReturnableItems = sale.saleItems?.some((item) => {
        const returned = (item as any).quantityReturned || 0
        return item.quantity > returned
      })

      return hasReturnableItems
    })
  }, [sales, searchPhone])

  const createReturnMutation = useMutation({
    mutationFn: async (data: { returnData: any; items: any[] }) => {
      const response = await apiRequest("POST", "/api/returns", data)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] })
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] })
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })

      queryClient.refetchQueries({ queryKey: ["/api/colors"] })
      queryClient.refetchQueries({ queryKey: ["/api/sales"] })

      // Force immediate refetch for fresh data
      refetchReturns()

      setShowReturnDialog(false)
      setSelectedSale(null)
      setSelectedItems({})
      setRestockItems({})
      setReturnReason("")
      toast({
        title: "Return Processed",
        description: "Return has been successfully processed and stock has been updated",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process return",
        variant: "destructive",
      })
    },
  })

  const quickReturnMutation = useMutation({
    mutationFn: async (data: QuickReturnForm) => {
      const response = await apiRequest("POST", "/api/returns/quick", data)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/returns"] })
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] })

      queryClient.refetchQueries({ queryKey: ["/api/colors"] })

      // Force immediate refetch for fresh data
      refetchReturns()

      setShowQuickReturnDialog(false)
      setQuickReturnForm({
        customerName: "",
        customerPhone: "",
        colorId: "",
        quantity: 1,
        rate: 0,
        reason: "",
        restoreStock: true,
      })
      toast({
        title: "Quick Return Processed",
        description: "Item has been returned successfully and stock has been updated",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process quick return",
        variant: "destructive",
      })
    },
  })

  const isProcessing = createReturnMutation.isPending || quickReturnMutation.isPending

  const getReturnableQuantity = (item: ExtendedSaleItem): number => {
    const returned = (item as any).quantityReturned || 0
    return Math.max(0, item.quantity - returned)
  }

  const handleSelectSale = (sale: ExtendedSaleWithItems) => {
    setSelectedSale(sale)
    setShowReturnDialog(true)
    setReturnType("full")
    setSelectedItems({})
    setRestockItems({})
    setReturnReason("")

    // Pre-select all returnable items for full return (only items that haven't been fully returned)
    if (sale.saleItems) {
      const items: Record<string, number> = {}
      const restock: Record<string, boolean> = {}
      sale.saleItems.forEach((item) => {
        const returnableQty = getReturnableQuantity(item)
        if (returnableQty > 0) {
          items[item.id] = returnableQty
          restock[item.id] = true
        }
      })
      setSelectedItems(items)
      setRestockItems(restock)
    }
  }

  const handleItemQuantityChange = (itemId: string, maxQty: number, delta: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || 0
      const newQty = Math.max(0, Math.min(maxQty, current + delta))
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: newQty }
    })
    setReturnType("partial")
  }

  const handleToggleRestock = (itemId: string) => {
    setRestockItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }))
  }

  const handleSelectAllItems = () => {
    if (!selectedSale) return

    const items: Record<string, number> = {}
    const restock: Record<string, boolean> = {}

    selectedSale.saleItems?.forEach((item) => {
      const returnableQty = getReturnableQuantity(item)
      if (returnableQty > 0) {
        items[item.id] = returnableQty
        restock[item.id] = true
      }
    })

    setSelectedItems(items)
    setRestockItems(restock)
    setReturnType("full")
  }

  const handleDeselectAllItems = () => {
    setSelectedItems({})
    setRestockItems({})
    setReturnType("partial")
  }

  const handleSubmitReturn = () => {
    if (!selectedSale) return

    const itemsToReturn = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => {
        const saleItem = selectedSale.saleItems?.find((i) => i.id === itemId)
        if (!saleItem) return null

        const returnableQty = getReturnableQuantity(saleItem)
        if (quantity > returnableQty) {
          toast({
            title: "Invalid Quantity",
            description: `Cannot return more than ${returnableQty} items for ${saleItem.color?.colorName || "this item"}`,
            variant: "destructive",
          })
          return null
        }

        return {
          colorId: saleItem.colorId,
          saleItemId: saleItem.id,
          quantity,
          rate: Number.parseFloat(saleItem.rate),
          subtotal: quantity * Number.parseFloat(saleItem.rate),
          stockRestored: restockItems[itemId] ?? true,
        }
      })
      .filter(Boolean)

    if (itemsToReturn.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Select at least one item to return",
        variant: "destructive",
      })
      return
    }

    const totalRefund = itemsToReturn.reduce((sum, item) => sum + (item?.subtotal || 0), 0)

    const totalReturnableItems =
      selectedSale.saleItems?.reduce((sum, item) => sum + getReturnableQuantity(item), 0) || 0
    const totalReturningItems = itemsToReturn.reduce((sum, item) => sum + (item?.quantity || 0), 0)
    const isFullReturn = totalReturningItems >= totalReturnableItems

    createReturnMutation.mutate({
      returnData: {
        saleId: selectedSale.id,
        customerName: selectedSale.customerName,
        customerPhone: selectedSale.customerPhone,
        returnType: isFullReturn ? "full_bill" : "item",
        totalRefund,
        reason: returnReason || null,
        status: "completed",
      },
      items: itemsToReturn,
    })
  }

  const handleQuickReturnSubmit = () => {
    if (!quickReturnForm.customerName || !quickReturnForm.customerPhone || !quickReturnForm.colorId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (quickReturnForm.quantity <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Quantity must be greater than 0",
        variant: "destructive",
      })
      return
    }

    quickReturnMutation.mutate(quickReturnForm)
  }

  const handleColorSelect = (colorId: string) => {
    const selectedColor = colors.find((c) => c.id === colorId)
    if (selectedColor) {
      const rate = selectedColor.rateOverride
        ? Number.parseFloat(selectedColor.rateOverride)
        : Number.parseFloat(selectedColor.variant.rate)
      setQuickReturnForm((prev) => ({
        ...prev,
        colorId,
        rate,
      }))
    }
  }

  const formatItemDetails = (item: any) => {
    if (!item.color) return `Item #${item.colorId}`
    const color = item.color
    const variant = color.variant
    const product = variant?.product
    return `${product?.company || ""} ${product?.productName || ""} - ${variant?.packingSize || ""} - ${color.colorCode} ${color.colorName}`
  }

  const handleViewDetails = (returnRecord: ReturnWithItems) => {
    setSelectedReturn(returnRecord)
    setViewDetailsOpen(true)
  }

  const downloadReturnPDF = (returnRecord: ReturnWithItems) => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 15
    let yPos = margin

    // Header
    pdf.setFillColor(102, 126, 234)
    pdf.rect(0, 0, pageWidth, 30, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("RETURN DOCUMENT", pageWidth / 2, 12, { align: "center" })
    pdf.setFontSize(9)
    pdf.text("PaintPulse", pageWidth / 2, 20, { align: "center" })

    pdf.setTextColor(0, 0, 0)
    yPos = 40

    // Return Info
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text("Return Details:", margin, yPos)
    yPos += 6

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Return ID: ${returnRecord.id.slice(0, 8).toUpperCase()}`, margin, yPos)
    yPos += 5
    pdf.text(`Date: ${formatDateShort(returnRecord.createdAt)}`, margin, yPos)
    yPos += 5
    pdf.text(`Status: ${returnRecord.status.toUpperCase()}`, margin, yPos)
    yPos += 5
    pdf.text(`Type: ${returnRecord.returnType === "full_bill" ? "FULL BILL RETURN" : "ITEM RETURN"}`, margin, yPos)
    yPos += 10

    // Customer Info
    pdf.setFont("helvetica", "bold")
    pdf.text("Customer Information:", margin, yPos)
    yPos += 6

    pdf.setFont("helvetica", "normal")
    pdf.text(`Name: ${returnRecord.customerName}`, margin, yPos)
    yPos += 5
    pdf.text(`Phone: ${returnRecord.customerPhone}`, margin, yPos)
    yPos += 10

    // Returned Items Table
    pdf.setFont("helvetica", "bold")
    pdf.text("Returned Items:", margin, yPos)
    yPos += 8

    // Table header
    pdf.setFillColor(50, 50, 50)
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)

    pdf.text("Product", margin + 3, yPos + 5)
    pdf.text("Qty", margin + 70, yPos + 5)
    pdf.text("Rate", margin + 90, yPos + 5)
    pdf.text("Subtotal", pageWidth - margin - 20, yPos + 5, { align: "right" })
    yPos += 10

    pdf.setTextColor(0, 0, 0)

    // Table rows
    returnRecord.returnItems.forEach((item, index) => {
      if (yPos > 250) {
        pdf.addPage()
        yPos = margin
      }

      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255]
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2])
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F")

      pdf.setFontSize(8)
      const productName = `${item.color.variant.product.productName} - ${item.color.colorName} (${item.color.colorCode})`
      pdf.text(productName.substring(0, 40), margin + 3, yPos + 5)
      pdf.text(item.quantity.toString(), margin + 70, yPos + 5)
      pdf.text(`Rs.${Math.round(Number.parseFloat(item.rate))}`, margin + 90, yPos + 5)
      pdf.text(`Rs.${Math.round(Number.parseFloat(item.subtotal))}`, pageWidth - margin - 3, yPos + 5, {
        align: "right",
      })

      yPos += 8
    })

    yPos += 10

    // Summary
    pdf.setFont("helvetica", "bold")
    pdf.text("Return Summary:", margin, yPos)
    yPos += 8

    pdf.setFont("helvetica", "normal")
    pdf.text(`Total Items Returned: ${returnRecord.returnItems.length}`, margin, yPos)
    yPos += 5
    pdf.text(`Total Refund Amount: Rs.${Math.round(Number.parseFloat(returnRecord.totalRefund || "0"))}`, margin, yPos)

    pdf.save(
      `Return-${returnRecord.id.slice(0, 8).toUpperCase()}-${formatDateShort(returnRecord.createdAt).replace(/\//g, "-")}.pdf`,
    )
    toast({
      title: "Return Document Downloaded",
      description: "PDF has been downloaded successfully.",
    })
  }

  const totalReturnableQty = useMemo(() => {
    if (!selectedSale) return 0
    return selectedSale.saleItems?.reduce((sum, item) => sum + getReturnableQuantity(item), 0) || 0
  }, [selectedSale])

  const isFullyReturned = useMemo(() => {
    if (!selectedSale) return false
    return totalReturnableQty === 0
  }, [selectedSale, totalReturnableQty])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Returns Management</h1>
        <p className="text-muted-foreground">Process bill returns and quick item returns with stock restoration</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <RotateCcw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Returns</p>
                <p className="text-2xl font-bold">{stats.totalReturns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Refunded</p>
                <p className="text-2xl font-bold">Rs. {stats.totalRefunded.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Item Returns</p>
                <p className="text-2xl font-bold">{stats.itemReturns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bill Returns</p>
                <p className="text-2xl font-bold">{stats.billReturns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="bill">
            <FileText className="w-4 h-4 mr-2" />
            Bill Returns
          </TabsTrigger>
          <TabsTrigger value="history">
            <AlertTriangle className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bill" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Search Bill Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Search Bill to Return</CardTitle>
                <CardDescription>Search by customer phone number or name to find the bill</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter customer phone or name..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => setSearchPhone(searchPhone)} disabled={salesLoading}>
                    {salesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="ml-2">Search</span>
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Found Sales ({searchResults.length})</Label>
                    <ScrollArea className="h-[300px] rounded-md border">
                      <div className="p-2 space-y-2">
                        {searchResults.map((sale) => {
                          const returnableItems =
                            sale.saleItems?.filter((item) => getReturnableQuantity(item) > 0) || []
                          const totalReturnableQty = returnableItems.reduce(
                            (sum, item) => sum + getReturnableQuantity(item),
                            0,
                          )
                          const totalOriginalQty = sale.saleItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
                          const hasPartialReturns = totalReturnableQty < totalOriginalQty

                          return (
                            <Card
                              key={sale.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleSelectSale(sale)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium truncate">{sale.customerName}</span>
                                      <Badge variant="outline" className="shrink-0">
                                        {sale.customerPhone}
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {formatDate(new Date(sale.createdAt))} - {returnableItems.length} returnable items
                                    </div>
                                    {hasPartialReturns && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <Badge variant="secondary" className="text-xs">
                                          <Info className="w-3 h-3 mr-1" />
                                          {totalReturnableQty} of {totalOriginalQty} items remaining
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="font-medium">
                                      Rs. {Number.parseFloat(sale.totalAmount).toLocaleString()}
                                    </div>
                                    <Badge
                                      variant={sale.paymentStatus === "paid" ? "default" : "secondary"}
                                      className="mt-1"
                                    >
                                      {sale.paymentStatus}
                                    </Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {searchPhone && searchResults.length === 0 && !salesLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ban className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No returnable bills found</p>
                    <p className="text-sm">All items may have been already returned</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Return Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Item Return</CardTitle>
                <CardDescription>Return individual items without searching for a specific bill</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => setShowQuickReturnDialog(true)} className="w-full" size="lg">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Open Quick Return Form
                </Button>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p>• Return individual items without bill reference</p>
                  <p>• Automatic stock restoration</p>
                  <p>• For items not tied to specific invoices</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Return History</CardTitle>
                  <CardDescription>View all processed returns</CardDescription>
                </div>
                <div className="w-64">
                  <Input
                    placeholder="Search returns..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {returnsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : filteredReturns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No returns found</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Refund</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReturns.map((ret) => (
                        <TableRow key={ret.id}>
                          <TableCell className="font-medium">{formatDateShort(ret.createdAt)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{ret.customerName}</div>
                              <div className="text-sm text-muted-foreground">{ret.customerPhone}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ret.returnType === "full_bill" ? "default" : "secondary"}>
                              {ret.returnType === "full_bill" ? "Full Bill" : "Partial"}
                            </Badge>
                          </TableCell>
                          <TableCell>{ret.returnItems?.length || 0} items</TableCell>
                          <TableCell className="text-right font-medium">
                            Rs. {Number.parseFloat(ret.totalRefund || "0").toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={ret.status === "completed" ? "default" : "secondary"}>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {ret.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleViewDetails(ret)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => downloadReturnPDF(ret)}>
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Return Dialog - IMPROVED */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
            <DialogDescription>
              Select items to return from bill #{selectedSale?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              {/* Customer Info */}
              <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{selectedSale.customerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedSale.customerPhone}</span>
                </div>
                <Badge variant="outline" className="ml-auto">
                  {formatDate(new Date(selectedSale.createdAt))}
                </Badge>
              </div>

              {selectedSale.saleItems?.some((item) => ((item as any).quantityReturned || 0) > 0) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Info className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Some items from this bill have already been returned. Only remaining quantities are shown.
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAllItems}>
                  Select All Returnable
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAllItems}>
                  Deselect All
                </Button>
              </div>

              {/* Items List */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 pr-4">
                  {selectedSale.saleItems?.map((item) => {
                    const returnableQty = getReturnableQuantity(item)
                    const alreadyReturned = (item as any).quantityReturned || 0
                    const selectedQty = selectedItems[item.id] || 0
                    const isFullyReturned = returnableQty === 0

                    return (
                      <Card key={item.id} className={`${isFullyReturned ? "opacity-50 bg-muted" : ""}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{formatItemDetails(item)}</div>
                              <div className="text-sm text-muted-foreground mt-1 space-y-1">
                                <div className="flex items-center gap-4">
                                  <span>Original Qty: {item.quantity}</span>
                                  <span>Rate: Rs. {Number.parseFloat(item.rate).toLocaleString()}</span>
                                </div>
                                {alreadyReturned > 0 && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      {alreadyReturned} already returned
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                                    >
                                      {returnableQty} available to return
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Quantity Controls */}
                            {isFullyReturned ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Ban className="w-4 h-4" />
                                <span className="text-sm">Fully Returned</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center border rounded-md">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleItemQuantityChange(item.id, returnableQty, -1)}
                                    disabled={selectedQty <= 0}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="w-12 text-center font-medium">{selectedQty}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleItemQuantityChange(item.id, returnableQty, 1)}
                                    disabled={selectedQty >= returnableQty}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>

                                {selectedQty > 0 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            checked={restockItems[item.id] ?? true}
                                            onCheckedChange={() => handleToggleRestock(item.id)}
                                          />
                                          <Package className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Restore stock on return</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            )}
                          </div>

                          {selectedQty > 0 && (
                            <div className="mt-2 pt-2 border-t text-right">
                              <span className="text-sm text-muted-foreground">Refund: </span>
                              <span className="font-medium">
                                Rs. {(selectedQty * Number.parseFloat(item.rate)).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </ScrollArea>

              {/* Return Reason */}
              <div className="space-y-2">
                <Label>Return Reason (Optional)</Label>
                <Textarea
                  placeholder="Enter reason for return..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Summary */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">Total Items to Return:</span>
                    <span className="ml-2 font-medium">{Object.values(selectedItems).reduce((a, b) => a + b, 0)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Total Refund:</span>
                    <span className="ml-2 text-xl font-bold">
                      Rs.{" "}
                      {Object.entries(selectedItems)
                        .reduce((sum, [itemId, qty]) => {
                          const item = selectedSale.saleItems?.find((i) => i.id === itemId)
                          return sum + qty * Number.parseFloat(item?.rate || "0")
                        }, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReturn} disabled={isProcessing || Object.keys(selectedItems).length === 0}>
              {isProcessing ? (
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

      {/* Quick Return Dialog */}
      <Dialog open={showQuickReturnDialog} onOpenChange={setShowQuickReturnDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Item Return</DialogTitle>
            <DialogDescription>Return an item without referencing a specific bill</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  placeholder="Enter customer name"
                  value={quickReturnForm.customerName}
                  onChange={(e) => setQuickReturnForm((prev) => ({ ...prev, customerName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Phone *</Label>
                <Input
                  placeholder="Enter phone number"
                  value={quickReturnForm.customerPhone}
                  onChange={(e) => setQuickReturnForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Product *</Label>
              <Select value={quickReturnForm.colorId} onValueChange={handleColorSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color.id} value={color.id}>
                      {color.variant.product.company} - {color.variant.product.productName} -{" "}
                      {color.variant.packingSize} - {color.colorCode} {color.colorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={quickReturnForm.quantity}
                  onChange={(e) =>
                    setQuickReturnForm((prev) => ({ ...prev, quantity: Number.parseInt(e.target.value) || 1 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Rate</Label>
                <Input
                  type="number"
                  value={quickReturnForm.rate}
                  onChange={(e) =>
                    setQuickReturnForm((prev) => ({ ...prev, rate: Number.parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                placeholder="Enter reason for return"
                value={quickReturnForm.reason}
                onChange={(e) => setQuickReturnForm((prev) => ({ ...prev, reason: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={quickReturnForm.restoreStock}
                onCheckedChange={(checked) => setQuickReturnForm((prev) => ({ ...prev, restoreStock: !!checked }))}
              />
              <Label className="cursor-pointer">Restore stock</Label>
            </div>

            {quickReturnForm.colorId && quickReturnForm.quantity > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Refund:</span>
                  <span className="text-lg font-bold">
                    Rs. {(quickReturnForm.quantity * quickReturnForm.rate).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickReturnDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickReturnSubmit} disabled={isProcessing}>
              {isProcessing ? (
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

      {/* View Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Return Details</DialogTitle>
            <DialogDescription>Return #{selectedReturn?.id.slice(0, 8).toUpperCase()}</DialogDescription>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedReturn.customerName}</p>
                  <p className="text-sm">{selectedReturn.customerPhone}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Return Info</p>
                  <p className="font-medium">{formatDateShort(selectedReturn.createdAt)}</p>
                  <Badge variant={selectedReturn.returnType === "full_bill" ? "default" : "secondary"}>
                    {selectedReturn.returnType === "full_bill" ? "Full Bill" : "Partial Return"}
                  </Badge>
                </div>
              </div>

              {selectedReturn.reason && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Reason</p>
                  <p>{selectedReturn.reason}</p>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-2">Returned Items</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturn.returnItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">
                              {item.color?.variant?.product?.productName || "Product"} - {item.color?.colorName}
                            </div>
                            <div className="text-sm text-muted-foreground">{item.color?.colorCode}</div>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            Rs. {Number.parseFloat(item.rate).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            Rs. {Number.parseFloat(item.subtotal).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Refund</span>
                  <span className="text-2xl font-bold">
                    Rs. {Number.parseFloat(selectedReturn.totalRefund || "0").toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>
              Close
            </Button>
            {selectedReturn && (
              <Button onClick={() => downloadReturnPDF(selectedReturn)}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
