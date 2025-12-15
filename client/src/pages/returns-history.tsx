import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useDebounce } from "@/hooks/use-debounce"
import { useDateFormat } from "@/hooks/use-date-format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, RotateCcw, Download, Eye, Phone, DollarSign, Package, AlertTriangle, Edit, Save, AlertCircle, Clock, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import jsPDF from "jspdf"
import type { ReturnWithItems } from "@shared/schema"

const VISIBLE_LIMIT_INITIAL = 50
const VISIBLE_LIMIT_INCREMENT = 30

interface ReturnStats {
  totalReturns: number
  totalRefunded: number
  itemReturns: number
  billReturns: number
}

export default function ReturnsHistory() {
  const { formatDateShort, formatDate } = useDateFormat()
  
  // Get today's date in YYYY-MM-DD format for default filter
  const getTodayString = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }
  
  const [searchQuery, setSearchQuery] = useState("")
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL)
  const [selectedReturn, setSelectedReturn] = useState<ReturnWithItems | null>(null)
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)
  const [startDate, setStartDate] = useState(getTodayString())
  const [endDate, setEndDate] = useState(getTodayString())
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null)
  const [editReturnData, setEditReturnData] = useState<{ reason?: string; refundMethod?: string; totalRefund?: string; status?: string }>({})
  const [canEditReturn, setCanEditReturn] = useState<{ canEdit: boolean; hoursLeft?: number } | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [isSavingReturn, setIsSavingReturn] = useState(false)

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const {
    data: returns = [],
    isLoading,
    refetch,
  } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
  })

  const stats: ReturnStats = useMemo(() => {
    return {
      totalReturns: returns.length,
      totalRefunded: returns.reduce((sum, r) => sum + Number.parseFloat(r.totalRefund || "0"), 0),
      itemReturns: returns.filter((r) => r.returnType === "item").length,
      billReturns: returns.filter((r) => r.returnType === "full_bill").length,
    }
  }, [returns])

  const filteredReturns = useMemo(() => {
    let filtered = returns

    // Date filtering
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      filtered = filtered.filter((r) => new Date(r.createdAt) >= start)
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter((r) => new Date(r.createdAt) <= end)
    }

    // Search filtering
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.customerName.toLowerCase().includes(query) ||
          r.customerPhone.includes(query) ||
          r.id.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [returns, debouncedSearchQuery, startDate, endDate])

  const visibleReturns = useMemo(() => {
    return filteredReturns.slice(0, visibleLimit)
  }, [filteredReturns, visibleLimit])

  const handleViewDetails = (ret: ReturnWithItems) => {
    setSelectedReturn(ret)
    setViewDetailsOpen(true)
  }

  const downloadReturnPDF = (ret: ReturnWithItems) => {
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.text("Return Receipt", 105, 20, { align: "center" })

    doc.setFontSize(12)
    doc.text(`Return ID: #${ret.id.slice(0, 8).toUpperCase()}`, 20, 35)
    doc.text(`Date: ${formatDate(new Date(ret.createdAt))}`, 20, 42)
    doc.text(`Customer: ${ret.customerName}`, 20, 49)
    doc.text(`Phone: ${ret.customerPhone}`, 20, 56)
    doc.text(`Type: ${ret.returnType === "full_bill" ? "Full Bill Return" : "Item Return"}`, 20, 63)

    let y = 80
    doc.setFontSize(14)
    doc.text("Returned Items", 20, y)
    y += 10

    doc.setFontSize(10)
    ret.returnItems.forEach((item, index) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      const colorInfo = item.color
        ? `${item.color.colorCode} - ${item.color.colorName}`
        : `Item ${index + 1}`
      doc.text(`${index + 1}. ${colorInfo}`, 25, y)
      y += 6
      doc.text(`   Qty: ${item.quantity} | Refund: Rs.${Math.round(Number.parseFloat(item.refundAmount || "0")).toLocaleString()}`, 25, y)
      y += 8
    })

    y += 10
    doc.setFontSize(14)
    doc.text(`Total Refund: Rs.${Math.round(Number.parseFloat(ret.totalRefund || "0")).toLocaleString()}`, 20, y)

    if (ret.reason) {
      y += 15
      doc.setFontSize(10)
      doc.text(`Reason: ${ret.reason}`, 20, y)
    }

    doc.save(`return-${ret.id.slice(0, 8)}.pdf`)
  }

  const handleEditReturn = async (returnId: string, ret: ReturnWithItems) => {
    try {
      setEditingError(null)
      setEditingReturnId(returnId)
      
      // Check if return can be edited
      const response = await fetch(`/api/returns/${returnId}/can-edit`)
      const result = await response.json()
      setCanEditReturn(result)
      
      if (result.canEdit) {
        setEditReturnData({
          reason: ret.reason || "",
          refundMethod: ret.refundMethod || "cash",
          totalRefund: ret.totalRefund,
          status: ret.status,
        })
      } else {
        setEditingError(result.reason || "Cannot edit this return")
      }
    } catch (error) {
      setEditingError("Failed to check return edit status")
      console.error("Error checking return edit status:", error)
    }
  }

  const handleSaveReturn = async (returnId: string) => {
    try {
      setIsSavingReturn(true)
      setEditingError(null)
      
      const response = await fetch(`/api/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editReturnData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update return")
      }

      // Invalidate returns query to refresh data
      await refetch()
      
      setEditingReturnId(null)
      setEditReturnData({})
      setCanEditReturn(null)
    } catch (error) {
      setEditingError(error instanceof Error ? error.message : "Failed to update return")
      console.error("Error saving return:", error)
    } finally {
      setIsSavingReturn(false)
    }
  }
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <RotateCcw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Returns</p>
                <p className="text-2xl font-bold" data-testid="text-total-returns">{stats.totalReturns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Refunded</p>
                <p className="text-2xl font-bold" data-testid="text-total-refunded">Rs.{Math.round(stats.totalRefunded).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Package className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Item Returns</p>
                <p className="text-2xl font-bold" data-testid="text-item-returns">{stats.itemReturns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bill Returns</p>
                <p className="text-2xl font-bold" data-testid="text-bill-returns">{stats.billReturns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, phone, or return ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">From:</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-36"
            data-testid="input-start-date"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">To:</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36"
            data-testid="input-end-date"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
          title="Refresh returns data"
          data-testid="button-refresh"
        >
          <RotateCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Return History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Return ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Refund Amount</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No returns found
                  </TableCell>
                </TableRow>
              ) : (
                visibleReturns.map((ret) => (
                  <TableRow key={ret.id} data-testid={`row-return-${ret.id}`}>
                    <TableCell>{formatDateShort(ret.createdAt)}</TableCell>
                    <TableCell className="font-mono font-semibold">#{ret.id.slice(0, 8).toUpperCase()}</TableCell>
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
                    <TableCell className="text-right font-semibold text-red-600">
                      Rs.{Math.round(Number.parseFloat(ret.totalRefund || "0")).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ret.returnItems.length} items</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ret.status === "completed" ? "default" : "secondary"} className="capitalize">
                        {ret.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(ret)} data-testid={`button-view-${ret.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEditReturn(ret.id, ret)} data-testid={`button-edit-${ret.id}`} title="Edit return (within 12 hours)">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => downloadReturnPDF(ret)} data-testid={`button-download-${ret.id}`}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {filteredReturns.length > visibleLimit && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleLimit((prev) => prev + VISIBLE_LIMIT_INCREMENT)}
                data-testid="button-load-more"
              >
                Load More ({filteredReturns.length - visibleLimit} remaining)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return Details</DialogTitle>
            <DialogDescription>
              {selectedReturn && `Return #${selectedReturn.id.slice(0, 8).toUpperCase()}`}
            </DialogDescription>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedReturn.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedReturn.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(new Date(selectedReturn.createdAt))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant={selectedReturn.returnType === "full_bill" ? "destructive" : "secondary"}>
                    {selectedReturn.returnType === "full_bill" ? "Full Bill Return" : "Item Return"}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Returned Items</p>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-2 space-y-2">
                    {selectedReturn.returnItems.map((item, index) => (
                      <div key={item.id} className="p-3 rounded-md bg-muted/30 border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">
                              {item.color
                                ? `${item.color.colorCode} - ${item.color.colorName}`
                                : `Item ${index + 1}`}
                            </p>
                            {item.color && (
                              <p className="text-xs text-muted-foreground">
                                {item.color.variant.product.company} - {item.color.variant.product.productName} ({item.color.variant.packingSize})
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">Qty: {item.quantity}</p>
                            <p className="text-sm text-red-600">Rs.{Math.round(Number.parseFloat(item.refundAmount || "0")).toLocaleString()}</p>
                          </div>
                        </div>
                        {item.restocked && (
                          <Badge variant="outline" className="mt-2 text-xs bg-green-50 text-green-700">
                            Restocked
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {selectedReturn.reason && (
                <div>
                  <p className="text-sm font-medium mb-1">Return Reason</p>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">{selectedReturn.reason}</p>
                </div>
              )}

              <div className="flex justify-between items-center p-3 rounded-md bg-red-50 border border-red-200">
                <p className="font-medium">Total Refund</p>
                <p className="text-xl font-bold text-red-600">
                  Rs.{Math.round(Number.parseFloat(selectedReturn.totalRefund || "0")).toLocaleString()}
                </p>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => downloadReturnPDF(selectedReturn)} data-testid="button-download-details">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Return Panel */}
      {editingReturnId && (
        <Card className="rounded-xl border border-blue-200/50 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/10 backdrop-blur-sm overflow-hidden shadow-sm mt-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Edit Return</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingReturnId(null)
                  setEditReturnData({})
                  setEditingError(null)
                  setCanEditReturn(null)
                }}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!canEditReturn?.canEdit && editingError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">{editingError}</p>
                  {canEditReturn?.hoursLeft !== undefined && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      This return can only be edited within 12 hours of creation.
                    </p>
                  )}
                </div>
              </div>
            )}

            {canEditReturn?.canEdit && (
              <div className="space-y-4">
                {canEditReturn.hoursLeft !== undefined && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                        Edit window: {canEditReturn.hoursLeft.toFixed(1)} hours remaining
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Refund Method
                    </label>
                    <Select
                      value={editReturnData.refundMethod || "cash"}
                      onValueChange={(value) =>
                        setEditReturnData({ ...editReturnData, refundMethod: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">💵 Cash</SelectItem>
                        <SelectItem value="credit">💳 Credit</SelectItem>
                        <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Status
                    </label>
                    <Select
                      value={editReturnData.status || "completed"}
                      onValueChange={(value) =>
                        setEditReturnData({ ...editReturnData, status: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Refund Amount
                    </label>
                    <Input
                      type="number"
                      value={editReturnData.totalRefund || ""}
                      onChange={(e) =>
                        setEditReturnData({ ...editReturnData, totalRefund: e.target.value })
                      }
                      placeholder="0.00"
                      className="h-8 text-xs border-slate-200 dark:border-slate-700"
                      step="0.01"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Reason
                    </label>
                    <Input
                      value={editReturnData.reason || ""}
                      onChange={(e) =>
                        setEditReturnData({ ...editReturnData, reason: e.target.value })
                      }
                      placeholder="Enter reason for return"
                      className="h-8 text-xs border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>

                {editingError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-300">{editingError}</p>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingReturnId(null)
                      setEditReturnData({})
                      setEditingError(null)
                      setCanEditReturn(null)
                    }}
                    className="h-8 text-xs border-slate-200 dark:border-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveReturn(editingReturnId)}
                    disabled={isSavingReturn}
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {isSavingReturn ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
