import { jsPDF, GState } from 'jspdf';
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

const drawBottomLogoWatermark = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
) => {
  const minDim = Math.min(canvasWidth, canvasHeight);
  const scale = Math.max(0.55, Math.min(1.6, minDim / 680));

  const badgeHeight = Math.round(52 * scale);
  const iconRadius = Math.round(18 * scale);
  const gap = Math.round(10 * scale);
  const padX = Math.round(14 * scale);

  const titleFontSize = Math.round(20 * scale);
  const subFontSize = Math.max(8, Math.round(8.5 * scale));

  ctx.save();
  ctx.font = `900 ${titleFontSize}px Inter, system-ui, -apple-system, sans-serif`;
  const titleText = 'WAAMIKAN';
  const titleWidth = ctx.measureText(titleText).width;

  ctx.font = `800 ${subFontSize}px Inter, system-ui, -apple-system, sans-serif`;
  const subText = 'SUPPLY & IMAGING';
  const subWidth = ctx.measureText(subText).width;
  const barWidth = Math.round(22 * scale);
  const subRowWidth = barWidth + Math.round(6 * scale) + subWidth;

  const textBlockWidth = Math.max(titleWidth, subRowWidth);
  const lockupWidth = iconRadius * 2 + gap + textBlockWidth;
  const pillWidth = lockupWidth + padX * 2;
  const pillHeight = badgeHeight;

  const marginBottom = Math.max(10, Math.round(canvasHeight * 0.032));
  const pillX = Math.round((canvasWidth - pillWidth) / 2);
  const pillY = canvasHeight - marginBottom - pillHeight;
  const pillRadius = Math.round(pillHeight / 2);

  // Subtle translucent frosted pill so watermark stays transparent yet crisp on any photo
  ctx.globalAlpha = 0.46;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.strokeStyle = 'rgba(11, 60, 93, 0.25)';
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
  ctx.fill();
  ctx.stroke();

  // Circular WAAMIKAN Precision Medical Symbol matching Home page Logo.tsx
  const cx = pillX + padX + iconRadius;
  const cy = pillY + pillHeight / 2;

  // Outer precision ring
  ctx.beginPath();
  ctx.arc(cx, cy, iconRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.6 * scale);
  ctx.strokeStyle = 'rgba(11, 60, 93, 0.35)';
  ctx.stroke();

  // Stylized 'W' in deep navy (#0B3C5D)
  const pts: [number, number][] = [
    [cx - iconRadius * 0.5, cy - iconRadius * 0.24],
    [cx - iconRadius * 0.22, cy + iconRadius * 0.34],
    [cx, cy - iconRadius * 0.04],
    [cx + iconRadius * 0.22, cy + iconRadius * 0.34],
    [cx + iconRadius * 0.5, cy - iconRadius * 0.24],
  ];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, 3.2 * scale);
  ctx.strokeStyle = '#0B3C5D';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.stroke();

  // Gold Imaging Beam inner chevron (#EAB308)
  ctx.strokeStyle = '#EAB308';
  ctx.beginPath();
  ctx.moveTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.lineTo(pts[3][0], pts[3][1]);
  ctx.stroke();

  // Gold focal node dot
  ctx.beginPath();
  ctx.arc(pts[2][0], pts[2][1], Math.max(1.5, 2.2 * scale), 0, Math.PI * 2);
  ctx.fillStyle = '#EAB308';
  ctx.fill();

  // Text Lockup: WAAMIKAN + gold bar + SUPPLY & IMAGING
  const textX = pillX + padX + iconRadius * 2 + gap;
  const titleY = cy + Math.round(2 * scale);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0B3C5D';
  ctx.font = `900 ${titleFontSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.fillText(titleText, textX, titleY);

  const subRowY = titleY + Math.round(10 * scale);
  const barHeight = Math.max(2.5, Math.round(3.5 * scale));
  ctx.fillStyle = '#EAB308';
  ctx.beginPath();
  ctx.roundRect(textX, subRowY - barHeight - Math.round(1.5 * scale), barWidth, barHeight, barHeight / 2);
  ctx.fill();

  ctx.fillStyle = '#1F7A8C';
  ctx.font = `800 ${subFontSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.fillText(subText, textX + barWidth + Math.round(6 * scale), subRowY);

  ctx.restore();
};

