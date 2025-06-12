import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Document, DocumentAnalysis } from '@shared/schema';
import logoImage from '@assets/ChatGPT Image Jun 9, 2025, 07_07_26 AM_1749598570251.png';

interface PDFExportOptions {
  includeHeader?: boolean;
  includeLogo?: boolean;
  includeQRCode?: boolean;
  donateUrl?: string;
  highQuality?: boolean;
}

export class AnalysisPDFExporter {
  private doc: jsPDF;
  private currentY: number = 0.75;
  private pageWidth: number;
  private pageHeight: number;
  private leftMargin: number = 0.75;
  private rightMargin: number = 0.75;
  private contentWidth: number;
  private lineHeight: number = 0.18;
  private paragraphSpacing: number = 0.12;
  private highQuality: boolean = true;

  constructor(options: { highQuality?: boolean } = {}) {
    // Use US Letter format (8.5" x 11") with higher quality settings
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'in', // Use inches for US Letter format
      format: 'letter', // 8.5" x 11" US Letter format
      compress: !options.highQuality,
      precision: options.highQuality ? 3 : 2
    });
    
    this.highQuality = options.highQuality ?? true;
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    
    // Adjust margins for US Letter format (in inches)
    this.leftMargin = 0.75; // 0.75 inches left margin
    this.rightMargin = 0.75; // 0.75 inches right margin
    this.contentWidth = this.pageWidth - this.leftMargin - this.rightMargin;
    
    // Set PDF metadata for better quality
    this.doc.setProperties({
      title: 'Document Analysis Report',
      subject: 'Legal Document Analysis by ReadMyFinePrint',
      author: 'ReadMyFinePrint',
      creator: 'ReadMyFinePrint Analysis Tool',
      producer: 'jsPDF with Enhanced Quality Settings'
    });
  }

  private addNewPageIfNeeded(requiredHeight: number = 0.4): void {
    if (this.currentY + requiredHeight > this.pageHeight - 0.6) { // Increased bottom margin
      this.doc.addPage();
      this.currentY = 0.75; // 0.75 inch top margin
    }
  }

  private async addLogo(): Promise<void> {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');
            
            // Higher resolution canvas for better quality
            const scaleFactor = this.highQuality ? 3 : 2;
            canvas.width = img.width * scaleFactor;
            canvas.height = img.height * scaleFactor;
            
            // High-quality image rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // White background with slight shadow effect
            ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add subtle shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
            ctx.shadowBlur = 3 * scaleFactor;
            ctx.shadowOffsetX = 1 * scaleFactor;
            ctx.shadowOffsetY = 1 * scaleFactor;
            
            ctx.scale(scaleFactor, scaleFactor);
            ctx.drawImage(img, 0, 0);
            
            // Convert to high-quality JPEG
            const dataUrl = canvas.toDataURL('image/jpeg', this.highQuality ? 0.95 : 0.85);
            
            // Add to PDF with proper sizing and positioning (inches)
            const logoSize = 0.45; // Reduced from 0.6 to 0.45 inches
            this.doc.addImage(dataUrl, 'JPEG', this.leftMargin, this.currentY, logoSize, logoSize);
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = logoImage;
      });
      
    } catch (error) {
      // Enhanced fallback logo with gradient effect (inches)
      const gradient = this.doc.internal.pages[1];
      
      // Create a rounded rectangle with gradient-like effect (inches)
      const logoSize = 0.45; // Consistent size with image logo
      this.doc.setFillColor(59, 130, 246); // Blue-600
      this.doc.roundedRect(this.leftMargin, this.currentY, logoSize, logoSize, 0.04, 0.04, 'F');
      
      // Add inner highlight for depth
      this.doc.setFillColor(99, 150, 255); // Lighter blue
      this.doc.roundedRect(this.leftMargin + 0.02, this.currentY + 0.02, logoSize - 0.04, logoSize * 0.5, 0.02, 0.02, 'F');
      
      // Enhanced text logo
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('RMFP', this.leftMargin + logoSize/2, this.currentY + logoSize/2 + 0.05, { align: 'center' });
    }
    
    this.currentY += 0.55; // Reduced spacing after logo
  }

  private addHeader(document: Document): void {
    // Enhanced header with better typography
    this.doc.setTextColor(30, 58, 138); // Blue-900
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    // Position header text to align with logo
    this.doc.text('ReadMyFinePrint', this.leftMargin + 0.55, this.currentY - 0.25);
    
    // Subtitle with improved spacing
    this.doc.setTextColor(71, 85, 105); // Slate-600
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Professional Document Analysis Report', this.leftMargin + 0.55, this.currentY - 0.05);
    
    // Generation date with better formatting
    this.doc.setTextColor(100, 116, 139); // Slate-500
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const formattedDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.doc.text(`Generated: ${formattedDate}`, this.pageWidth - this.rightMargin, this.currentY - 0.25, { align: 'right' });
    
    this.currentY += 0.5; // Increased spacing after header

    // Enhanced separator with gradient effect
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(0.01);
    this.doc.line(this.leftMargin, this.currentY, this.pageWidth - this.rightMargin, this.currentY);
    
    // Add second thinner line for depth
    this.doc.setDrawColor(241, 245, 249);
    this.doc.setLineWidth(0.005);
    this.doc.line(this.leftMargin, this.currentY + 0.02, this.pageWidth - this.rightMargin, this.currentY + 0.02);
    
    this.currentY += 0.35; // Better spacing after separator

    // Document title section with enhanced layout
    this.doc.setTextColor(15, 23, 42); // Slate-900
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    
    // Word wrap title if too long
    const titleLines = this.doc.splitTextToSize(document.title, this.contentWidth - 0.2);
    this.doc.text(titleLines, this.leftMargin, this.currentY);
    this.currentY += titleLines.length * 0.25 + 0.2; // Better line spacing for title
    
    // Enhanced document metadata
    this.doc.setTextColor(71, 85, 105);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    const wordCount = document.content.split(' ').length;
    const fileType = document.fileType ? document.fileType.toUpperCase() : 'TEXT';
    const analysisDate = new Date().toLocaleDateString();
    this.doc.text(`${wordCount.toLocaleString()} words • ${fileType} document • Analyzed on ${analysisDate}`, this.leftMargin, this.currentY);
    
    this.currentY += 0.5; // Increased spacing after metadata
  }

  private addOverallRisk(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(1.0);
    
    // Enhanced section title with text icon
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(15, 23, 42);
    this.doc.text('RISK ASSESSMENT', this.leftMargin, this.currentY);
    this.currentY += 0.5; // Increased spacing after section title
    
    // Enhanced risk level display
    const riskConfig = {
      low: { 
        color: [34, 197, 94], 
        bgColor: [240, 253, 244],
        text: 'LOW RISK',
        symbol: 'SAFE'
      },
      moderate: { 
        color: [245, 158, 11], 
        bgColor: [255, 251, 235],
        text: 'MODERATE RISK',
        symbol: 'CAUTION'
      },
      high: { 
        color: [239, 68, 68], 
        bgColor: [254, 242, 242],
        text: 'HIGH RISK',
        symbol: 'WARNING'
      }
    };
    
    const config = riskConfig[analysis.overallRisk] || riskConfig.moderate;
    
    // Background box with shadow effect
    this.doc.setFillColor(config.bgColor[0], config.bgColor[1], config.bgColor[2]);
    this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, 0.7, 0.05, 0.05, 'F');
    
    // Main risk badge
    this.doc.setFillColor(config.color[0], config.color[1], config.color[2]);
    this.doc.roundedRect(this.leftMargin + 0.15, this.currentY + 0.15, 2.5, 0.4, 0.05, 0.05, 'F');
    
    // Risk text with symbol
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`[${config.symbol}] ${config.text}`, this.leftMargin + 1.4, this.currentY + 0.38, { align: 'center' });
    
    // Risk description
    this.doc.setTextColor(config.color[0], config.color[1], config.color[2]);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const riskDescription = this.getRiskDescription(analysis.overallRisk);
    const descLines = this.doc.splitTextToSize(riskDescription, this.contentWidth - 3.0);
    this.doc.text(descLines, this.leftMargin + 2.8, this.currentY + 0.3);
    
    this.currentY += 0.9; // Better spacing after risk section
  }

  private getRiskDescription(risk: string): string {
    switch (risk) {
      case 'low':
        return 'Document appears to have standard, fair terms with minimal concerns.';
      case 'moderate':
        return 'Some terms require attention. Review recommended before proceeding.';
      case 'high':
        return 'Significant concerns identified. Careful review strongly advised.';
      default:
        return 'Risk level assessment completed.';
    }
  }

  private addSummary(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(1.5);
    
    // Enhanced section title
    this.doc.setTextColor(15, 23, 42);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('EXECUTIVE SUMMARY', this.leftMargin, this.currentY);
    this.currentY += 0.5; // Consistent section title spacing
    
    // Summary content with improved typography
    this.doc.setTextColor(51, 65, 85); // Slate-700
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    
    const summaryLines = this.doc.splitTextToSize(analysis.summary, this.contentWidth - 0.3);
    const summaryHeight = summaryLines.length * this.lineHeight + 0.4;
    
    // Draw background box with correct height
    this.doc.setFillColor(248, 250, 252);
    this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, summaryHeight, 0.05, 0.05, 'F');
    
    // Add summary text with proper padding and line spacing
    let textY = this.currentY + 0.2;
    summaryLines.forEach((line, index) => {
      this.doc.text(line, this.leftMargin + 0.15, textY);
      textY += this.lineHeight;
    });
    
    this.currentY += summaryHeight + 0.5; // Better spacing after summary
  }

  private addKeyFindings(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(2.0);
    
    // Enhanced section title
    this.doc.setTextColor(15, 23, 42);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('KEY FINDINGS', this.leftMargin, this.currentY);
    this.currentY += 0.6; // Better spacing after section title
    
    // Good Terms Section
    if (analysis.keyFindings.goodTerms.length > 0) {
      this.addFindingsSection('[+] Positive Terms', analysis.keyFindings.goodTerms, [34, 197, 94], [240, 253, 244]);
    }
    
    // Review Needed Section
    if (analysis.keyFindings.reviewNeeded.length > 0) {
      this.addFindingsSection('[!] Requires Review', analysis.keyFindings.reviewNeeded, [245, 158, 11], [255, 251, 235]);
    }
    
    // Red Flags Section
    if (analysis.keyFindings.redFlags.length > 0) {
      this.addFindingsSection('[X] Red Flags', analysis.keyFindings.redFlags, [239, 68, 68], [254, 242, 242]);
    }
  }

  private addFindingsSection(title: string, items: string[], textColor: number[], bgColor: number[]): void {
    this.addNewPageIfNeeded(0.8);
    
    // Section header with background
    this.doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, 0.35, 0.03, 0.03, 'F');
    
    this.doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.leftMargin + 0.15, this.currentY + 0.23);
    this.currentY += 0.5; // Better spacing after subsection title
    
    // Items with improved formatting and spacing
    this.doc.setTextColor(51, 65, 85);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    
    items.forEach((item, index) => {
      this.addNewPageIfNeeded(0.4);
      
      // Add bullet point with custom styling
      this.doc.setFillColor(textColor[0], textColor[1], textColor[2]);
      this.doc.circle(this.leftMargin + 0.12, this.currentY + 0.08, 0.02, 'F');
      
      const itemLines = this.doc.splitTextToSize(item, this.contentWidth - 0.4);
      let itemY = this.currentY + 0.12;
      itemLines.forEach((line, lineIndex) => {
        this.doc.text(line, this.leftMargin + 0.25, itemY);
        itemY += this.lineHeight;
      });
      
      this.currentY += itemLines.length * this.lineHeight + this.paragraphSpacing;
    });
    
    this.currentY += 0.3; // Spacing between finding sections
  }

  private addDetailedSections(analysis: DocumentAnalysis): void {
    this.addNewPageIfNeeded(0.8);
    
    // Enhanced section title
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(15, 23, 42);
    this.doc.text('DETAILED ANALYSIS', this.leftMargin, this.currentY);
    this.currentY += 0.6; // Better spacing after section title
    
    analysis.sections.forEach((section, index) => {
      const cardHeight = this.calculateSectionHeight(section);
      this.addNewPageIfNeeded(cardHeight + 0.2);
      
      // Section card background
      this.doc.setFillColor(249, 250, 251);
      this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, cardHeight, 0.05, 0.05, 'F');
      
      // Section number and title
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(15, 23, 42);
      const sectionTitle = `${index + 1}. ${section.title}`;
      const titleLines = this.doc.splitTextToSize(sectionTitle, this.contentWidth - 0.3);
      
      let titleY = this.currentY + 0.25;
      titleLines.forEach((line, lineIndex) => {
        this.doc.text(line, this.leftMargin + 0.15, titleY);
        titleY += 0.2; // Proper line spacing for titles
      });
      this.currentY += titleLines.length * 0.2 + 0.2;
      
      // Enhanced risk level indicator
      const riskConfig = {
        low: { color: [34, 197, 94], text: 'LOW', symbol: 'SAFE' },
        moderate: { color: [245, 158, 11], text: 'MODERATE', symbol: 'CAUTION' },
        high: { color: [239, 68, 68], text: 'HIGH', symbol: 'WARNING' }
      };
      
      const config = riskConfig[section.riskLevel] || riskConfig.moderate;
      
      // Risk badge with symbol
      this.doc.setFillColor(config.color[0], config.color[1], config.color[2]);
      this.doc.roundedRect(this.leftMargin + 0.15, this.currentY, 1.8, 0.25, 0.03, 0.03, 'F');
      
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8);
      this.doc.text(`[${config.symbol}] ${config.text} RISK`, this.leftMargin + 1.05, this.currentY + 0.16, { align: 'center' });
      
      this.currentY += 0.4; // Better spacing after risk badge
      
      // Section summary with proper line spacing
      this.doc.setTextColor(51, 65, 85);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      const summaryLines = this.doc.splitTextToSize(section.summary, this.contentWidth - 0.3);
      
      let summaryY = this.currentY;
      summaryLines.forEach((line, lineIndex) => {
        this.doc.text(line, this.leftMargin + 0.15, summaryY);
        summaryY += this.lineHeight;
      });
      this.currentY += summaryLines.length * this.lineHeight + 0.25;
      
      // Concerns with enhanced styling and proper spacing
      if (section.concerns && section.concerns.length > 0) {
        this.doc.setTextColor(220, 38, 38);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('[!] Concerns:', this.leftMargin + 0.15, this.currentY);
        this.currentY += 0.25;
        
        this.doc.setTextColor(51, 65, 85);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        
        section.concerns.forEach(concern => {
          this.addNewPageIfNeeded(0.3);
          
          // Custom bullet point
          this.doc.setFillColor(220, 38, 38);
          this.doc.circle(this.leftMargin + 0.25, this.currentY + 0.08, 0.015, 'F');
          
          const concernLines = this.doc.splitTextToSize(concern, this.contentWidth - 0.5);
          let concernY = this.currentY + 0.1;
          concernLines.forEach((line, lineIndex) => {
            this.doc.text(line, this.leftMargin + 0.35, concernY);
            concernY += this.lineHeight;
          });
          
          this.currentY += concernLines.length * this.lineHeight + this.paragraphSpacing;
        });
      }
      
      this.currentY += 0.5; // Better spacing between sections
    });
  }

  private calculateSectionHeight(section: any): number {
    // More accurate height calculation (in inches)
    const titleHeight = Math.ceil(section.title.length / 45) * 0.2 + 0.2;
    const summaryHeight = Math.ceil(section.summary.length / 70) * this.lineHeight + 0.25;
    const concernsHeight = section.concerns ? 
      (section.concerns.length * 0.3) + (section.concerns.length * this.paragraphSpacing) + 0.4 : 0;
    return titleHeight + summaryHeight + concernsHeight + 0.8;
  }

  private async addQRCode(donateUrl: string): Promise<void> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(donateUrl, {
        width: this.highQuality ? 120 : 80,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });
      
      this.addNewPageIfNeeded(1.8);
      
      // Enhanced donation section
      this.doc.setFillColor(239, 246, 255); // Blue-50
      this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, 1.5, 0.1, 0.1, 'F');
      
      // Section title
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(29, 78, 216); // Blue-700
      this.doc.text('SUPPORT OUR MISSION', this.leftMargin + 0.15, this.currentY + 0.25);
      
      // Description text
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(51, 65, 85);
      this.doc.text('Help us keep legal document analysis free and accessible for everyone.', this.leftMargin + 0.15, this.currentY + 0.45);
      this.doc.text('Scan the QR code or visit the link below to make a donation:', this.leftMargin + 0.15, this.currentY + 0.65);
      
      // QR code with better positioning
      const qrSize = this.highQuality ? 0.8 : 0.6;
      this.doc.addImage(qrCodeDataUrl, 'PNG', this.leftMargin + 0.15, this.currentY + 0.8, qrSize, qrSize);
      
      // URL text with better formatting
      this.doc.setFontSize(8);
      this.doc.setTextColor(75, 85, 99);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(donateUrl, this.leftMargin + 1.0, this.currentY + 1.2);
      
      this.currentY += 1.7;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      // Enhanced fallback section
      this.addNewPageIfNeeded(0.8);
      
      this.doc.setFillColor(239, 246, 255);
      this.doc.roundedRect(this.leftMargin, this.currentY, this.contentWidth, 0.7, 0.1, 0.1, 'F');
      
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(29, 78, 216);
      this.doc.text('SUPPORT OUR MISSION', this.leftMargin + 0.15, this.currentY + 0.25);
      
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(51, 65, 85);
      this.doc.text('Help us continue providing free document analysis tools.', this.leftMargin + 0.15, this.currentY + 0.45);
      this.doc.text(`Visit: ${donateUrl}`, this.leftMargin + 0.15, this.currentY + 0.6);
      
      this.currentY += 0.9;
    }
  }

  private addFooter(): void {
    const pageCount = (this.doc as any).internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Enhanced footer with double line
      this.doc.setDrawColor(203, 213, 225);
      this.doc.setLineWidth(0.005);
      this.doc.line(this.leftMargin, this.pageHeight - 0.5, this.pageWidth - this.rightMargin, this.pageHeight - 0.5);
      
      this.doc.setDrawColor(241, 245, 249);
      this.doc.setLineWidth(0.003);
      this.doc.line(this.leftMargin, this.pageHeight - 0.48, this.pageWidth - this.rightMargin, this.pageHeight - 0.48);
      
      // Company branding with improved typography
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Generated by ReadMyFinePrint • Professional Document Analysis', this.leftMargin, this.pageHeight - 0.35);
      
      // Page number with better styling
      this.doc.setTextColor(148, 163, 184);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.rightMargin, this.pageHeight - 0.35, { align: 'right' });
      
      // Website URL
      this.doc.setTextColor(100, 116, 139);
      this.doc.setFontSize(7);
      this.doc.text('www.readmyfineprint.com', this.pageWidth - this.rightMargin, this.pageHeight - 0.25, { align: 'right' });
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
      donateUrl = window.location.origin + '/donate',
      highQuality = true
    } = options;

    this.highQuality = highQuality;

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

      // Generate enhanced filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const cleanTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
      const filename = `${cleanTitle}_analysis_${timestamp}.pdf`;

      // Save the PDF with enhanced quality
      this.doc.save(filename);

    } catch (error) {
      console.error('PDF export failed:', error);
      throw new Error(`Failed to generate enhanced PDF export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export async function exportAnalysisToPDF(
  document: Document,
  options?: PDFExportOptions
): Promise<void> {
  const exporter = new AnalysisPDFExporter({ highQuality: options?.highQuality });
  await exporter.exportToPDF(document, options);
}