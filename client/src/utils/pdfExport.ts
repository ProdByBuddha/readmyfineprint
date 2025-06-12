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

  private async addLogo(): Promise<void> {
    // Add company logo
    try {
      console.log('Attempting to load logo image:', logoImage);
      
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
            console.log('Logo image loaded successfully');
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = logoImage;
      });
      
    } catch (error) {
      console.error('Logo image loading failed:', error);
      // Fallback to styled text logo
      this.doc.setFillColor(37, 99, 235);
      this.doc.roundedRect(this.leftMargin, this.currentY, 16, 16, 2, 2, 'F');
      
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('C', this.leftMargin + 8, this.currentY + 11, { align: 'center' });
      console.log('Using styled text fallback for logo');
    }
    
    this.currentY += 20;
  }

  private addHeader(document: Document): void {
    // Modern header with subtle background
    this.doc.setFillColor(248, 250, 252);
    this.doc.rect(0, 0, this.pageWidth, 50, 'F');
    
    // Company branding with modern styling
    this.doc.setTextColor(37, 99, 235);
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('ReadMyFinePrint', this.leftMargin + 25, this.currentY + 12);
    
    this.doc.setTextColor(100, 116, 139);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Legal Document Analysis', this.leftMargin + 25, this.currentY + 22);
    
    // Add generation date in top right
    this.doc.setTextColor(148, 163, 184);
    this.doc.setFontSize(9);
    this.doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, this.pageWidth - this.rightMargin, this.currentY + 12, { align: 'right' });
    
    this.currentY = 65;

    // Document title section with modern card styling
    this.doc.setFillColor(255, 255, 255);
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, 40, 6, 6, 'FD');
    
    this.doc.setTextColor(15, 23, 42);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(document.title, this.leftMargin + 16, this.currentY + 16);
    
    this.doc.setTextColor(71, 85, 105);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    const wordCount = document.content.split(' ').length;
    const fileType = document.fileType ? document.fileType.toUpperCase() : 'TEXT';
    this.doc.text(`${wordCount.toLocaleString()} words • ${fileType} document`, 
                  this.leftMargin + 16, this.currentY + 30);
    
    this.currentY += 55;
  }

  private addOverallRisk(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(60);
    
    // Section card background
    this.doc.setFillColor(255, 255, 255);
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, 55, 6, 6, 'FD');
    
    // Section title
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(15, 23, 42);
    this.doc.text('Risk Assessment', this.leftMargin + 16, this.currentY + 18);
    
    // Risk level badge with modern styling
    const riskConfig = {
      low: { color: [34, 197, 94], bg: [240, 253, 244], text: 'LOW RISK' },
      moderate: { color: [251, 191, 36], bg: [255, 251, 235], text: 'MODERATE RISK' },
      high: { color: [239, 68, 68], bg: [254, 242, 242], text: 'HIGH RISK' }
    };
    
    const config = riskConfig[analysis.overallRisk] || riskConfig.moderate;
    
    // Risk badge background
    this.doc.setFillColor(config.bg[0], config.bg[1], config.bg[2]);
    this.doc.setDrawColor(config.color[0], config.color[1], config.color[2]);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(this.leftMargin + 16, this.currentY + 25, 85, 18, 4, 4, 'FD');
    
    // Risk badge text
    this.doc.setTextColor(config.color[0], config.color[1], config.color[2]);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.text, this.leftMargin + 58.5, this.currentY + 37, { align: 'center' });
    
    this.currentY += 70;
  }

  private addSummary(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(80);
    
    // Summary card background
    this.doc.setFillColor(255, 255, 255);
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(1);
    const summaryHeight = Math.max(60, this.doc.splitTextToSize(analysis.summary, this.contentWidth - 32).length * 5 + 40);
    this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, summaryHeight, 6, 6, 'FD');
    
    // Section title
    this.doc.setTextColor(15, 23, 42);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Executive Summary', this.leftMargin + 16, this.currentY + 18);
    
    // Summary content
    this.doc.setTextColor(71, 85, 105);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    const summaryLines = this.doc.splitTextToSize(analysis.summary, this.contentWidth - 32);
    this.doc.text(summaryLines, this.leftMargin + 16, this.currentY + 35);
    
    this.currentY += summaryHeight + 15;
  }

  private addKeyFindings(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(120);
    
    // Calculate total height needed for the card
    const estimatedHeight = 60 + 
      (analysis.keyFindings.goodTerms.length * 7) +
      (analysis.keyFindings.reviewNeeded.length * 7) +
      (analysis.keyFindings.redFlags.length * 7);
    
    // Key findings card background
    this.doc.setFillColor(255, 255, 255);
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, estimatedHeight, 6, 6, 'FD');
    
    // Section title
    this.doc.setTextColor(15, 23, 42);
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Key Findings', this.leftMargin + 16, this.currentY + 18);
    
    let cardY = this.currentY + 35;
    
    // Good Terms Section
    if (analysis.keyFindings.goodTerms.length > 0) {
      // Section header with colored background
      this.doc.setFillColor(240, 253, 244);
      this.doc.setDrawColor(34, 197, 94);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(this.leftMargin + 16, cardY, this.contentWidth - 32, 16, 3, 3, 'FD');
      
      this.doc.setTextColor(34, 197, 94);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('✓ Positive Terms', this.leftMargin + 24, cardY + 11);
      cardY += 22;
      
      // Terms list
      this.doc.setTextColor(71, 85, 105);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      analysis.keyFindings.goodTerms.forEach(term => {
        this.doc.text(`• ${term}`, this.leftMargin + 24, cardY);
        cardY += 7;
      });
      cardY += 8;
    }
    
    // Review Needed Section
    if (analysis.keyFindings.reviewNeeded.length > 0) {
      this.doc.setFillColor(255, 251, 235);
      this.doc.setDrawColor(251, 191, 36);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(this.leftMargin + 16, cardY, this.contentWidth - 32, 16, 3, 3, 'FD');
      
      this.doc.setTextColor(251, 191, 36);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('⚠ Requires Review', this.leftMargin + 24, cardY + 11);
      cardY += 22;
      
      this.doc.setTextColor(71, 85, 105);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      analysis.keyFindings.reviewNeeded.forEach(term => {
        this.doc.text(`• ${term}`, this.leftMargin + 24, cardY);
        cardY += 7;
      });
      cardY += 8;
    }
    
    // Red Flags Section
    if (analysis.keyFindings.redFlags.length > 0) {
      this.doc.setFillColor(254, 242, 242);
      this.doc.setDrawColor(239, 68, 68);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(this.leftMargin + 16, cardY, this.contentWidth - 32, 16, 3, 3, 'FD');
      
      this.doc.setTextColor(239, 68, 68);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('⚠ Red Flags', this.leftMargin + 24, cardY + 11);
      cardY += 22;
      
      this.doc.setTextColor(71, 85, 105);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      analysis.keyFindings.redFlags.forEach(term => {
        this.doc.text(`• ${term}`, this.leftMargin + 24, cardY);
        cardY += 7;
      });
    }
    
    this.currentY += estimatedHeight + 15;
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

    console.log('PDF Export starting with options:', options);

    if (!document.analysis) {
      console.error('Document analysis missing:', document);
      throw new Error('Document analysis is required for PDF export');
    }

    const analysis = document.analysis;
    console.log('Analysis found:', analysis);

    try {
      console.log('Adding logo...');
      // Add logo
      if (includeLogo) {
        await this.addLogo();
      }

      console.log('Adding header...');
      // Add header
      if (includeHeader) {
        this.addHeader(document);
      }

      console.log('Adding overall risk...');
      // Add overall risk assessment
      this.addOverallRisk(analysis);

      console.log('Adding summary...');
      // Add summary
      this.addSummary(analysis);

      console.log('Adding key findings...');
      // Add key findings
      this.addKeyFindings(analysis);

      console.log('Adding detailed sections...');
      // Add detailed sections
      this.addDetailedSections(analysis);

      console.log('Adding QR code...');
      // Add QR code for donations
      if (includeQRCode) {
        await this.addQRCode(donateUrl);
      }

      console.log('Adding footer...');
      // Add footer to all pages
      this.addFooter();

      // Generate filename
      const filename = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-analysis.pdf`;
      console.log('Generated filename:', filename);

      console.log('Saving PDF...');
      // Save the PDF
      this.doc.save(filename);
      console.log('PDF save completed');

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