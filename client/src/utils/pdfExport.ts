import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Document, DocumentAnalysis } from '@shared/schema';

interface PDFExportOptions {
  includeHeader?: boolean;
  includeLogo?: boolean;
  includeQRCode?: boolean;
  donateUrl?: string;
}

export class AnalysisPDFExporter {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageWidth: number;
  private pageHeight: number;
  private leftMargin: number = 20;
  private rightMargin: number = 20;
  private contentWidth: number;

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - this.leftMargin - this.rightMargin;
  }

  private addNewPageIfNeeded(requiredHeight: number = 20): void {
    if (this.currentY + requiredHeight > this.pageHeight - 20) {
      this.doc.addPage();
      this.currentY = 20;
    }
  }

  private addLogo(): void {
    // Add logo as a blue circle with initials for now (simplified)
    this.doc.setFillColor(37, 99, 235); // Blue color
    this.doc.circle(this.leftMargin + 10, this.currentY + 5, 8, 'F');
    
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('RMFP', this.leftMargin + 10, this.currentY + 7, { align: 'center' });
    
    this.currentY += 20;
  }

  private addHeader(document: Document): void {
    // Company branding
    this.doc.setTextColor(37, 99, 235);
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('ReadMyFinePrint', this.leftMargin + 25, this.currentY);
    
    this.doc.setTextColor(100, 100, 100);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Document Analysis Report', this.leftMargin + 25, this.currentY + 6);
    
    this.currentY += 20;
    
    // Document info section
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Analysis Report', this.leftMargin, this.currentY);
    
    this.currentY += 12;
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Document: ${document.title}`, this.leftMargin, this.currentY);
    this.currentY += 6;
    
    this.doc.text(`Generated: ${new Date().toLocaleString()}`, this.leftMargin, this.currentY);
    this.currentY += 6;
    
    this.doc.text(`Word Count: ${document.content.split(' ').length} words`, this.leftMargin, this.currentY);
    this.currentY += 15;
    
    // Add divider line
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.leftMargin, this.currentY, this.pageWidth - this.rightMargin, this.currentY);
    this.currentY += 10;
  }

  private addOverallRisk(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(40);
    
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Overall Risk Assessment', this.leftMargin, this.currentY);
    this.currentY += 12;
    
    // Risk level with color coding
    const riskColors = {
      low: [34, 197, 94],     // Green
      moderate: [251, 191, 36], // Yellow
      high: [239, 68, 68]      // Red
    };
    
    const color = riskColors[analysis.overallRisk] || [100, 100, 100];
    this.doc.setFillColor(color[0], color[1], color[2]);
    this.doc.roundedRect(this.leftMargin, this.currentY - 2, 60, 12, 3, 3, 'F');
    
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(12);
    this.doc.text(analysis.overallRisk.toUpperCase() + ' RISK', this.leftMargin + 30, this.currentY + 6, { align: 'center' });
    
    this.currentY += 20;
  }

  private addSummary(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(30);
    
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Executive Summary', this.leftMargin, this.currentY);
    this.currentY += 10;
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const summaryLines = this.doc.splitTextToSize(analysis.summary, this.contentWidth);
    this.doc.text(summaryLines, this.leftMargin, this.currentY);
    this.currentY += summaryLines.length * 5 + 10;
  }

  private addKeyFindings(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(60);
    
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Key Findings', this.leftMargin, this.currentY);
    this.currentY += 15;
    
    // Good Terms
    if (analysis.keyFindings.goodTerms.length > 0) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(34, 197, 94);
      this.doc.text('✓ Positive Terms', this.leftMargin, this.currentY);
      this.currentY += 8;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0);
      
      analysis.keyFindings.goodTerms.forEach(term => {
        this.addNewPageIfNeeded(8);
        const termLines = this.doc.splitTextToSize(`• ${term}`, this.contentWidth - 10);
        this.doc.text(termLines, this.leftMargin + 5, this.currentY);
        this.currentY += termLines.length * 5;
      });
      this.currentY += 5;
    }
    
    // Review Needed
    if (analysis.keyFindings.reviewNeeded.length > 0) {
      this.addNewPageIfNeeded(15);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(251, 191, 36);
      this.doc.text('⚠ Requires Review', this.leftMargin, this.currentY);
      this.currentY += 8;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0);
      
      analysis.keyFindings.reviewNeeded.forEach(term => {
        this.addNewPageIfNeeded(8);
        const termLines = this.doc.splitTextToSize(`• ${term}`, this.contentWidth - 10);
        this.doc.text(termLines, this.leftMargin + 5, this.currentY);
        this.currentY += termLines.length * 5;
      });
      this.currentY += 5;
    }
    
    // Red Flags
    if (analysis.keyFindings.redFlags.length > 0) {
      this.addNewPageIfNeeded(15);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(239, 68, 68);
      this.doc.text('⚠ Red Flags', this.leftMargin, this.currentY);
      this.currentY += 8;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0);
      
      analysis.keyFindings.redFlags.forEach(term => {
        this.addNewPageIfNeeded(8);
        const termLines = this.doc.splitTextToSize(`• ${term}`, this.contentWidth - 10);
        this.doc.text(termLines, this.leftMargin + 5, this.currentY);
        this.currentY += termLines.length * 5;
      });
      this.currentY += 10;
    }
  }

  private addDetailedSections(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(30);
    
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Detailed Analysis', this.leftMargin, this.currentY);
    this.currentY += 15;
    
    analysis.sections.forEach((section, index) => {
      this.addNewPageIfNeeded(25);
      
      // Section title with risk indicator
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(0, 0, 0);
      this.doc.text(`${index + 1}. ${section.title}`, this.leftMargin, this.currentY);
      
      // Risk level badge
      const riskColors = {
        low: [34, 197, 94],
        moderate: [251, 191, 36],
        high: [239, 68, 68]
      };
      
      const color = riskColors[section.riskLevel] || [100, 100, 100];
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.roundedRect(this.pageWidth - this.rightMargin - 35, this.currentY - 5, 30, 8, 2, 2, 'F');
      
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8);
      this.doc.text(section.riskLevel.toUpperCase(), this.pageWidth - this.rightMargin - 20, this.currentY - 1, { align: 'center' });
      
      this.currentY += 10;
      
      // Section summary
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      const summaryLines = this.doc.splitTextToSize(section.summary, this.contentWidth);
      this.doc.text(summaryLines, this.leftMargin, this.currentY);
      this.currentY += summaryLines.length * 5 + 5;
      
      // Concerns if any
      if (section.concerns && section.concerns.length > 0) {
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Concerns:', this.leftMargin, this.currentY);
        this.currentY += 6;
        
        this.doc.setFont('helvetica', 'normal');
        section.concerns.forEach(concern => {
          this.addNewPageIfNeeded(8);
          const concernLines = this.doc.splitTextToSize(`• ${concern}`, this.contentWidth - 10);
          this.doc.text(concernLines, this.leftMargin + 5, this.currentY);
          this.currentY += concernLines.length * 5;
        });
      }
      
      this.currentY += 10;
    });
  }

  private async addQRCode(donateUrl: string): Promise<void> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(donateUrl, {
        width: 80,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      this.addNewPageIfNeeded(100);
      
      // Add donation section
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(37, 99, 235);
      this.doc.text('Support Our Mission', this.leftMargin, this.currentY);
      this.currentY += 10;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0);
      this.doc.text('Help us continue providing free document analysis tools.', this.leftMargin, this.currentY);
      this.currentY += 6;
      this.doc.text('Scan the QR code below to make a donation:', this.leftMargin, this.currentY);
      this.currentY += 15;
      
      // Add QR code
      this.doc.addImage(qrCodeDataUrl, 'PNG', this.leftMargin, this.currentY, 25, 25);
      
      // Add URL text next to QR code
      this.doc.setFontSize(8);
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(donateUrl, this.leftMargin + 30, this.currentY + 10);
      
      this.currentY += 35;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      // Add text-only donation info as fallback
      this.addNewPageIfNeeded(30);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(37, 99, 235);
      this.doc.text('Support Our Mission', this.leftMargin, this.currentY);
      this.currentY += 10;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0);
      this.doc.text('Help us continue providing free document analysis tools.', this.leftMargin, this.currentY);
      this.currentY += 6;
      this.doc.text(`Visit: ${donateUrl}`, this.leftMargin, this.currentY);
      this.currentY += 20;
    }
  }

  private addFooter(): void {
    const pageCount = (this.doc as any).internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Footer line
      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(this.leftMargin, this.pageHeight - 15, this.pageWidth - this.rightMargin, this.pageHeight - 15);
      
      // Footer text
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 100, 100);
      this.doc.text('Generated by ReadMyFinePrint', this.leftMargin, this.pageHeight - 8);
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.rightMargin, this.pageHeight - 8, { align: 'right' });
    }
  }

  async exportToPDF(
    document: Document, 
    options: PDFExportOptions = {}
  ): Promise<void> {
    const {
      includeHeader = true,
      includeLogo = true,
      includeQRCode = true,
      donateUrl = window.location.origin + '/donate'
    } = options;

    if (!document.analysis) {
      throw new Error('Document analysis is required for PDF export');
    }

    const analysis = document.analysis;

    try {
      // Add logo
      if (includeLogo) {
        this.addLogo();
      }

      // Add header
      if (includeHeader) {
        this.addHeader(document);
      }

      // Add overall risk assessment
      this.addOverallRisk(analysis);

      // Add summary
      this.addSummary(analysis);

      // Add key findings
      this.addKeyFindings(analysis);

      // Add detailed sections
      this.addDetailedSections(analysis);

      // Add QR code for donations
      if (includeQRCode) {
        await this.addQRCode(donateUrl);
      }

      // Add footer to all pages
      this.addFooter();

      // Generate filename
      const filename = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-analysis.pdf`;

      // Save the PDF
      this.doc.save(filename);

    } catch (error) {
      console.error('PDF export failed:', error);
      throw new Error('Failed to generate PDF export');
    }
  }
}

export async function exportAnalysisToPDF(
  document: Document,
  options?: PDFExportOptions
): Promise<void> {
  const exporter = new AnalysisPDFExporter();
  await exporter.exportToPDF(document, options);
}