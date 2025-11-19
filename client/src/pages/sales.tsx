// sales.tsx - Updated with glassy design and dd-mm-yyyy dates
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

interface SaleWithItems extends Sale {
  items?: Array<{
    productName: string;
    variantName: string;
    colorName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

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

export default function Sales() {
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
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

  // Generate detailed sale bill PDF with glassy design
  const generateDetailedSalePDF = (sale: SaleWithItems) => {
    const receiptSettings = getReceiptSettings();
    const saleDate = new Date(sale.createdAt);
    const formattedDate = formatDate(saleDate);
    const formattedTime = formatTime(saleDate);
    
    let pdfHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Sale Bill - ${sale.id.slice(-8)}</title>
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛍️ Sale Bill</h1>
            <p>Professional Invoice • ${formattedDate} at ${formattedTime}</p>
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
                <span class="info-value">${sale.id.slice(-8).toUpperCase()}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Date:</span>
                <span class="info-value">${formattedDate}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Time:</span>
                <span class="info-value">${formattedTime}</span>
              </div>
            </div>

            <div class="info-card">
              <h3>👤 Customer Information</h3>
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">${sale.customerName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Phone:</span>
                <span class="info-value">${sale.customerPhone}</span>
              </div>
            </div>
          </div>
    `;

    // Items Table
    if (sale.items && sale.items.length > 0) {
      pdfHTML += `
        <div class="section">
          <div class="section-title">🛒 Items Details • ${sale.items.length} Items</div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Variant/Color</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Price</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      sale.items.forEach((item, index) => {
        pdfHTML += `
              <tr>
                <td>${item.productName}</td>
                <td>${item.variantName} ${item.colorName ? `- ${item.colorName}` : ''}</td>
                <td>${item.quantity}</td>
                <td class="amount">Rs. ${item.unitPrice.toFixed(2)}</td>
                <td class="amount">Rs. ${item.totalPrice.toFixed(2)}</td>
              </tr>
        `;
      });
      
      pdfHTML += `
              <tr class="total-row">
                <td colspan="4"><strong>GRAND TOTAL</strong></td>
                <td class="amount"><strong>Rs. ${Math.round(parseFloat(sale.totalAmount)).toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Amount Summary
    pdfHTML += `
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
            <div class="amount-value">
              Rs. ${Math.round(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString()}
            </div>
          </div>
        </div>
        
        <div style="text-align: center;">
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

  // Download PDF for individual sale
  const downloadSalePDF = (sale: SaleWithItems) => {
    const pdfHTML = generateDetailedSalePDF(sale);
    const blob = new Blob([pdfHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bill_${sale.customerName}_${sale.id.slice(-8)}_${formatDate(new Date()).replace(/\//g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({ 
      title: "Bill Downloaded", 
      description: `Bill for ${sale.customerName} has been downloaded` 
    });
  };

  // View PDF for individual sale
  const viewSalePDF = (sale: SaleWithItems) => {
    const pdfHTML = generateDetailedSalePDF(sale);
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
  const shareBillViaWhatsApp = (sale: SaleWithItems) => {
    const totalAmount = Math.round(parseFloat(sale.totalAmount));
    const amountPaid = Math.round(parseFloat(sale.amountPaid));
    const amountDue = totalAmount - amountPaid;
    
    const message = `🛍️ *${getReceiptSettings().businessName} - Sale Bill*

*Bill ID:* ${sale.id.slice(-8).toUpperCase()}
*Customer:* ${sale.customerName}
*Phone:* ${sale.customerPhone}
*Date:* ${formatDate(sale.createdAt)}
*Time:* ${formatTime(sale.createdAt)}

*Amount Details:*
💰 Total: Rs. ${totalAmount.toLocaleString()}
💳 Paid: Rs. ${amountPaid.toLocaleString()}
⚖️ Due: Rs. ${amountDue.toLocaleString()}

*Status:* ${sale.paymentStatus.toUpperCase()}

Thank you for your business! 🎨
_${getReceiptSettings().businessName} - ${getReceiptSettings().address}_`;

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
            end.setHours(23, 59, 59, 999);
            
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
                                    <span>{formatDate(sale.createdAt)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Time: </span>
                                    <span>{formatTime(sale.createdAt)}</span>
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
                                    onClick={() => viewSalePDF(sale as SaleWithItems)}
                                    className="h-8 w-8 p-0"
                                    title="View PDF"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => downloadSalePDF(sale as SaleWithItems)}
                                    className="h-8 w-8 p-0"
                                    title="Download PDF"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => shareBillViaWhatsApp(sale as SaleWithItems)}
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