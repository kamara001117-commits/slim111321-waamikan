import { jsPDF } from 'jspdf';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { Invoice, Payment, Receipt, Product } from '../types';
import { format } from 'date-fns';

export const generateAndUploadInvoicePDF = async (invoice: Invoice): Promise<string> => {
  const doc = new jsPDF();
  
  // Header - Enterprise Deep Blue
  doc.setFillColor(11, 60, 93);
  doc.rect(0, 0, 210, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text("WAAMIKAN ENTERPRISE", 20, 22);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("Healthcare Solutions | Medical Imaging | Consumables", 20, 30);
  doc.text("Oyibi, Accra Ghana", 20, 36);
  doc.text("Tel: +233 53 721 2475 / +233 20 898 7185 | Email: Waamikan@gmail.com", 20, 42);

  // Status Badge
  const statusColor = invoice.status === 'paid' ? [0, 150, 0] : [200, 0, 0];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(140, 12, 50, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(invoice.status.toUpperCase(), 165, 21, { align: 'center' });
  
  // Invoice Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`INVOICE: ${invoice.invoiceNumber}`, 140, 65);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${format(new Date(invoice.createdAt), 'PPP')}`, 140, 72);
  doc.text(`Due Date: ${format(new Date(invoice.dueDate), 'PPP')}`, 140, 79);
  
  // Billing To
  doc.setFont('helvetica', 'bold');
  doc.text("BILL TO:", 20, 65);
  doc.setFontSize(14);
  doc.text(invoice.customerName, 20, 72);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("Institutional Healthcare Partner", 20, 77);
  
  // Table Header
  let y = 100;
  doc.setFillColor(245, 245, 245);
  doc.rect(20, y, 170, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text("Item Description", 25, y + 7);
  doc.text("Qty", 120, y + 7, { align: 'right' });
  doc.text("Price", 155, y + 7, { align: 'right' });
  doc.text("Total", 190, y + 7, { align: 'right' });
  
  // Items
  doc.setFont('helvetica', 'normal');
  y += 15;
  invoice.items.forEach((item) => {
    doc.text(item.name, 25, y);
    doc.text(item.quantity.toString(), 120, y, { align: 'right' });
    doc.text(`GHC ${item.unitPrice.toLocaleString()}`, 155, y, { align: 'right' });
    doc.text(`GHC ${item.total.toLocaleString()}`, 190, y, { align: 'right' });
    y += 10;
  });
  
  // Totals
  y += 10;
  doc.setDrawColor(230, 230, 230);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFontSize(10);
  doc.text("Subtotal:", 150, y, { align: 'right' });
  doc.text(`GHC ${invoice.subtotal.toLocaleString()}`, 190, y, { align: 'right' });
  y += 12;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 60, 93);
  doc.text("TOTAL DUE:", 150, y, { align: 'right' });
  doc.text(`GHC ${invoice.total.toLocaleString()}`, 190, y, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("WAAMIKAN also specializes in hospital projects, servicing, and repairs for public and private healthcare institutions.", 105, 275, { align: 'center' });
  doc.text("This is an electronically generated document. No signature required.", 105, 280, { align: 'center' });
  doc.text("WAAMIKAN ENTERPRISE - Integrity in Healthcare Delivery", 105, 285, { align: 'center' });
  
  const pdfBlob = doc.output('blob');
  const storageRef = ref(storage, `invoices/${invoice.invoiceNumber}.pdf`);
  await uploadBytes(storageRef, pdfBlob);
  return await getDownloadURL(storageRef);
};

export const generateAndUploadReceiptPDF = async (receipt: Receipt): Promise<string> => {
  const doc = new jsPDF();
  
  // Header - Teal Branding
  doc.setFillColor(31, 122, 140);
  doc.rect(0, 0, 210, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text("OFFICIAL RECEIPT", 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("WAAMIKAN ENTERPRISE | Payment Acknowledgement", 20, 32);
  doc.text("Oyibi, Accra Ghana", 20, 37);
  doc.text("Tel: +233 53 721 2475 / +233 20 898 7185 | Email: Waamikan@gmail.com", 20, 42);
  
  // Receipt Info
  doc.setTextColor(31, 122, 140);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Receipt #: ${receipt.receiptNumber}`, 140, 25, { align: 'left' });
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date of Issue: ${format(new Date(receipt.date), 'PPPP')}`, 20, 65);
  doc.text(`Invoice Reference: ${receipt.invoiceNumber}`, 140, 65);
  
  // Payment Details Card
  doc.setFillColor(245, 248, 250);
  doc.rect(20, 80, 170, 70, 'F');
  doc.setDrawColor(31, 122, 140);
  doc.setLineWidth(0.5);
  doc.line(20, 80, 190, 80);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text("RECEIVED FROM:", 30, 100);
  doc.setFontSize(14);
  doc.setTextColor(11, 60, 93);
  doc.text(receipt.customerName, 80, 100);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text("AMOUNT PAID:", 30, 115);
  doc.setFontSize(16);
  doc.setTextColor(31, 122, 140);
  doc.text(`GHC ${receipt.amount.toLocaleString()}`, 80, 115);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text("METHOD:", 30, 130);
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(receipt.method.toUpperCase() + (receipt.chequeNumber ? ` (Chq: ${receipt.chequeNumber})` : ''), 80, 130);
  
  // Footer Stats
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 0, 0);
  doc.text(`OUTSTANDING BALANCE: GHC ${receipt.remainingBalance.toLocaleString()}`, 30, 165);
  
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("WAAMIKAN specializes in hospital projects, equipment servicing, and repairs for both public and private institutions.", 105, 268, { align: 'center' });
  doc.text("Thank you for your business. For any billing inquiries, please contact our accounts department.", 105, 275, { align: 'center' });
  doc.text("WAAMIKAN ENTERPRISE - Partners in Health", 105, 282, { align: 'center' });
  
  const pdfBlob = doc.output('blob');
  const storageRef = ref(storage, `receipts/${receipt.receiptNumber}.pdf`);
  await uploadBytes(storageRef, pdfBlob);
  return await getDownloadURL(storageRef);
};

const generatePDFInternal = (type: string, data: any) => {
  const doc = new jsPDF();
  
  // Header - Enterprise Deep Blue
  doc.setFillColor(11, 60, 93);
  doc.rect(0, 0, 210, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text("WAAMIKAN ENTERPRISE", 20, 22);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text("Healthcare Solutions | Medical Imaging | Consumables", 20, 30);
  doc.text("Oyibi, Accra Ghana", 20, 36);
  doc.text("Tel: +233 53 721 2475 / +233 20 898 7185 | Email: Waamikan@gmail.com", 20, 42);

  // Document Title & Meta (Right Aligned)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(type.toUpperCase(), 190, 22, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`ID: ${data.invoiceNumber || data.docNumber || data.receiptNumber || data.id}`, 190, 30, { align: 'right' });
  doc.text(`Date: ${format(new Date(data.createdAt || data.date), 'PPP')}`, 190, 36, { align: 'right' });

  // Content Area
  doc.setTextColor(0, 0, 0);
  let y = 70;
  doc.setFont('helvetica', 'bold');
  doc.text("BILL TO / ENTITY:", 20, y);
  doc.setFontSize(14);
  doc.text(data.customerName || data.supplierName || "N/A", 20, y + 8);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("Institutional Partner", 20, y + 14);

  y += 35;
  // Table Header
  doc.setFillColor(245, 245, 245);
  doc.rect(20, y, 170, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text("Description", 25, y + 7);
  doc.text("Amount", 190, y + 7, { align: 'right' });
  
  y += 15;
  doc.setFont('helvetica', 'normal');
  const items = data.items || [{ description: 'Document Total', total: data.total || data.amount }];
  items.forEach((item: any) => {
    const desc = item.name || item.description || 'Generic Item';
    const amount = item.total || item.amount || data.total || data.amount;
    doc.text(desc, 25, y);
    doc.text(`GHC ${amount.toLocaleString()}`, 190, y, { align: 'right' });
    y += 10;
  });

  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  
  y += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 60, 93);
  doc.text("TOTAL:", 150, y, { align: 'right' });
  doc.text(`GHC ${(data.total || data.amount).toLocaleString()}`, 190, y, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("WAAMIKAN also undertakes hospital projects, servicing, and repairs for public and private healthcare institutions.", 105, 275, { align: 'center' });
  doc.text("This is an electronically generated official document.", 105, 280, { align: 'center' });
  doc.text("WAAMIKAN ENTERPRISE - Integrity in Healthcare Delivery", 105, 285, { align: 'center' });

  return doc;
};

export const generateStockReportPDF = (products: Product[]) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(11, 60, 93);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("WAAMIKAN ENTERPRISE", 20, 20);
  doc.setFontSize(14);
  doc.text("INVENTORY STOCK LEVEL REPORT", 20, 30);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Generated on: ${format(new Date(), 'PPPP p')}`, 140, 50);

  // Table
  let y = 60;
  doc.setFillColor(240, 240, 240);
  doc.rect(20, y, 170, 10, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("SKU", 25, y + 7);
  doc.text("Product Name", 60, y + 7);
  doc.text("Category", 130, y + 7);
  doc.text("Stock", 185, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  y += 15;
  products.forEach((p, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(p.sku, 25, y);
    doc.text(p.name.substring(0, 35), 60, y);
    doc.text(p.category, 130, y);
    doc.text(p.stock.toString(), 185, y, { align: 'right' });
    y += 10;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("WAAMIKAN ENTERPRISE - Inventory Management System", 105, 285, { align: 'center' });

  return doc;
};

export const printStockReport = (products: Product[]) => {
  const doc = generateStockReportPDF(products);
  const string = doc.output('bloburl');
  window.open(string, '_blank');
};

export const printDocument = async (type: string, data: any) => {
  const doc = generatePDFInternal(type, data);
  const string = doc.output('bloburl');
  window.open(string, '_blank');
};

export const downloadDocument = async (type: string, data: any) => {
  const doc = generatePDFInternal(type, data);
  doc.save(`${type}_${data.id || data.invoiceNumber}.pdf`);
};

