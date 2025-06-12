import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Document, DocumentAnalysis } from '@shared/schema';
import logoImage from '@assets/ChatGPT Image Jun 9, 2025, 07_07_26 AM_1749598570251.png';

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
  private leftMargin: number = 25;
  private rightMargin: number = 25;
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

  private async addLogo(): Promise<void> {
    // Add company logo
    try {
      // Convert image to proper format for jsPDF
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            // Create canvas to convert image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');
            
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw image to canvas with white background (for transparency)
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            
            // Convert to base64 JPEG
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            
            // Add to PDF
            this.doc.addImage(dataUrl, 'JPEG', this.leftMargin, this.currentY, 16, 16);
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = logoImage;
      });
      
    } catch (error) {
      // Fallback to styled text logo
      this.doc.setFillColor(37, 99, 235);
      this.doc.roundedRect(this.leftMargin, this.currentY, 16, 16, 2, 2, 'F');
      
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('C', this.leftMargin + 8, this.currentY + 11, { align: 'center' });
    }
    
    this.currentY += 20;
  }

  private addHeader(document: Document): void {
    // Clean header design
    this.doc.setTextColor(37, 99, 235);
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('ReadMyFinePrint', this.leftMargin + 25, this.currentY + 8);
    
    this.doc.setTextColor(100, 116, 139);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Document Analysis Report', this.leftMargin + 25, this.currentY + 20);
    
    // Generation date
    this.doc.setTextColor(148, 163, 184);
    this.doc.setFontSize(10);
    this.doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    })}`, this.pageWidth - this.rightMargin, this.currentY + 8, { align: 'right' });
    
    this.currentY += 40;

    // Clean separator line
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(1);
    this.doc.line(this.leftMargin, this.currentY, this.pageWidth - this.rightMargin, this.currentY);
    
    this.currentY += 25;

    // Document title section
    this.doc.setTextColor(15, 23, 42);
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(document.title, this.leftMargin, this.currentY);
    this.currentY += 15;
    
    this.doc.setTextColor(100, 116, 139);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    const wordCount = document.content.split(' ').length;
    const fileType = document.fileType ? document.fileType.toUpperCase() : 'TEXT';
    this.doc.text(`${wordCount.toLocaleString()} words • ${fileType} document`, this.leftMargin, this.currentY);
    
    this.currentY += 30;
  }

  private addOverallRisk(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(40);
    
    // Section title
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(15, 23, 42);
    this.doc.text('Risk Assessment', this.leftMargin, this.currentY);
    this.currentY += 20;
    
    // Risk level badge
    const riskConfig = {
      low: { color: [34, 197, 94], text: 'LOW RISK' },
      moderate: { color: [251, 191, 36], text: 'MODERATE RISK' },
      high: { color: [239, 68, 68], text: 'HIGH RISK' }
    };
    
    const config = riskConfig[analysis.overallRisk] || riskConfig.moderate;
    
    // Simple colored badge
    this.doc.setFillColor(config.color[0], config.color[1], config.color[2]);
    this.doc.roundedRect(this.leftMargin, this.currentY, 100, 16, 4, 4, 'F');
    
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.text, this.leftMargin + 50, this.currentY + 11, { align: 'center' });
    
    this.currentY += 35;
  }

  private addSummary(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(60);
    
    // Section title
    this.doc.setTextColor(15, 23, 42);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Executive Summary', this.leftMargin, this.currentY);
    this.currentY += 20;
    
    // Summary content
    this.doc.setTextColor(71, 85, 105);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    const summaryLines = this.doc.splitTextToSize(analysis.summary, this.contentWidth - 5);
    this.doc.text(summaryLines, this.leftMargin, this.currentY);
    this.currentY += summaryLines.length * 6 + 25;
  }

  private addKeyFindings(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(80);
    
    // Section title
    this.doc.setTextColor(15, 23, 42);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Key Findings', this.leftMargin, this.currentY);
    this.currentY += 25;
    
    // Good Terms Section
    if (analysis.keyFindings.goodTerms.length > 0) {
      this.doc.setTextColor(34, 197, 94);
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('✓ Positive Terms', this.leftMargin, this.currentY);
      this.currentY += 15;
      
      this.doc.setTextColor(71, 85, 105);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      
      analysis.keyFindings.goodTerms.forEach(term => {
        this.addNewPageIfNeeded(12);
        const termLines = this.doc.splitTextToSize(`• ${term}`, this.contentWidth - 15);
        this.doc.text(termLines, this.leftMargin + 8, this.currentY);
        this.currentY += termLines.length * 6 + 2;
      });
      this.currentY += 15;
    }
    
    // Review Needed Section
    if (analysis.keyFindings.reviewNeeded.length > 0) {
      this.addNewPageIfNeeded(20);
      this.doc.setTextColor(251, 191, 36);
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('⚠ Requires Review', this.leftMargin, this.currentY);
      this.currentY += 15;
      
      this.doc.setTextColor(71, 85, 105);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      
      analysis.keyFindings.reviewNeeded.forEach(term => {
        this.addNewPageIfNeeded(12);
        const termLines = this.doc.splitTextToSize(`• ${term}`, this.contentWidth - 15);
        this.doc.text(termLines, this.leftMargin + 8, this.currentY);
        this.currentY += termLines.length * 6 + 2;
      });
      this.currentY += 15;
    }
    
    // Red Flags Section
    if (analysis.keyFindings.redFlags.length > 0) {
      this.addNewPageIfNeeded(20);
      this.doc.setTextColor(239, 68, 68);
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('⚠ Red Flags', this.leftMargin, this.currentY);
      this.currentY += 15;
      
      this.doc.setTextColor(71, 85, 105);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      
      analysis.keyFindings.redFlags.forEach(term => {
        this.addNewPageIfNeeded(12);
        const termLines = this.doc.splitTextToSize(`• ${term}`, this.contentWidth - 15);
        this.doc.text(termLines, this.leftMargin + 8, this.currentY);
        this.currentY += termLines.length * 6 + 2;
      });
      this.currentY += 20;
    }
  }

  private addDetailedSections(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(30);
    
    // Section title
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(15, 23, 42);
    this.doc.text('Detailed Analysis', this.leftMargin, this.currentY);
    this.currentY += 25;
    
    analysis.sections.forEach((section, index) => {
      this.addNewPageIfNeeded(40);
      
      // Section number and title
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(15, 23, 42);
      this.doc.text(`${index + 1}. ${section.title}`, this.leftMargin, this.currentY);
      this.currentY += 18;
      
      // Risk level indicator
      const riskConfig = {
        low: { color: [34, 197, 94], text: 'LOW' },
        moderate: { color: [251, 191, 36], text: 'MODERATE' },
        high: { color: [239, 68, 68], text: 'HIGH' }
      };
      
      const config = riskConfig[section.riskLevel] || riskConfig.moderate;
      this.doc.setFillColor(config.color[0], config.color[1], config.color[2]);
      this.doc.roundedRect(this.leftMargin, this.currentY, 60, 12, 3, 3, 'F');
      
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9);
      this.doc.text(`${config.text} RISK`, this.leftMargin + 30, this.currentY + 8, { align: 'center' });
      
      this.currentY += 20;
      
      // Section summary
      this.doc.setTextColor(71, 85, 105);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      const summaryLines = this.doc.splitTextToSize(section.summary, this.contentWidth - 5);
      this.doc.text(summaryLines, this.leftMargin, this.currentY);
      this.currentY += summaryLines.length * 6 + 10;
      
      // Concerns if any
      if (section.concerns && section.concerns.length > 0) {
        this.doc.setTextColor(239, 68, 68);
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Concerns:', this.leftMargin, this.currentY);
        this.currentY += 12;
        
        this.doc.setTextColor(71, 85, 105);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'normal');
        
        section.concerns.forEach(concern => {
          this.addNewPageIfNeeded(15);
          const concernLines = this.doc.splitTextToSize(`• ${concern}`, this.contentWidth - 15);
          this.doc.text(concernLines, this.leftMargin + 8, this.currentY);
          this.currentY += concernLines.length * 6 + 3;
        });
      }
      
      this.currentY += 20;
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
      
      // Simple footer line
      this.doc.setDrawColor(226, 232, 240);
      this.doc.setLineWidth(0.5);
      this.doc.line(this.leftMargin, this.pageHeight - 20, this.pageWidth - this.rightMargin, this.pageHeight - 20);
      
      // Company branding
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Generated by ReadMyFinePrint', this.leftMargin, this.pageHeight - 10);
      
      // Page number
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.rightMargin, this.pageHeight - 10, { align: 'right' });
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
        await this.addLogo();
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
      console.error('PDF export failed at step:', error);
      console.error('Error details:', error);
      throw new Error(`Failed to generate PDF export: ${error instanceof Error ? error.message : 'Unknown error'}`);
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