const renderWatermarkedImage = (
  file: File,
  maxWidth = 1000,
  quality = 0.85
): Promise<{ blob: Blob; dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        drawBottomLogoWatermark(ctx, width, height);

        let fallbackDataUrl = canvas.toDataURL('image/jpeg', Math.min(quality, 0.74));
        if (fallbackDataUrl.length > 270000) {
          fallbackDataUrl = canvas.toDataURL('image/jpeg', 0.55);
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to export watermarked image'));
              return;
            }
            resolve({ blob, dataUrl: fallbackDataUrl });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const uploadProductImage = async (file: File): Promise<string> => {
  const safeBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'product';
  const { blob, dataUrl } = await renderWatermarkedImage(file);
  const storageUrl = await safeUploadBlob(`products/${Date.now()}_${safeBaseName}.jpg`, blob);
  if (storageUrl) return storageUrl;
  return dataUrl;
};

const drawWaamikanLogoPDF = (doc: jsPDF, cx: number, cy: number, r: number) => {
  // Subtle outer halo ring
  doc.setDrawColor(186, 230, 253);
  doc.setLineWidth(0.45);
  doc.circle(cx, cy, r * 1.15, 'S');

  // Crisp white circular badge backing so mark stands out on navy or teal banners
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r, 'F');

  // Stylized 'W' coordinates matching Logo.tsx
  const x1 = cx - r * 0.5;
  const y1 = cy - r * 0.24;
  const x2 = cx - r * 0.22;
  const y2 = cy + r * 0.34;
  const x3 = cx;
  const y3 = cy - r * 0.04;
  const x4 = cx + r * 0.22;
  const y4 = cy + r * 0.34;
  const x5 = cx + r * 0.5;
  const y5 = cy - r * 0.24;

  doc.setLineCap('round');
  doc.setLineJoin('round');
  doc.setLineWidth(r * 0.19);
  doc.setDrawColor(11, 60, 93);
  doc.line(x1, y1, x2, y2);
  doc.line(x2, y2, x3, y3);
  doc.line(x3, y3, x4, y4);
  doc.line(x4, y4, x5, y5);

  // Gold Imaging Beam chevron
  doc.setDrawColor(234, 179, 8);
  doc.line(x2, y2, x3, y3);
  doc.line(x3, y3, x4, y4);

  // Gold focal node dot
  doc.setFillColor(234, 179, 8);
  doc.circle(x3, y3, r * 0.11, 'F');

  // Reset stroke defaults
  doc.setLineCap('butt');
  doc.setLineJoin('miter');
  doc.setLineWidth(0.2);
};

const drawPageWatermarkPDF = (doc: jsPDF) => {
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.085, 'stroke-opacity': 0.085 }));

  const cx = 105;
  const cy = 152;
  const r = 44;

  // Outer precision medical ring
  doc.setDrawColor(11, 60, 93);
  doc.setLineWidth(1.8);
  doc.circle(cx, cy, r * 1.15, 'S');

  // Inner circle ring
  doc.setDrawColor(31, 122, 140);
  doc.setLineWidth(1.0);
  doc.circle(cx, cy, r, 'S');

  // Stylized 'W' matching Logo.tsx
  const x1 = cx - r * 0.5;
  const y1 = cy - r * 0.24;
  const x2 = cx - r * 0.22;
  const y2 = cy + r * 0.34;
  const x3 = cx;
  const y3 = cy - r * 0.04;
  const x4 = cx + r * 0.22;
  const y4 = cy + r * 0.34;
  const x5 = cx + r * 0.5;
  const y5 = cy - r * 0.24;

  doc.setLineCap('round');
  doc.setLineJoin('round');
  doc.setLineWidth(r * 0.19);
  doc.setDrawColor(11, 60, 93);
  doc.line(x1, y1, x2, y2);
  doc.line(x2, y2, x3, y3);
  doc.line(x3, y3, x4, y4);
  doc.line(x4, y4, x5, y5);

  // Gold Imaging Beam chevron
  doc.setDrawColor(234, 179, 8);
  doc.line(x2, y2, x3, y3);
  doc.line(x3, y3, x4, y4);

  // Gold focal node dot
  doc.setFillColor(234, 179, 8);
  doc.circle(x3, y3, r * 0.11, 'F');

  // Subtle brand wordmark beneath watermark emblem
  doc.setTextColor(11, 60, 93);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('WAAMIKAN', cx, cy + r * 1.48, { align: 'center' });
  doc.setTextColor(31, 122, 140);
  doc.setFontSize(8.5);
  doc.text('SUPPLY & IMAGING', cx, cy + r * 1.68, { align: 'center' });

  doc.restoreGraphicsState();
};

