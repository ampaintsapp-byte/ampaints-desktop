import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Receipt, Calendar, RefreshCw, Download, Share2, FileText, Printer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface Sale {
  id: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string;
  amountPaid: string;
  paymentStatus: string;
  createdAt: string;
}

export default function Sales() {
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // "all", "today", "yesterday", "week", "month", "custom"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  // Add refresh function
  const refreshSales = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    toast({ title: "Sales data refreshed" });
  };

  // Generate PDF for individual sale bill
  const generateSalePDF = (sale: Sale) => {
    const saleDate = new Date(sale.createdAt);
    const formattedDate = saleDate.toLocaleDateString('en-PK');
    const formattedTime = saleDate.toLocaleTimeString('en-PK');
    
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Sale Bill - ${sale.id.slice(-8)}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Arial', sans-serif; color: #333; margin: 0; padding: 0; }
          .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0; color: #2563eb; font-size: 28px; }
          .header p { margin: 5px 0; color: #666; font-size: 14px; }
          .store-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
          .store-info h2 { margin: 0 0 10px 0; color: #1e293b; font-size: 20px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .info-card { background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
          .info-card h3 { margin: 0 0 10px 0; color: #1e293b; font-size: 16px; }
          .info-item { margin-bottom: 8px; }
          .info-label { font-weight: 600; color: #475569; display: inline-block; width: 120px; }
          .amount-section { background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #fdba74; }
          .amount-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; text-align: center; }
          .amount-item { padding: 10px; }
          .amount-label { font-size: 12px; color: #666; margin-bottom: 5px; }
          .amount-value { font-size: 18px; font-weight: bold; font-family: monospace; }
          .payment-status { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-weight: bold; 
            font-size: 14px; 
            margin: 10px 0; 
          }
          .status-paid { background: #d1fae5; color: #065f46; border: 2px solid #10b981; }
          .status-partial { background: #fef3c7; color: #92400e; border: 2px solid #f59e0b; }
          .status-unpaid { background: #fee2e2; color: #991b1b; border: 2px solid #ef4444; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
          .barcode { text-align: center; margin: 20px 0; font-family: monospace; letter-spacing: 2px; }
          .thank-you { text-align: center; margin: 20px 0; font-style: italic; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛍️ PaintPulse Sale Bill</h1>
          <p>Your Trusted Paint Partner</p>
        </div>

        <div class="store-info">
          <h2>PaintPulse Store</h2>
          <p>Quality Paints &amp; Solutions</p>
          <p>📞 Store: +92-XXX-XXXXXXX | 📧 info@paintpulse.com</p>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <h3>Bill Information</h3>
            <div class="info-item">
              <span class="info-label">Bill ID:</span> ${sale.id.slice(-8).toUpperCase()}
            </div>
            <div class="info-item">
              <span class="info-label">Date:</span> ${formattedDate}
            </div>
            <div class="info-item">
              <span class="info-label">Time:</span> ${formattedTime}
            </div>
          </div>

          <div class="info-card">
            <h3>Customer Information</h3>
            <div class="info-item">
              <span class="info-label">Name:</span> ${sale.customerName}
            </div>
            <div class="info-item">
              <span class="info-label">Phone:</span> ${sale.customerPhone}
            </div>
          </div>
        </div>

        <div class="amount-section">
          <div class="amount-grid">
            <div class="amount-item">
              <div class="amount-label">Total Amount</div>
              <div class="amount-value">Rs. ${Math.round(parseFloat(sale.totalAmount)).toLocaleString()}</div>
            </div>
            <div class="amount-item">
              <div class="amount-label">Amount Paid</div>
              <div class="amount-value">Rs. ${Math.round(parseFloat(sale.amountPaid)).toLocaleString()}</div>
            </div>
            <div class="amount-item">
              <div class="amount-label">Balance Due</div>
              <div class="amount-value" style="color: #dc2626;">
                Rs. ${Math.round(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString()}
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 15px;">
            <div class="payment-status ${
              sale.paymentStatus === 'paid' ? 'status-paid' : 
              sale.paymentStatus === 'partial' ? 'status-partial' : 'status-unpaid'
            }">
              ${sale.paymentStatus.toUpperCase()} 
              ${sale.paymentStatus === 'partial' ? 'PAYMENT' : ''}
            </div>
          </div>
        </div>

        <div class="barcode">
          ▮▮ ▮ ▮▮▮ ▮ ▮▮▮ ▮ ▮▮ ▮▮▮<br/>
          <small>Bill ID: ${sale.id.slice(-8).toUpperCase()}</small>
        </div>

        <div class="thank-you">
          Thank you for your business! 🎨<br/>
          We appreciate your trust in PaintPulse
        </div>

        <div class="footer">
          <p>PaintPulse POS System • Generated on ${new Date().toLocaleDateString('en-PK')}</p>
          <p>This is a computer-generated bill • For queries contact: +92-XXX-XXXXXXX</p>
        </div>
      </body>
      </html>
    `;

    return pdfHTML;
  };

  // Download PDF for individual sale
  const downloadSalePDF = (sale: Sale) => {
    const pdfHTML = generateSalePDF(sale);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bill_${sale.customerName}_${sale.id.slice(-8)}_${new Date(sale.createdAt).toLocaleDateString('en-PK').replace(/\//g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({ 
      title: "Bill Downloaded", 
      description: `Bill for ${sale.customerName} has been downloaded` 
    });
  };

  // View PDF for individual sale (opens in new tab)
  const viewSalePDF = (sale: Sale) => {
    const pdfHTML = generateSalePDF(sale);
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
      description: `Bill for ${sale.customerName} is ready for viewing/printing` 
    });
  };

  // Share bill via WhatsApp
  const shareBillViaWhatsApp = (sale: Sale) => {
    const totalAmount = Math.round(parseFloat(sale.totalAmount));
    const amountPaid = Math.round(parseFloat(sale.amountPaid));
    const amountDue = totalAmount - amountPaid;
    
    const message = `🛍️ *PaintPulse Sale Bill*

*Bill ID:* ${sale.id.slice(-8).toUpperCase()}
*Customer:* ${sale.customerName}
*Phone:* ${sale.customerPhone}
*Date:* ${new Date(sale.createdAt).toLocaleDateString('en-PK')}
*Time:* ${new Date(sale.createdAt).toLocaleTimeString('en-PK')}

*Amount Details:*
💰 Total: Rs. ${totalAmount.toLocaleString()}
💳 Paid: Rs. ${amountPaid.toLocaleString()}
⚖️ Due: Rs. ${amountDue.toLocaleString()}

*Status:* ${sale.paymentStatus.toUpperCase()}

Thank you for your business! 🎨
_PaintPulse - Your Trusted Paint Partner_`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    toast({ 
      title: "Share via WhatsApp", 
      description: `Bill details opened for sharing with ${sale.customerName}` 
    });
  };

  const filteredSales = useMemo(() => {
    let filtered = sales;

    // Customer search filter
    if (customerSearchQuery) {
      const query = customerSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((sale) => {
        const customerName = sale.customerName.toLowerCase();
        const customerPhone = sale.customerPhone.toLowerCase();
        return customerName.includes(query) || customerPhone.includes(query);
      });
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case "today":
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return saleDate >= today;
          });
          break;
        
        case "yesterday":
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return saleDate >= yesterday && saleDate < today;
          });
          break;
        
        case "week":
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return saleDate >= weekAgo;
          });
          break;
        
        case "month":
          const monthAgo = new Date(today);
          monthAgo.setDate(monthAgo.getDate() - 30);
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.createdAt);
            return saleDate >= monthAgo;
          });
          break;
        
        case "custom":
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Include entire end date
            
            filtered = filtered.filter(sale => {
              const saleDate = new Date(sale.createdAt);
              return saleDate >= start && saleDate <= end;
            });
          }
          break;
        
        default:
          break;
      }
    }

    return filtered;
  }, [sales, customerSearchQuery, dateFilter, startDate, endDate]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredSales.reduce((acc, sale) => {
      const total = parseFloat(sale.totalAmount) || 0;
      const paid = parseFloat(sale.amountPaid) || 0;
      const due = total - paid;

      return {
        totalAmount: acc.totalAmount + total,
        totalPaid: acc.totalPaid + paid,
        totalDue: acc.totalDue + due,
        count: acc.count + 1
      };
    }, {
      totalAmount: 0,
      totalPaid: 0,
      totalDue: 0,
      count: 0
    });
  }, [filteredSales]);

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-sales-title">Sales</h1>
          <p className="text-sm text-muted-foreground">View all sales transactions</p>
        </div>
        <Button variant="outline" onClick={refreshSales}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search and Filter Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer name or phone..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-sales-search"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm"
                    data-testid="select-date-filter"
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>

                  {dateFilter === "custom" && (
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="text-sm"
                        placeholder="Start Date"
                      />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="text-sm"
                        placeholder="End Date"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              {filteredSales.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Total Sales</div>
                      <div className="text-lg font-semibold">{totals.count}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Total Amount</div>
                      <div className="text-lg font-semibold">Rs. {Math.round(totals.totalAmount).toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Total Paid</div>
                      <div className="text-lg font-semibold">Rs. {Math.round(totals.totalPaid).toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Total Due</div>
                      <div className="text-lg font-semibold text-destructive">
                        Rs. {Math.round(totals.totalDue).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Sales List */}
              {filteredSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {customerSearchQuery || dateFilter !== "all" ? "No sales found matching your filters." : "No sales yet."}
                </div>
              ) : (
                <>
                  <div className="grid gap-3">
                    {filteredSales.map((sale) => {
                      const totalFloat = parseFloat(sale.totalAmount);
                      const paidFloat = parseFloat(sale.amountPaid);
                      const totalAmount = Math.round(totalFloat);
                      const amountPaid = Math.round(paidFloat);
                      const amountDue = Math.round(totalFloat - paidFloat);

                      return (
                        <Card key={sale.id} className="hover-elevate" data-testid={`card-sale-${sale.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Receipt className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-semibold">{sale.customerName}</span>
                                  {getPaymentStatusBadge(sale.paymentStatus)}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Phone: </span>
                                    <span className="font-mono">{sale.customerPhone}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Date: </span>
                                    <span>{new Date(sale.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Time: </span>
                                    <span>{new Date(sale.createdAt).toLocaleTimeString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-mono">
                                  <div>
                                    <span className="text-muted-foreground">Total: </span>
                                    <span className="font-semibold">Rs. {totalAmount.toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Paid: </span>
                                    <span className="font-semibold">Rs. {amountPaid.toLocaleString()}</span>
                                  </div>
                                  {amountDue > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">Due: </span>
                                      <span className="font-semibold text-destructive">Rs. {amountDue.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 items-end">
                                <Link
                                  href={`/bill/${sale.id}`}
                                  className="text-sm text-primary hover:underline whitespace-nowrap"
                                  data-testid={`link-view-bill-${sale.id}`}
                                >
                                  View Bill
                                </Link>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => viewSalePDF(sale)}
                                    className="h-8 w-8 p-0"
                                    title="View PDF"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => downloadSalePDF(sale)}
                                    className="h-8 w-8 p-0"
                                    title="Download PDF"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => shareBillViaWhatsApp(sale)}
                                    className="h-8 w-8 p-0"
                                    title="Share via WhatsApp"
                                  >
                                    <Share2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Results Summary */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredSales.length} of {sales.length} sales
                      {dateFilter !== "all" && ` • Filtered by ${dateFilter}`}
                    </p>
                    
                    {/* Grand Totals */}
                    <div className="flex items-center gap-4 text-xs font-mono font-semibold">
                      <div>
                        <span className="text-muted-foreground">Grand Total: </span>
                        <span>Rs. {Math.round(totals.totalAmount).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Paid: </span>
                        <span>Rs. {Math.round(totals.totalPaid).toLocaleString()}</span>
                      </div>
                      {totals.totalDue > 0 && (
                        <div>
                          <span className="text-muted-foreground">Total Due: </span>
                          <span className="text-destructive">Rs. {Math.round(totals.totalDue).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}