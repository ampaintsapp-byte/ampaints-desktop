import { useState, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Eye,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Calendar,
  User,
  Phone,
  DollarSign,
  Package,
  Download,
  Printer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useDateFormat } from "@/hooks/use-date-format";
import type { Return, ReturnWithItems } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import { useReceiptSettings } from "@/hooks/use-receipt-settings";

interface ReturnStats {
  totalReturns: number;
  totalRefunded: number;
  itemReturns: number;
  billReturns: number;
}

export default function Returns() {
  const { formatDateShort } = useDateFormat();
  const { receiptSettings } = useReceiptSettings();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<ReturnWithItems | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);

  const { data: returns = [], isLoading } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
  });

  const filteredReturns = useMemo(() => {
    return returns.filter(ret =>
      ret.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.customerPhone.includes(searchQuery) ||
      ret.id.toLowerCase().includes(searchQuery)
    );
  }, [returns, searchQuery]);

  const stats: ReturnStats = useMemo(() => {
    return {
      totalReturns: returns.length,
      totalRefunded: returns.reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0),
      itemReturns: returns.filter(ret => ret.returnType === "item").length,
      billReturns: returns.filter(ret => ret.returnType === "bill").length,
    };
  }, [returns]);

  const handleViewDetails = (returnRecord: ReturnWithItems) => {
    setSelectedReturn(returnRecord);
    setViewDetailsOpen(true);
  };

  const downloadReturnPDF = (returnRecord: ReturnWithItems) => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    // Header
    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 30, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("RETURN DOCUMENT", pageWidth / 2, 12, { align: "center" });
    pdf.setFontSize(9);
    pdf.text(receiptSettings.businessName, pageWidth / 2, 20, { align: "center" });

    pdf.setTextColor(0, 0, 0);
    yPos = 40;

    // Return Info
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("Return Details:", margin, yPos);
    yPos += 6;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Return ID: ${returnRecord.id.slice(0, 8).toUpperCase()}`, margin, yPos);
    yPos += 5;
    pdf.text(`Date: ${formatDateShort(returnRecord.createdAt)}`, margin, yPos);
    yPos += 5;
    pdf.text(`Status: ${returnRecord.status.toUpperCase()}`, margin, yPos);
    yPos += 5;
    pdf.text(`Type: ${returnRecord.returnType === "bill" ? "FULL BILL RETURN" : "ITEM RETURN"}`, margin, yPos);
    yPos += 10;

    // Customer Info
    pdf.setFont("helvetica", "bold");
    pdf.text("Customer Information:", margin, yPos);
    yPos += 6;

    pdf.setFont("helvetica", "normal");
    pdf.text(`Name: ${returnRecord.customerName}`, margin, yPos);
    yPos += 5;
    pdf.text(`Phone: ${returnRecord.customerPhone}`, margin, yPos);
    yPos += 10;

    if (returnRecord.sale) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Original Sale:", margin, yPos);
      yPos += 5;
      
      pdf.setFont("helvetica", "normal");
      pdf.text(`Sale ID: ${returnRecord.sale.id.slice(0, 8).toUpperCase()}`, margin, yPos);
      yPos += 5;
      pdf.text(`Sale Date: ${formatDateShort(returnRecord.sale.createdAt)}`, margin, yPos);
      yPos += 10;
    }

    // Returned Items Table
    pdf.setFont("helvetica", "bold");
    pdf.text("Returned Items:", margin, yPos);
    yPos += 8;

    // Table header
    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);

    pdf.text("Product", margin + 3, yPos + 5);
    pdf.text("Qty", margin + 70, yPos + 5);
    pdf.text("Rate", margin + 90, yPos + 5);
    pdf.text("Subtotal", pageWidth - margin - 20, yPos + 5, { align: "right" });
    yPos += 10;

    pdf.setTextColor(0, 0, 0);

    // Table rows
    returnRecord.returnItems.forEach((item, index) => {
      if (yPos > 250) {
        pdf.addPage();
        yPos = margin;
      }

      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255];
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, "F");

      pdf.setFontSize(8);
      const productName = `${item.color.variant.product.productName} - ${item.color.colorName} (${item.color.colorCode})`;
      pdf.text(productName.substring(0, 40), margin + 3, yPos + 5);
      pdf.text(item.quantity.toString(), margin + 70, yPos + 5);
      pdf.text(`Rs.${Math.round(parseFloat(item.rate))}`, margin + 90, yPos + 5);
      pdf.text(`Rs.${Math.round(parseFloat(item.subtotal))}`, pageWidth - margin - 3, yPos + 5, {
        align: "right"
      });

      yPos += 8;
    });

    yPos += 10;

    // Summary
    pdf.setFont("helvetica", "bold");
    pdf.text("Return Summary:", margin, yPos);
    yPos += 8;

    pdf.setFont("helvetica", "normal");
    pdf.text(`Total Items Returned: ${returnRecord.returnItems.length}`, margin, yPos);
    yPos += 5;
    pdf.text(`Total Refund Amount: Rs.${Math.round(parseFloat(returnRecord.totalRefund || "0"))}`, margin, yPos);
    yPos += 10;

    if (returnRecord.reason) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Reason:", margin, yPos);
      yPos += 5;
      pdf.setFont("helvetica", "normal");
      pdf.text(returnRecord.reason, margin, yPos);
    }

    pdf.save(`Return-${returnRecord.id.slice(0, 8).toUpperCase()}-${formatDateShort(returnRecord.createdAt).replace(/\//g, "-")}.pdf`);
    toast({
      title: "Return Document Downloaded",
      description: "PDF has been downloaded successfully.",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <RotateCcw className="h-8 w-8" />
          Returns Management
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <RotateCcw className="h-5 w-5 text-blue-600" />
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
              <div className="p-2 rounded-lg bg-red-100">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Refunded</p>
                <p className="text-2xl font-bold">Rs.{Math.round(stats.totalRefunded).toLocaleString()}</p>
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
                <p className="text-2xl font-bold">{stats.itemReturns}</p>
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
                <p className="text-2xl font-bold">{stats.billReturns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, phone, or return ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Returns Table */}
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
                filteredReturns.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell>{formatDateShort(ret.createdAt)}</TableCell>
                    <TableCell className="font-mono font-semibold">
                      #{ret.id.slice(0, 8).toUpperCase()}
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
                        variant={ret.returnType === "bill" ? "destructive" : "secondary"}
                        className="capitalize"
                      >
                        {ret.returnType === "bill" ? "Full Bill" : "Item"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      Rs.{Math.round(parseFloat(ret.totalRefund || "0")).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ret.returnItems.length} items</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ret.status === "completed" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {ret.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(ret)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadReturnPDF(ret)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Return Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return Details - #{selectedReturn?.id.slice(0, 8).toUpperCase()}</DialogTitle>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-6">
              {/* Return Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Return Date</p>
                  <p className="font-semibold">{formatDateShort(selectedReturn.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Return Type</p>
                  <p className="font-semibold">
                    {selectedReturn.returnType === "bill" ? "Full Bill Return" : "Item Return"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className="capitalize">{selectedReturn.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Refund</p>
                  <p className="font-semibold text-red-600">
                    Rs.{Math.round(parseFloat(selectedReturn.totalRefund || "0")).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h3>
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
              </div>

              {/* Original Sale Info */}
              {selectedReturn.sale && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Original Sale</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm p-3 bg-blue-50 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">Sale ID:</span>
                      <p className="font-mono font-semibold">
                        #{selectedReturn.sale.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sale Date:</span>
                      <p className="font-medium">{formatDateShort(selectedReturn.sale.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Amount:</span>
                      <p className="font-medium">Rs.{Math.round(parseFloat(selectedReturn.sale.totalAmount)).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount Paid:</span>
                      <p className="font-medium">Rs.{Math.round(parseFloat(selectedReturn.sale.amountPaid)).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Returned Items */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Returned Items ({selectedReturn.returnItems.length})
                </h3>
                <div className="space-y-3">
                  {selectedReturn.returnItems.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">
                              {item.color.variant.product.productName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.color.colorName} ({item.color.colorCode})
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Size: {item.color.variant.packingSize}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{item.quantity} units</Badge>
                            {item.stockRestored && (
                              <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                                <CheckCircle className="h-3 w-3" />
                                Stock Restored
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Rate:</span>
                          <span className="font-mono">Rs.{Math.round(parseFloat(item.rate)).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold border-t pt-2">
                          <span>Refund Amount:</span>
                          <span className="text-red-600">Rs.{Math.round(parseFloat(item.subtotal)).toLocaleString()}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Return Reason */}
              {selectedReturn.reason && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Return Reason</h3>
                  <p className="text-sm text-muted-foreground p-3 bg-yellow-50 rounded-lg">
                    {selectedReturn.reason}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
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