const drawCompanyHeader = (doc: jsPDF, fillColor: [number, number, number], rightBadgeText?: string, badgeColor?: [number, number, number]) => {
  drawPageWatermarkPDF(doc);

  doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
  doc.rect(0, 0, 210, 52, 'F');

  drawWaamikanLogoPDF(doc, 26, 26, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 43, 20);

  // Brand gold accent bar + Supply & Imaging subtitle
  doc.setFillColor(234, 179, 8);
  doc.roundedRect(43, 22.8, 14, 1.5, 0.7, 0.7, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(186, 230, 253);
  doc.text('SUPPLY & IMAGING', 60, 24.3);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.tagline, 43, 31);
  doc.text(COMPANY_INFO.address, 43, 36.5);

  let contactX = 43;
  const contactY = 42;
  doc.setFontSize(8.5);

  const telLabel = 'Tel: ';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(250, 204, 21);
  doc.text(telLabel, contactX, contactY);
  contactX += doc.getTextWidth(telLabel);

  const phonesPart = `${COMPANY_INFO.phonesDisplay} | `;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(phonesPart, contactX, contactY);
  contactX += doc.getTextWidth(phonesPart);

  const emailLabel = 'Email: ';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(250, 204, 21);
  doc.text(emailLabel, contactX, contactY);
  contactX += doc.getTextWidth(emailLabel);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY_INFO.email, contactX, contactY);

  if (rightBadgeText) {
    const label = rightBadgeText.toUpperCase();
    const [r, g, b] = badgeColor || [234, 179, 8];
    doc.setFillColor(r, g, b);
    doc.roundedRect(148, 12, 46, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(label.length > 13 ? 8 : 9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(label, 171, 19.5, { align: 'center' });
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
  const isOverdue = invoice.status === 'overdue';
  const headerBadgeText = isOverdue ? 'OFFICIAL INVOICE' : invoice.status.toUpperCase();
  const headerBadgeColor: [number, number, number] = isPaid
    ? [22, 163, 74]
    : isOverdue
    ? [31, 122, 140]
    : invoice.status === 'partial'
    ? [217, 119, 6]
    : [31, 122, 140];

  drawCompanyHeader(doc, [11, 60, 93], headerBadgeText, headerBadgeColor);

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
    if (y > 236) {
      doc.addPage();
      drawPageWatermarkPDF(doc);
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
  if (y > 218) {
    doc.addPage();
    drawPageWatermarkPDF(doc);
    y = 24;
  }
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

  // Overdue Card placed cleanly at the bottom of the invoice right above the footer
  if (isOverdue) {
    if (y > 236) {
      doc.addPage();
      drawPageWatermarkPDF(doc);
    }
    const cardY = 244;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.roundedRect(16, cardY, 178, 17, 2.5, 2.5, 'FD');

    doc.setFillColor(220, 38, 38);
    doc.roundedRect(20, cardY + 3.5, 34, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('OVERDUE', 37, cardY + 10, { align: 'center' });

    doc.setTextColor(153, 27, 27);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT OVERDUE — SETTLEMENT REQUIRED', 59, cardY + 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const outstanding = invoice.remainingBalance ?? invoice.total ?? 0;
    doc.text(
      `Due Date: ${safeFormatDate(invoice.dueDate, 'PPP')}   |   Outstanding Balance: GHC ${outstanding.toLocaleString()}`,
      59,
      cardY + 13.5
    );
    doc.setLineWidth(0.2);
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
      drawPageWatermarkPDF(doc);
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
      drawPageWatermarkPDF(doc);
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
