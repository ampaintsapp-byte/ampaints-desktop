import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, MoreVertical, Edit, Plus, Trash2, Save, X, Download, MessageCircle, Share2, Printer } from "lucide-react";
import { Link } from "wouter";
import type { SaleWithItems, ColorWithVariantAndProduct, SaleItem } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useDateFormat } from "@/hooks/use-date-format";
import { useReceiptSettings } from "@/hooks/use-receipt-settings";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useMemo, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThermalReceipt from "@/components/thermal-receipt";

export default function BillPrint() {
  const { formatDateShort } = useDateFormat();
  const { receiptSettings } = useReceiptSettings();
  const { canDeleteSales, canEditSales } = usePermissions();
  const [, params] = useRoute("/bill/:id");
  const saleId = params?.id;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [customRate, setCustomRate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItems, setEditingItems] = useState<{ [key: string]: { quantity: string; rate: string } }>({});
  const [editCustomerDialogOpen, setEditCustomerDialogOpen] = useState(false);
  const [editedCustomerName, setEditedCustomerName] = useState("");
  const [editedCustomerPhone, setEditedCustomerPhone] = useState("");
  
  const referrer = new URLSearchParams(searchParams).get('from');

  const { data: sale, isLoading, error } = useQuery<SaleWithItems>({
    queryKey: ["/api/sales", saleId],
    enabled: !!saleId,
  });

  const { data: colors = [] } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: addItemDialogOpen,
  });

  // Delete Bill - IMPROVED VERSION
  const deleteSale = async () => {
    if (!saleId) return;
    
    try {
      // First delete all sale items
      for (const item of sale?.saleItems || []) {
        await apiRequest("DELETE", `/api/sale-items/${item.id}`);
      }
      
      // Then delete the sale record
      await apiRequest("DELETE", `/api/sales/${saleId}`);
      
      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sale-items"] });
      
      toast({ 
        title: "Bill completely deleted", 
        description: "All bill data has been removed successfully" 
      });
      
      // Redirect to POS with cache clearance
      setTimeout(() => {
        window.location.href = "/pos?refresh=" + Date.now();
      }, 500);
      
    } catch (error) {
      console.error("Error deleting bill:", error);
      toast({ 
        title: "Failed to delete bill", 
        variant: "destructive",
        description: "Please try again" 
      });
    }
  };

  // Print Thermal
  const printThermal = () => {
    setTimeout(() => window.print(), 200);
  };

  // Direct Print - Simplified for Electron
  const directPrint = () => {
    if (!sale) return;
    
    // Check if running in Electron
    const electronAPI = (window as any).electronAPI;
    
    if (electronAPI?.printSilent) {
      // Use Electron silent print
      electronAPI.printSilent()
        .then(() => {
          toast({
            title: "Print Successful",
            description: `Receipt #${sale.id.slice(0, 8).toUpperCase()} sent to printer`,
          });
        })
        .catch((error: any) => {
          console.error("Print error:", error);
          toast({
            title: "Print Failed",
            description: "Check printer connection or use Print button instead",
            variant: "destructive"
          });
        });
    } else {
      // Fallback: use browser print
      toast({
        title: "Using Browser Print",
        description: "Direct print not available. Using standard print dialog.",
      });
      setTimeout(() => window.print(), 200);
    }
  };

  // Handle Back Navigation
  const handleGoBack = () => {
    if (referrer && sale?.customerPhone) {
      setLocation(`/customer/${encodeURIComponent(sale.customerPhone)}`);
    } else {
      setLocation('/sales');
    }
  };

  // Format phone for WhatsApp with validation
  const formatPhoneForWhatsApp = (phone: string): string | null => {
    if (!phone || phone.trim().length < 10) {
      return null;
    }
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.length < 10) {
      return null;
    }
    if (cleaned.startsWith('0')) {
      cleaned = '92' + cleaned.slice(1);
    } else if (!cleaned.startsWith('92') && !cleaned.startsWith('+92')) {
      cleaned = '92' + cleaned;
    }
    cleaned = cleaned.replace(/^\+/, '');
    if (cleaned.length < 12) {
      return null;
    }
    return cleaned;
  };

  // Download Bill as PDF - Professional Design
  const downloadBillPDF = () => {
    if (!sale) return;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 40, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text(receiptSettings.businessName, pageWidth / 2, 18, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(receiptSettings.address, pageWidth / 2, 26, { align: 'center' });

    pdf.setFontSize(8);
    pdf.text(receiptSettings.dealerText + ' ' + receiptSettings.dealerBrands, pageWidth / 2, 33, { align: 'center' });

    pdf.setTextColor(0, 0, 0);
    yPos = 50;

    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(margin, yPos, (pageWidth - 2 * margin) / 2 - 5, 28, 3, 3, 'F');
    pdf.roundedRect(pageWidth / 2 + 5, yPos, (pageWidth - 2 * margin) / 2 - 5, 28, 3, 3, 'F');

    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('INVOICE NUMBER', margin + 5, yPos + 6);
    pdf.text('DATE', margin + 5, yPos + 18);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`#${sale.id.slice(0, 8).toUpperCase()}`, margin + 5, yPos + 12);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDateShort(sale.createdAt), margin + 5, yPos + 24);

    const rightBoxX = pageWidth / 2 + 10;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('BILL TO', rightBoxX, yPos + 6);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(displayCustomerName, rightBoxX, yPos + 13);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(displayCustomerPhone, rightBoxX, yPos + 20);

    yPos += 38;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');

    const colX = {
      item: margin + 3,
      packing: margin + 80,
      qty: margin + 110,
      rate: margin + 130,
      amount: pageWidth - margin - 3
    };

    pdf.text('ITEM DESCRIPTION', colX.item, yPos + 5.5);
    pdf.text('SIZE', colX.packing, yPos + 5.5);
    pdf.text('QTY', colX.qty, yPos + 5.5);
    pdf.text('RATE', colX.rate, yPos + 5.5);
    pdf.text('AMOUNT', colX.amount, yPos + 5.5, { align: 'right' });

    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    sale.saleItems.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255];
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(item.color.variant.product.productName, colX.item, yPos + 4);

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`${item.color.colorName} (${item.color.colorCode})`, colX.item, yPos + 8);
      pdf.setTextColor(0, 0, 0);

      pdf.text(item.color.variant.packingSize, colX.packing, yPos + 6);
      pdf.text(item.quantity.toString(), colX.qty, yPos + 6);
      pdf.text(`Rs.${Math.round(parseFloat(item.rate)).toLocaleString()}`, colX.rate, yPos + 6);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Rs.${Math.round(parseFloat(item.subtotal)).toLocaleString()}`, colX.amount, yPos + 6, { align: 'right' });

      yPos += 12;
    });

    yPos += 5;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    const summaryX = pageWidth - margin - 60;
    const valueX = pageWidth - margin;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Subtotal:', summaryX, yPos);
    pdf.text(`Rs. ${Math.round(parseFloat(sale.totalAmount)).toLocaleString()}`, valueX, yPos, { align: 'right' });
    yPos += 7;

    pdf.setTextColor(34, 139, 34);
    pdf.text('Amount Paid:', summaryX, yPos);
    pdf.text(`Rs. ${Math.round(parseFloat(sale.amountPaid)).toLocaleString()}`, valueX, yPos, { align: 'right' });
    yPos += 7;

    const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);

    pdf.setFillColor(102, 126, 234);
    pdf.roundedRect(summaryX - 5, yPos - 4, pageWidth - summaryX + 5 - margin + 5, 12, 2, 2, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    
    if (outstanding > 0) {
      pdf.text('BALANCE DUE:', summaryX, yPos + 4);
      pdf.text(`Rs. ${Math.round(outstanding).toLocaleString()}`, valueX, yPos + 4, { align: 'right' });
    } else {
      pdf.text('STATUS:', summaryX, yPos + 4);
      pdf.text('PAID IN FULL', valueX, yPos + 4, { align: 'right' });
    }

    yPos += 25;

    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(receiptSettings.thankYou, pageWidth / 2, yPos, { align: 'center' });

    yPos += 8;
    pdf.setFontSize(8);
    pdf.text('This is a computer-generated invoice.', pageWidth / 2, yPos, { align: 'center' });

    pdf.save(`Invoice-${sale.id.slice(0, 8).toUpperCase()}-${formatDateShort(sale.createdAt).replace(/\//g, '-')}.pdf`);
    
    toast({
      title: "Invoice Downloaded",
      description: "Professional invoice has been downloaded as PDF.",
    });
  };

  // Generate Bill PDF as Blob for sharing
  const generateBillPDFBlob = (): Blob | null => {
    if (!sale) return null;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    pdf.setFillColor(102, 126, 234);
    pdf.rect(0, 0, pageWidth, 40, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.text(receiptSettings.businessName, pageWidth / 2, 18, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(receiptSettings.address, pageWidth / 2, 26, { align: 'center' });

    pdf.setFontSize(8);
    pdf.text(receiptSettings.dealerText + ' ' + receiptSettings.dealerBrands, pageWidth / 2, 33, { align: 'center' });

    pdf.setTextColor(0, 0, 0);
    yPos = 50;

    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(margin, yPos, (pageWidth - 2 * margin) / 2 - 5, 28, 3, 3, 'F');
    pdf.roundedRect(pageWidth / 2 + 5, yPos, (pageWidth - 2 * margin) / 2 - 5, 28, 3, 3, 'F');

    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('INVOICE NUMBER', margin + 5, yPos + 6);
    pdf.text('DATE', margin + 5, yPos + 18);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`#${sale.id.slice(0, 8).toUpperCase()}`, margin + 5, yPos + 12);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDateShort(sale.createdAt), margin + 5, yPos + 24);

    const rightBoxX = pageWidth / 2 + 10;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('BILL TO', rightBoxX, yPos + 6);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(displayCustomerName, rightBoxX, yPos + 13);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(displayCustomerPhone, rightBoxX, yPos + 20);

    yPos += 38;

    pdf.setFillColor(50, 50, 50);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');

    const colX = {
      item: margin + 3,
      packing: margin + 80,
      qty: margin + 110,
      rate: margin + 130,
      amount: pageWidth - margin - 3
    };

    pdf.text('ITEM DESCRIPTION', colX.item, yPos + 5.5);
    pdf.text('SIZE', colX.packing, yPos + 5.5);
    pdf.text('QTY', colX.qty, yPos + 5.5);
    pdf.text('RATE', colX.rate, yPos + 5.5);
    pdf.text('AMOUNT', colX.amount, yPos + 5.5, { align: 'right' });

    yPos += 10;
    pdf.setTextColor(0, 0, 0);

    sale.saleItems.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255];
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(item.color.variant.product.productName, colX.item, yPos + 4);

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`${item.color.colorName} (${item.color.colorCode})`, colX.item, yPos + 8);
      pdf.setTextColor(0, 0, 0);

      pdf.text(item.color.variant.packingSize, colX.packing, yPos + 6);
      pdf.text(item.quantity.toString(), colX.qty, yPos + 6);
      pdf.text(`Rs.${Math.round(parseFloat(item.rate)).toLocaleString()}`, colX.rate, yPos + 6);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Rs.${Math.round(parseFloat(item.subtotal)).toLocaleString()}`, colX.amount, yPos + 6, { align: 'right' });

      yPos += 12;
    });

    yPos += 5;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    const summaryX = pageWidth - margin - 60;
    const valueX = pageWidth - margin;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Subtotal:', summaryX, yPos);
    pdf.text(`Rs. ${Math.round(parseFloat(sale.totalAmount)).toLocaleString()}`, valueX, yPos, { align: 'right' });
    yPos += 7;

    pdf.setTextColor(34, 139, 34);
    pdf.text('Amount Paid:', summaryX, yPos);
    pdf.text(`Rs. ${Math.round(parseFloat(sale.amountPaid)).toLocaleString()}`, valueX, yPos, { align: 'right' });
    yPos += 7;

    const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);

    pdf.setFillColor(102, 126, 234);
    pdf.roundedRect(summaryX - 5, yPos - 4, pageWidth - summaryX + 5 - margin + 5, 12, 2, 2, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    
    if (outstanding > 0) {
      pdf.text('BALANCE DUE:', summaryX, yPos + 4);
      pdf.text(`Rs. ${Math.round(outstanding).toLocaleString()}`, valueX, yPos + 4, { align: 'right' });
    } else {
      pdf.text('STATUS:', summaryX, yPos + 4);
      pdf.text('PAID IN FULL', valueX, yPos + 4, { align: 'right' });
    }

    yPos += 25;

    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(receiptSettings.thankYou, pageWidth / 2, yPos, { align: 'center' });

    yPos += 8;
    pdf.setFontSize(8);
    pdf.text('This is a computer-generated invoice.', pageWidth / 2, yPos, { align: 'center' });

    return pdf.output('blob');
  };

  // Share Bill via WhatsApp - WITH PDF FILE SUPPORT
  const shareToWhatsApp = async () => {
    if (!sale) return;

    const whatsappPhone = formatPhoneForWhatsApp(sale.customerPhone);
    
    if (!whatsappPhone) {
      toast({
        title: "Invalid Phone Number",
        description: "Customer phone number is invalid for WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    const pdfBlob = generateBillPDFBlob();
    if (!pdfBlob) return;

    const fileName = `Invoice-${sale.id.slice(0, 8).toUpperCase()}-${formatDateShort(sale.createdAt).replace(/\//g, '-')}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Check if Electron API available for direct share
    const electronAPI = (window as any).electronAPI;
    
    if (electronAPI?.shareToWhatsApp) {
      try {
        // Try Electron native share
        await electronAPI.shareToWhatsApp(whatsappPhone, {
          fileName: fileName,
          pdfData: await pdfBlob.arrayBuffer(),
          businessName: receiptSettings.businessName,
          totalAmount: Math.round(parseFloat(sale.totalAmount)),
          customerName: sale.customerName,
        });
        toast({
          title: "Shared Successfully",
          description: "Invoice sent to WhatsApp",
        });
        return;
      } catch (error) {
        console.log('Electron share failed, trying fallback');
      }
    }

    // Try Web Share API (works on some mobile browsers)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Invoice - ${sale.customerName}`,
          text: `Invoice from ${receiptSettings.businessName}`
        });
        toast({
          title: "Shared Successfully",
          description: "Invoice shared via WhatsApp",
        });
        return;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.log('Web share failed, using text fallback');
        } else {
          return;
        }
      }
    }

    // Fallback: Text message with WhatsApp link
    const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);
    const itemsList = sale.saleItems.map(item => 
      `${item.color.variant.product.productName} x${item.quantity} Rs.${Math.round(parseFloat(item.subtotal))}`
    ).join('\n');

    const message = `*${receiptSettings.businessName}*\n*Bill #${sale.id.slice(0, 8).toUpperCase()}*\n\n${sale.customerName}\n\n*Items:*\n${itemsList}\n\n*Total:* Rs.${Math.round(parseFloat(sale.totalAmount)).toLocaleString()}\n*Paid:* Rs.${Math.round(parseFloat(sale.amountPaid)).toLocaleString()}\n${outstanding > 0 ? `*Due:* Rs.${Math.round(outstanding).toLocaleString()}` : '*Status: PAID*'}\n\n${receiptSettings.thankYou}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappPhone}?text=${encodedMessage}`, '_blank');
    
    toast({
      title: "WhatsApp Opening",
      description: "Bill details sent to WhatsApp. Send PDF separately from your device.",
    });
  };

  // Add Item with Custom Rate
  const handleAddItem = () => {
    if (!selectedColor) return toast({ title: "Select product", variant: "destructive" });
    const qty = parseInt(quantity);
    if (qty < 1) return toast({ title: "Invalid quantity", variant: "destructive" });

    // Use custom rate if provided, otherwise use product's default rate
    const itemRate = customRate ? parseFloat(customRate) : parseFloat(selectedColor.variant.rate);
    
    if (isNaN(itemRate) || itemRate < 0) return toast({ title: "Invalid rate", variant: "destructive" });

    apiRequest("POST", `/api/sales/${saleId}/items`, {
      colorId: selectedColor.id,
      quantity: qty,
      rate: itemRate,
      subtotal: itemRate * qty,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      toast({ title: "Item added" });
      setAddItemDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setCustomRate("");
      setSearchQuery("");
    });
  };

  // Start Edit Mode
  const startEditMode = () => {
    if (!sale) return;

    const initialEditingState: { [key: string]: { quantity: string; rate: string } } = {};
    sale.saleItems.forEach(item => {
      initialEditingState[item.id] = {
        quantity: item.quantity.toString(),
        rate: item.rate.toString()
      };
    });

    setEditingItems(initialEditingState);
    setEditMode(true);
  };

  // Cancel Edit Mode
  const cancelEditMode = () => {
    setEditingItems({});
    setEditMode(false);
  };

  // Update Item Field
  const updateEditingItem = (itemId: string, field: 'quantity' | 'rate', value: string) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  // Save All Changes
  const saveAllChanges = async () => {
    if (!sale) return;

    try {
      let hasChanges = false;

      // Update existing items
      for (const item of sale.saleItems) {
        const editingItem = editingItems[item.id];
        if (!editingItem) continue;

        const newQuantity = parseInt(editingItem.quantity);
        const newRate = parseFloat(editingItem.rate);

        if (isNaN(newQuantity) || newQuantity < 1) {
          toast({ title: `Invalid quantity for ${item.color.colorName}`, variant: "destructive" });
          return;
        }

        if (isNaN(newRate) || newRate < 0) {
          toast({ title: `Invalid rate for ${item.color.colorName}`, variant: "destructive" });
          return;
        }

        // Only update if changed
        if (newQuantity !== item.quantity || newRate !== parseFloat(item.rate)) {
          hasChanges = true;
          await apiRequest("PATCH", `/api/sale-items/${item.id}`, {
            quantity: newQuantity,
            rate: newRate,
            subtotal: newRate * newQuantity,
          });
        }
      }

      if (hasChanges) {
        await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
        toast({ title: "All changes saved" });
      } else {
        toast({ title: "No changes to save" });
      }

      setEditMode(false);
      setEditingItems({});
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  // Delete Individual Item
  const deleteItem = async (itemId: string, itemName: string) => {
    try {
      await apiRequest("DELETE", `/api/sale-items/${itemId}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      toast({ title: `${itemName} deleted` });

      // Remove from editing state if exists
      setEditingItems(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: "Failed to delete item", variant: "destructive" });
    }
  };

  // Smart Search with Exact Color Code Priority
  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;

    const q = searchQuery.toLowerCase().trim();
    
    // First, find exact color code matches
    const exactColorCodeMatches = colors.filter(c => 
      c.colorCode.toLowerCase() === q
    );

    // Then find partial matches
    const partialMatches = colors.filter(c => 
      c.colorName.toLowerCase().includes(q) ||
      c.colorCode.toLowerCase().includes(q) ||
      c.variant.product.company.toLowerCase().includes(q) ||
      c.variant.product.productName.toLowerCase().includes(q) ||
      c.variant.packingSize.toLowerCase().includes(q)
    ).filter(item => !exactColorCodeMatches.includes(item));

    // Combine results: exact matches first, then partial matches
    return [...exactColorCodeMatches, ...partialMatches];
  }, [colors, searchQuery]);

  // Reset custom rate when selecting new color
  useEffect(() => {
    if (selectedColor) {
      setCustomRate(selectedColor.variant.rate);
    }
  }, [selectedColor]);

  const formatDate = (d: string) => formatDateShort(d);

  // Get display customer name and phone (uses edited values if set)
  const displayCustomerName = editedCustomerName || sale?.customerName || "";
  const displayCustomerPhone = editedCustomerPhone || sale?.customerPhone || "";

  // Open customer edit dialog
  const openEditCustomerDialog = () => {
    if (sale) {
      setEditedCustomerName(editedCustomerName || sale.customerName);
      setEditedCustomerPhone(editedCustomerPhone || sale.customerPhone);
      setEditCustomerDialogOpen(true);
    }
  };

  // Save customer edits (just for print - not saved to database)
  const saveCustomerEdits = () => {
    setEditCustomerDialogOpen(false);
    toast({
      title: "Customer Info Updated",
      description: "Updated info will be used for printing and PDF. Original bill data unchanged.",
    });
  };

  // Reset customer edits
  const resetCustomerEdits = () => {
    setEditedCustomerName("");
    setEditedCustomerPhone("");
    setEditCustomerDialogOpen(false);
  };

  // Show error if bill not found
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 p-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl p-8 border border-slate-100 dark:border-slate-700/50 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <Receipt className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Bill Not Found</h1>
            <p className="text-slate-600 dark:text-slate-400">The bill you are looking for does not exist or has been deleted.</p>
            <Link href="/pos">
              <Button className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to POS
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
  
  if (!sale) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 p-6 flex items-center justify-center">
      <p className="text-slate-600 dark:text-slate-400">Bill not found</p>
    </div>
  );

  const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);
  const isPaid = sale.paymentStatus === "paid";

  // Helper: One Line Product Name
  const getProductLine = (item: any) => {
    return `${item.color.variant.product.productName} - ${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
  };

  // Helper: Short Product Name for Receipt
  const getShortProductLine = (item: any) => {
    return `${item.color.variant.product.productName} - ${item.color.colorName}`;
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20 p-6">
        <div className="max-w-2xl mx-auto space-y-6">

        {/* Banking-Style Header */}
        <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm no-print">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <Button 
              variant="outline" 
              onClick={handleGoBack} 
              className="border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={downloadBillPDF} 
                variant="outline" 
                className="border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900"
                data-testid="button-download-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                onClick={printThermal} 
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md"
                data-testid="button-print-receipt"
              >
                <Receipt className="h-4 w-4 mr-2" />
                Print
              </Button>

              <div className="flex gap-2">
                {editMode ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={cancelEditMode} 
                      className="border-slate-200 dark:border-slate-700"
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-4 w-4 mr-2" /> Cancel
                    </Button>
                    <Button 
                      onClick={saveAllChanges} 
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md"
                      data-testid="button-save-changes"
                    >
                      <Save className="h-4 w-4 mr-2" /> Save Changes
                    </Button>
                  </>
                ) : (canEditSales || canDeleteSales) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="border-slate-200 dark:border-slate-700"
                        data-testid="button-bill-menu"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
                      {canEditSales && (
                        <DropdownMenuItem onClick={startEditMode} data-testid="menu-edit-bill">
                          <Edit className="h-4 w-4 mr-2" /> Edit Bill
                        </DropdownMenuItem>
                      )}
                      {canEditSales && (
                        <DropdownMenuItem onClick={() => setAddItemDialogOpen(true)} data-testid="menu-add-item">
                          <Plus className="h-4 w-4 mr-2" /> Add Item
                        </DropdownMenuItem>
                      )}
                      {canDeleteSales && (
                        <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600" data-testid="menu-delete-bill">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete Bill
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Screen View - Banking Style Invoice Card */}
        <Card className="print:hidden bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border-slate-100 dark:border-slate-700/50 shadow-sm rounded-2xl overflow-hidden">
          {/* Gradient Invoice Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Invoice</h1>
                  <p className="text-white/80 text-sm font-mono">#{sale.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
              <Badge 
                className={`${isPaid ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30' : 'bg-amber-500/20 text-amber-100 border-amber-400/30'} border`}
              >
                {sale.paymentStatus.toUpperCase()}
              </Badge>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Customer & Date Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Customer</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={openEditCustomerDialog}
                    data-testid="button-edit-customer"
                  >
                    <Edit className="h-3 w-3 text-slate-400" />
                  </Button>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    {displayCustomerName}
                    {(editedCustomerName || editedCustomerPhone) && (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Edited</Badge>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">{displayCustomerPhone}</p>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-xl p-4 space-y-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Date & Time</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{formatDateShort(sale.createdAt)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{new Date(sale.createdAt).toLocaleTimeString()}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-slate-900 dark:text-white">Items</h2>
                {editMode && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                    <Edit className="h-3 w-3 mr-1" /> Edit Mode
                  </Badge>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-zinc-800">
                    <tr>
                      <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Product</th>
                      <th className="text-right py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Qty</th>
                      <th className="text-right py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Rate</th>
                      <th className="text-right py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Amount</th>
                      {editMode && <th className="text-right py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {sale.saleItems.map((item) => (
                      <tr key={item.id} className="bg-white dark:bg-zinc-900/30">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                          {getProductLine(item)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                          {editMode ? (
                            <Input
                              type="number"
                              min="1"
                              value={editingItems[item.id]?.quantity || item.quantity}
                              onChange={(e) => updateEditingItem(item.id, 'quantity', e.target.value)}
                              className="w-20 text-right ml-auto border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <span className="font-mono">{item.quantity}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                          {editMode ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingItems[item.id]?.rate || item.rate}
                              onChange={(e) => updateEditingItem(item.id, 'rate', e.target.value)}
                              className="w-24 text-right ml-auto border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <span className="font-mono">Rs. {Math.round(parseFloat(item.rate))}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                          Rs. {Math.round(parseFloat(item.subtotal))}
                        </td>
                        {editMode && (
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteItem(item.id, item.color.colorName)}
                              className="text-red-600 border-red-200 dark:border-red-900/50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900/50 dark:to-zinc-800/50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span>Subtotal</span>
                <span className="font-mono font-semibold">Rs. {Math.round(parseFloat(sale.totalAmount)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                <span>Amount Paid</span>
                <span className="font-mono font-semibold">Rs. {Math.round(parseFloat(sale.amountPaid)).toLocaleString()}</span>
              </div>
              {!isPaid && (
                <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">Balance Due</span>
                  <span className="text-xl font-bold font-mono text-red-600 dark:text-red-400">Rs. {Math.round(outstanding).toLocaleString()}</span>
                </div>
              )}
              {isPaid && (
                <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Status</span>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-base px-4 py-1">
                    PAID IN FULL
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* PRINT ONLY: Thermal Receipt */}
      <ThermalReceipt 
        sale={sale} 
        receiptSettings={receiptSettings}
        customerNameOverride={editedCustomerName || undefined}
        customerPhoneOverride={editedCustomerPhone || undefined}
      />

      {/* Delete Bill Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Bill Completely?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              This will permanently delete:
            </p>
            <ul className="text-sm list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <li>All items in this bill</li>
              <li>Bill payment information</li>
              <li>Complete sale record</li>
            </ul>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              This action cannot be undone and all data will be lost permanently.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="border-slate-200 dark:border-slate-700">Cancel</Button>
            <Button variant="destructive" onClick={deleteSale}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Completely
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Plus className="h-5 w-5 text-indigo-500" />
              Add Item
            </DialogTitle>
          </DialogHeader>
          <Input 
            placeholder="Search by color code, color name, product, company..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            className="border-slate-200 dark:border-slate-700"
          />
          <div className="max-h-64 overflow-y-auto my-4 space-y-2">
            {filteredColors.map(c => (
              <div
                key={c.id}
                className={`p-4 cursor-pointer transition rounded-xl border ${
                  selectedColor?.id === c.id 
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" 
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-800/50 hover-elevate"
                }`}
                onClick={() => setSelectedColor(c)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{c.variant.product.productName} - {c.colorName} {c.colorCode} - {c.variant.packingSize}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {c.variant.product.company} • {c.variant.product.productName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">Rs. {Math.round(parseFloat(c.variant.rate))}</p>
                    <Badge 
                      variant="outline"
                      className={`${c.stockQuantity > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}
                    >
                      Stock: {c.stockQuantity}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedColor && (
            <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-slate-700 dark:text-slate-300">Quantity</Label>
                <Input 
                  id="quantity"
                  type="number" 
                  min="1" 
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)}
                  className="border-slate-200 dark:border-slate-700"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Zero stock allowed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate" className="text-slate-700 dark:text-slate-300">
                  Rate (Default: Rs. {Math.round(parseFloat(selectedColor.variant.rate))})
                </Label>
                <Input 
                  id="rate"
                  type="number" 
                  min="0"
                  step="0.01"
                  value={customRate} 
                  onChange={e => setCustomRate(e.target.value)} 
                  placeholder={`Enter custom rate (default: ${selectedColor.variant.rate})`}
                  className="border-slate-200 dark:border-slate-700"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You can change the rate from default price
                </p>
              </div>

              {customRate && customRate !== selectedColor.variant.rate && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-sm text-amber-800 dark:text-amber-400 font-medium">
                    Custom rate applied: Rs. {Math.round(parseFloat(customRate))} 
                    {parseFloat(customRate) > parseFloat(selectedColor.variant.rate) ? 
                      ` (+${Math.round(parseFloat(customRate) - parseFloat(selectedColor.variant.rate))})` : 
                      ` (${Math.round(parseFloat(customRate) - parseFloat(selectedColor.variant.rate))})`
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddItemDialogOpen(false);
              setSelectedColor(null);
              setCustomRate("");
              setSearchQuery("");
            }} className="border-slate-200 dark:border-slate-700">Cancel</Button>
            <Button onClick={handleAddItem} disabled={!selectedColor} className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editCustomerDialogOpen} onOpenChange={setEditCustomerDialogOpen}>
        <DialogContent aria-describedby={undefined} className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Edit className="h-5 w-5 text-indigo-500" />
              Edit Customer Details for Print
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName" className="text-slate-700 dark:text-slate-300">Customer Name</Label>
              <Input
                id="customerName"
                value={editedCustomerName}
                onChange={(e) => setEditedCustomerName(e.target.value)}
                placeholder="Enter customer name"
                data-testid="input-customer-name"
                className="border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone" className="text-slate-700 dark:text-slate-300">Phone Number</Label>
              <Input
                id="customerPhone"
                value={editedCustomerPhone}
                onChange={(e) => setEditedCustomerPhone(e.target.value)}
                placeholder="Enter phone number"
                data-testid="input-customer-phone"
                className="border-slate-200 dark:border-slate-700"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-zinc-800 p-3 rounded-lg">
              These changes are only for printing/PDF. Original bill data remains unchanged.
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={resetCustomerEdits} className="border-slate-200 dark:border-slate-700">
              Reset to Original
            </Button>
            <Button onClick={saveCustomerEdits} data-testid="button-save-customer" className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md">
              Save for Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print CSS - 80MM THERMAL OPTIMIZED */}
      <style>{`
        @media print {
          @page { 
            size: 80mm auto;
            margin: 0;
          }
          html, body { 
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            font-family: 'Courier New', 'Consolas', monospace;
            font-size: 11px;
            font-weight: bold;
            color: #000 !important;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow-x: hidden;
            border: none !important;
            outline: none !important;
          }
          .no-print, dialog, button { 
            display: none !important; 
          }
          * {
            color: #000 !important;
            font-weight: bold;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            box-sizing: border-box;
          }
          table {
            font-weight: bold;
            border-collapse: collapse;
            width: 100% !important;
            max-width: 100% !important;
          }
          h1, p, td, th, span, div {
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
        }
      `}</style>

    </>
  );
}
