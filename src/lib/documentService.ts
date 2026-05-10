import { jsPDF } from 'jspdf';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { Invoice, Payment, Receipt } from '../types';
import { format } from 'date-fns';

export const generateAndUploadInvoicePDF = async (invoice: Invoice): Promise<string> => {
  const doc = new jsPDF();
  
  // Header - Enterprise Deep Blue
  doc.setFillColor(11, 60, 93);
  doc.rect(0, 0, 210, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text("WAAMIKAN ENTERPRISE", 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("Healthcare Solutions | Medical Imaging | Consumables", 20, 32);
  doc.text("37 Military Hospital Road, Accra, Ghana", 20, 37);
  doc.text("Tel: +233 24 000 0000 | Email: Waamikan@gmail.com", 20, 42);

  // Status Badge
  const statusColor = invoice.status === 'paid' ? [0, 150, 0] : [200, 0, 0];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(140, 15, 50, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(invoice.status.toUpperCase(), 165, 23, { align: 'center' });
  
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
    doc.text(`GH₵ ${item.unitPrice.toLocaleString()}`, 155, y, { align: 'right' });
    doc.text(`GH₵ ${item.total.toLocaleString()}`, 190, y, { align: 'right' });
    y += 10;
  });
  
  // Totals
  y += 10;
  doc.setDrawColor(230, 230, 230);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFontSize(10);
  doc.text("Subtotal:", 150, y, { align: 'right' });
  doc.text(`GH₵ ${invoice.subtotal.toLocaleString()}`, 190, y, { align: 'right' });
  y += 12;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 60, 93);
  doc.text("TOTAL DUE:", 150, y, { align: 'right' });
  doc.text(`GH₵ ${invoice.total.toLocaleString()}`, 190, y, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
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
  doc.text("37 Military Hospital Road, Accra, Ghana", 20, 37);
  doc.text("Tel: +233 24 000 0000 | Email: Waamikan@gmail.com", 20, 42);
  
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
  doc.text(`GH₵ ${receipt.amount.toLocaleString()}`, 80, 115);
  
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
  doc.text(`OUTSTANDING BALANCE: GH₵ ${receipt.remainingBalance.toLocaleString()}`, 30, 165);
  
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("Thank you for your business. For any billing inquiries, please contact our accounts department.", 105, 275, { align: 'center' });
  doc.text("WAAMIKAN ENTERPRISE - Partners in Health", 105, 282, { align: 'center' });
  
  const pdfBlob = doc.output('blob');
  const storageRef = ref(storage, `receipts/${receipt.receiptNumber}.pdf`);
  await uploadBytes(storageRef, pdfBlob);
  return await getDownloadURL(storageRef);
};

export const printDocument = async (type: string, data: any) => {
  const pdfDoc = new jsPDF();
  
  // Reuse header logic
  pdfDoc.setFillColor(11, 60, 93);
  pdfDoc.rect(0, 0, 210, 50, 'F');
  pdfDoc.setTextColor(255, 255, 255);
  pdfDoc.setFontSize(28);
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.text("WAAMIKAN ENTERPRISE", 20, 25);
  
  pdfDoc.setFontSize(10);
  pdfDoc.setFont('helvetica', 'normal');
  pdfDoc.text("Healthcare Solutions | Medical Imaging | Consumables", 20, 32);
  pdfDoc.text("Accra, Ghana • Official Document", 20, 37);

  // Document Title
  pdfDoc.setTextColor(0, 0, 0);
  pdfDoc.setFontSize(18);
  pdfDoc.text(type.toUpperCase(), 140, 25, { align: 'left' });
  pdfDoc.setFontSize(10);
  pdfDoc.text(`ID: ${data.invoiceNumber || data.docNumber || data.id}`, 140, 32);
  pdfDoc.text(`Date: ${format(new Date(data.createdAt || data.date), 'PPP')}`, 140, 37);

  // Content
  let y = 70;
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.text("Entity / Customer:", 20, y);
  pdfDoc.setFont('helvetica', 'normal');
  pdfDoc.text(data.customerName || "N/A", 60, y);
  
  y += 20;
  pdfDoc.setFillColor(245, 245, 245);
  pdfDoc.rect(20, y, 170, 10, 'F');
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.text("Description", 25, y + 7);
  pdfDoc.text("Amount", 190, y + 7, { align: 'right' });
  
  y += 15;
  pdfDoc.setFont('helvetica', 'normal');
  const items = data.items || [{ name: 'Document Total', total: data.total || data.amount }];
  items.forEach((item: any) => {
    pdfDoc.text(item.name || item.description || 'Generic Item', 25, y);
    pdfDoc.text(`GH₵ ${(item.total || item.amount || data.total).toLocaleString()}`, 190, y, { align: 'right' });
    y += 10;
  });

  y += 10;
  pdfDoc.setDrawColor(200, 200, 200);
  pdfDoc.line(20, y, 190, y);
  y += 10;
  pdfDoc.setFontSize(14);
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.text("TOTAL:", 150, y, { align: 'right' });
  pdfDoc.text(`GH₵ ${(data.total || data.amount).toLocaleString()}`, 190, y, { align: 'right' });

  // Open in new tab for printing
  const string = pdfDoc.output('bloburl');
  window.open(string, '_blank');
};

export const downloadDocument = async (type: string, data: any) => {
  const pdfDoc = new jsPDF();
  // ... similar generation logic but with save()
  // For simplicity and speed, let's use the print logic's blob mechanism
  
  pdfDoc.setFillColor(11, 60, 93);
  pdfDoc.rect(0, 0, 210, 50, 'F');
  pdfDoc.setTextColor(255, 255, 255);
  pdfDoc.setFontSize(28);
  pdfDoc.setFont('helvetica', 'bold');
  pdfDoc.text("WAAMIKAN ENTERPRISE", 20, 25);
  
  pdfDoc.setFontSize(10);
  pdfDoc.setFont('helvetica', 'normal');
  pdfDoc.text("Official Records Storage", 20, 32);

  pdfDoc.setTextColor(0, 0, 0);
  pdfDoc.setFontSize(18);
  pdfDoc.text(type.toUpperCase(), 140, 25);
  
  pdfDoc.text(`Doc ID: ${data.id}`, 20, 80);
  pdfDoc.text(`Total amount: GH₵ ${(data.total || data.amount).toLocaleString()}`, 20, 90);

  pdfDoc.save(`${type}_${data.id}.pdf`);
};
