import { jsPDF } from 'jspdf';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { Invoice, Receipt, Product } from '../types';
import { COMPANY_INFO } from '../constants/auth';
import { safeFormatDate } from './dateUtils';

const safeUploadBlob = async (path: string, blob: Blob): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.warn(`Storage upload skipped for ${path}:`, error);
    return '';
  }
};

const compressImageToDataUrl = (file: File, maxWidth = 800, quality = 0.72): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const uploadProductImage = async (file: File): Promise<string> => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageUrl = await safeUploadBlob(`products/${Date.now()}_${safeName}`, file);
  if (storageUrl) return storageUrl;
  return await compressImageToDataUrl(file);
};

const drawCompanyHeader = (doc: jsPDF, fillColor: [number, number, number], rightBadgeText?: string, badgeColor?: [number, number, number]) => {
  doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
  doc.rect(0, 0, 210, 52, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 16, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.tagline, 16, 28);
  doc.text(COMPANY_INFO.address, 16, 34);
  doc.text(`Tel: ${COMPANY_INFO.phonesDisplay} | Email: ${COMPANY_INFO.email}`, 16, 40);

  if (rightBadgeText) {
    const [r, g, b] = badgeColor || [234, 179, 8];
    doc.setFillColor(r, g, b);
    doc.roundedRect(148, 12, 46, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(rightBadgeText.toUpperCase(), 171, 20, { align: 'center' });
  }
};

const drawFooter = (doc: jsPDF) => {
  doc.setDrawColor(230, 230, 230);
  doc.line(16, 266, 194, 266);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(COMPANY_INFO.projectsNotice, 105, 272, { align: 'center', maxWidth: 176 });
  doc.text(`${COMPANY_INFO.name} | ${COMPANY_INFO.address} | ${COMPANY_INFO.phonesDisplay}`, 105, 282, { align: 'center' });
  doc.text('Electronically generated official document.', 105, 287, { align: 'center' });
};

export const generateInvoicePDFDoc = (invoice: Invoice): jsPDF => {
  const doc = new jsPDF();
  const isPaid = invoice.status === 'paid';
  drawCompanyHeader(doc, [11, 60, 93], invoice.status.toUpperCase(), isPaid ? [22, 163, 74] : [220, 38, 38]);

  // Invoice Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`INVOICE: ${invoice.invoiceNumber}`, 194, 65, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Date: ${safeFormatDate(invoice.createdAt, 'PPP')}`, 194, 72, { align: 'right' });
  doc.text(`Due Date: ${safeFormatDate(invoice.dueDate, 'PPP')}`, 194, 79, { align: 'right' });

  // Billing To
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 16, 65);
  doc.setFontSize(13);
  doc.text(invoice.customerName || 'Institutional Client', 16, 72, { maxWidth: 105 });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Institutional Healthcare Partner', 16, 79);

  // Table Header
  doc.setTextColor(0, 0, 0);
  let y = 98;
  doc.setFillColor(245, 247, 250);
  doc.rect(16, y, 178, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Item Description', 20, y + 7);
  doc.text('Qty', 124, y + 7, { align: 'right' });
  doc.text('Unit Price', 158, y + 7, { align: 'right' });
  doc.text('Total', 190, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  y += 16;
  (invoice.items || []).forEach((item) => {
    if (y > 245) {
      doc.addPage();
      y = 24;
    }
    const nameLines = doc.splitTextToSize(item.name || 'Supply Item', 88);
    doc.text(nameLines, 20, y);
    doc.text(String(item.quantity || 0), 124, y, { align: 'right' });
    doc.text(`GHC ${(item.unitPrice || 0).toLocaleString()}`, 158, y, { align: 'right' });
    doc.text(`GHC ${(item.total || 0).toLocaleString()}`, 190, y, { align: 'right' });
    y += Math.max(9, nameLines.length * 6);
  });

  // Totals
  y += 6;
  doc.setDrawColor(225, 230, 235);
  doc.line(16, y, 194, y);
  y += 10;
  doc.setFontSize(10);
  doc.text('Subtotal:', 152, y, { align: 'right' });
  doc.text(`GHC ${(invoice.subtotal ?? invoice.total ?? 0).toLocaleString()}`, 190, y, { align: 'right' });
  if (invoice.vat) {
    y += 7;
    doc.text('VAT / Tax:', 152, y, { align: 'right' });
    doc.text(`GHC ${invoice.vat.toLocaleString()}`, 190, y, { align: 'right' });
  }
  y += 11;
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 60, 93);
  doc.text('TOTAL:', 152, y, { align: 'right' });
  doc.text(`GHC ${(invoice.total || 0).toLocaleString()}`, 190, y, { align: 'right' });

  if ((invoice.paidAmount || 0) > 0) {
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(22, 163, 74);
    doc.text('Paid:', 152, y, { align: 'right' });
    doc.text(`GHC ${(invoice.paidAmount || 0).toLocaleString()}`, 190, y, { align: 'right' });
    y += 7;
    doc.setTextColor(180, 0, 0);
    doc.text('Balance Due:', 152, y, { align: 'right' });
    doc.text(`GHC ${(invoice.remainingBalance ?? 0).toLocaleString()}`, 190, y, { align: 'right' });
  }

  drawFooter(doc);
  return doc;
};

export const generateAndUploadInvoicePDF = async (invoice: Invoice): Promise<string> => {
  const doc = generateInvoicePDFDoc(invoice);
  const pdfBlob = doc.output('blob');
  return await safeUploadBlob(`invoices/${invoice.invoiceNumber}.pdf`, pdfBlob);
};

export const generateReceiptPDFDoc = (receipt: Receipt): jsPDF => {
  const doc = new jsPDF();
  drawCompanyHeader(doc, [31, 122, 140], 'OFFICIAL RECEIPT', [11, 60, 93]);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Receipt #: ${receipt.receiptNumber}`, 16, 65);
  doc.text(`Invoice Ref: ${receipt.invoiceNumber || 'N/A'}`, 194, 65, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Date of Issue: ${safeFormatDate(receipt.date, 'PPPP')}`, 16, 72);

  doc.setFillColor(245, 248, 250);
  doc.rect(16, 84, 178, 68, 'F');
  doc.setDrawColor(31, 122, 140);
  doc.setLineWidth(0.5);
  doc.line(16, 84, 194, 84);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('RECEIVED FROM:', 24, 102);
  doc.setFontSize(13);
  doc.setTextColor(11, 60, 93);
  doc.text(receipt.customerName || 'Client', 78, 102, { maxWidth: 110 });

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text('AMOUNT PAID:', 24, 118);
  doc.setFontSize(15);
  doc.setTextColor(31, 122, 140);
  doc.text(`GHC ${(receipt.amount || 0).toLocaleString()}`, 78, 118);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text('METHOD:', 24, 134);
  doc.setTextColor(0, 0, 0);
  const methodText = `${(receipt.method || 'Cash').toUpperCase()}${receipt.chequeNumber ? ` (Chq: ${receipt.chequeNumber})` : ''}`;
  doc.text(methodText, 78, 134);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 0, 0);
  doc.text(`OUTSTANDING BALANCE: GHC ${(receipt.remainingBalance || 0).toLocaleString()}`, 24, 166);

  drawFooter(doc);
  return doc;
};

export const generateAndUploadReceiptPDF = async (receipt: Receipt): Promise<string> => {
  const doc = generateReceiptPDFDoc(receipt);
  const pdfBlob = doc.output('blob');
  return await safeUploadBlob(`receipts/${receipt.receiptNumber}.pdf`, pdfBlob);
};

const generatePDFInternal = (type: string, data: any): jsPDF => {
  if (type.toLowerCase() === 'invoice' && Array.isArray(data?.items) && data?.invoiceNumber) {
    return generateInvoicePDFDoc(data as Invoice);
  }
  if (type.toLowerCase() === 'receipt' && data?.receiptNumber) {
    return generateReceiptPDFDoc(data as Receipt);
  }

  const doc = new jsPDF();
  drawCompanyHeader(doc, [11, 60, 93], type.toUpperCase(), [31, 122, 140]);

  const docIdentifier =
    data.invoiceNumber ||
    data.orderNumber ||
    data.docNumber ||
    data.receiptNumber ||
    data.poNumber ||
    data.quoteNumber ||
    data.billNumber ||
    data.waybillNumber ||
    data.noteNumber ||
    data.employeeId ||
    data.id ||
    'DOCUMENT';

  const dateStr = safeFormatDate(data.createdAt || data.date || new Date(), 'PPP');

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`REF: ${docIdentifier}`, 194, 64, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${dateStr}`, 194, 71, { align: 'right' });
  if (data.status) {
    doc.text(`Status: ${String(data.status).toUpperCase()}`, 194, 78, { align: 'right' });
  }

  let y = 64;
  doc.setFont('helvetica', 'bold');
  doc.text('ISSUED TO / PARTY:', 16, y);
  doc.setFontSize(13);
  const partyName = data.customerName || data.supplierName || data.employeeName || 'WAAMIKAN Partner';
  doc.text(partyName, 16, y + 7, { maxWidth: 110 });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (data.destination || data.address) {
    doc.text(`Destination: ${data.destination || data.address}`, 16, y + 14, { maxWidth: 110 });
  } else if (data.driverName) {
    doc.text(`Driver: ${data.driverName} (${data.vehicleNumber || 'Fleet'})`, 16, y + 14);
  } else {
    doc.text('Institutional Healthcare Partner', 16, y + 14);
  }

  y = 98;
  doc.setFillColor(245, 247, 250);
  doc.rect(16, y, 178, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Description', 20, y + 7);
  doc.text('Qty', 130, y + 7, { align: 'right' });
  doc.text('Amount', 190, y + 7, { align: 'right' });

  y += 16;
  doc.setFont('helvetica', 'normal');

  const items = Array.isArray(data.items) && data.items.length > 0
    ? data.items
    : [
        {
          description: data.reason || data.description || data.month ? `Period: ${data.month}` : `${type} Summary`,
          quantity: 1,
          total: data.total ?? data.netPay ?? data.amount ?? 0,
        },
      ];

  items.forEach((item: any) => {
    if (y > 245) {
      doc.addPage();
      y = 24;
    }
    const desc = String(item.name || item.description || 'Item');
    const qty = item.quantity ?? 1;
    const amount = Number(item.total ?? item.amount ?? data.total ?? data.netPay ?? data.amount ?? 0);
    doc.text(doc.splitTextToSize(desc, 100), 20, y);
    doc.text(String(qty), 130, y, { align: 'right' });
    doc.text(`GHC ${amount.toLocaleString()}`, 190, y, { align: 'right' });
    y += 10;
  });

  y += 8;
  doc.setDrawColor(210, 215, 220);
  doc.line(16, y, 194, y);
  y += 10;

  const grandTotal = Number(data.total ?? data.netPay ?? data.amount ?? 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 60, 93);
  doc.text('TOTAL:', 150, y, { align: 'right' });
  doc.text(`GHC ${grandTotal.toLocaleString()}`, 190, y, { align: 'right' });

  drawFooter(doc);
  return doc;
};

export const generateStockReportPDF = (products: Product[]) => {
  const doc = new jsPDF();
  drawCompanyHeader(doc, [11, 60, 93], 'STOCK REPORT', [234, 179, 8]);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Generated on: ${safeFormatDate(new Date(), 'PPPP p')}`, 194, 62, { align: 'right' });

  let y = 72;
  doc.setFillColor(240, 242, 245);
  doc.rect(16, y, 178, 10, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('SKU', 20, y + 7);
  doc.text('Product Name', 56, y + 7);
  doc.text('Category', 132, y + 7);
  doc.text('Stock', 190, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  y += 16;
  products.forEach((p) => {
    if (y > 255) {
      doc.addPage();
      y = 24;
    }
    doc.text(String(p.sku || '-').slice(0, 16), 20, y);
    doc.text(String(p.name || '').slice(0, 34), 56, y);
    doc.text(String(p.category || '-'), 132, y);
    doc.text(String(p.stock ?? 0), 190, y, { align: 'right' });
    y += 9;
  });

  drawFooter(doc);
  return doc;
};

const openOrDownloadPDF = (doc: jsPDF, fallbackName: string) => {
  const blobUrl = doc.output('bloburl');
  const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    doc.save(fallbackName);
  }
};

export const printStockReport = (products: Product[]) => {
  const doc = generateStockReportPDF(products);
  openOrDownloadPDF(doc, 'waamikan_stock_report.pdf');
};

export const printDocument = async (type: string, data: any) => {
  const doc = generatePDFInternal(type, data);
  const safeId = data.invoiceNumber || data.docNumber || data.receiptNumber || data.poNumber || data.id || 'document';
  openOrDownloadPDF(doc, `${type.replace(/\s+/g, '_')}_${safeId}.pdf`);
};

export const downloadDocument = async (type: string, data: any) => {
  const doc = generatePDFInternal(type, data);
  const safeId = data.invoiceNumber || data.docNumber || data.receiptNumber || data.poNumber || data.id || 'document';
  doc.save(`${type.replace(/\s+/g, '_')}_${safeId}.pdf`);
};
