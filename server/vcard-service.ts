import fs from 'fs';
import path from 'path';

export class VCardService {
  private async getLogoAsBase64(): Promise<string> {
    try {
      const logoPath = path.join(process.cwd(), 'client/public/og-image.png');
      const logoBuffer = fs.readFileSync(logoPath);
      return logoBuffer.toString('base64');
    } catch (error) {
      console.error('Error reading logo file:', error);
      return '';
    }
  }

  async generateContactCard(): Promise<string> {
    const logoBase64 = await this.getLogoAsBase64();
    
    // Create vCard 3.0 format with embedded photo
    const vCard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:ReadMyFinePrint',
      'ORG:ReadMyFinePrint',
      'TITLE:AI-Powered Document Analysis',
      'EMAIL;TYPE=INTERNET:admin@readmyfineprint.com',
      'URL:https://readmyfineprint.com',
      'NOTE:ReadMyFinePrint provides AI-powered legal document analysis to help you understand contracts, terms of service, and legal documents. Our platform identifies risks, explains complex terms, and protects your interests.',
      // Logo embedded as base64
      logoBase64 ? `PHOTO;ENCODING=BASE64;TYPE=PNG:${logoBase64}` : '',
      'CATEGORIES:Legal,Technology,AI,Document Analysis',
      'X-SOCIALPROFILE;TYPE=website:https://readmyfineprint.com',
      'X-SOCIALPROFILE;TYPE=blog:https://readmyfineprint.com/blog',
      'REV:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      'END:VCARD'
    ].filter(line => line.length > 0).join('\r\n');

    return vCard;
  }

  async generateEnhancedContactCard(): Promise<string> {
    const logoBase64 = await this.getLogoAsBase64();
    
    // Create vCard 4.0 format with more modern features
    const vCard = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:ReadMyFinePrint',
      'ORG:ReadMyFinePrint',
      'TITLE:AI-Powered Legal Document Analysis Platform',
      'EMAIL;TYPE=work:admin@readmyfineprint.com',
      'URL:https://readmyfineprint.com',
      'NOTE:ReadMyFinePrint is an AI-powered platform that analyzes legal documents\\, contracts\\, and terms of service. We help individuals and businesses understand complex legal language\\, identify potential risks\\, and make informed decisions.',
      // Logo embedded with modern syntax
      logoBase64 ? `PHOTO:data:image/png;base64,${logoBase64}` : '',
      'CATEGORIES:Legal Technology,Document Analysis,AI,Contract Review,Legal Tech',
      'CLIENTPIDMAP:1;urn:uuid:readmyfineprint-contact',
      'KIND:org',
      'LANG:en-US',
      'TZ:America/Los_Angeles',
      'GEO:37.7749,-122.4194',
      'ADR;TYPE=work:;;San Francisco;CA;94102;United States',
      'X-SOCIALPROFILE;TYPE=website:https://readmyfineprint.com',
      'X-SOCIALPROFILE;TYPE=blog:https://readmyfineprint.com/blog',
      'X-SOCIALPROFILE;TYPE=privacy:https://readmyfineprint.com/privacy',
      'X-SOCIALPROFILE;TYPE=terms:https://readmyfineprint.com/terms',
      'SOURCE:https://readmyfineprint.com/contact.vcf',
      'REV:' + new Date().toISOString(),
      'END:VCARD'
    ].filter(line => line.length > 0).join('\r\n');

    return vCard;
  }

  // Generate a simplified version for maximum compatibility
  async generateCompatibleContactCard(): Promise<string> {
    const logoBase64 = await this.getLogoAsBase64();
    
    const vCard = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'FN:ReadMyFinePrint',
      'ORG:ReadMyFinePrint',
      'TITLE:AI Document Analysis',
      'EMAIL;INTERNET:admin@readmyfineprint.com',
      'URL:https://readmyfineprint.com',
      'NOTE:AI-powered legal document analysis platform. Understand contracts and legal documents with confidence.',
      // Simple photo format for maximum compatibility
      logoBase64 ? `PHOTO;PNG;ENCODING=BASE64:${logoBase64}` : '',
      'CATEGORIES:Legal,AI,Technology',
      'REV:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      'END:VCARD'
    ].filter(line => line.length > 0).join('\r\n');

    return vCard;
  }

  // Method to get the appropriate vCard format based on user agent
  async generateContactCardForClient(userAgent?: string): Promise<{ vcard: string; filename: string; version: string }> {
    // Default to compatible version
    let vcard = await this.generateCompatibleContactCard();
    let version = '2.1';
    let filename = 'ReadMyFinePrint-Contact.vcf';

    // Detect client capabilities
    if (userAgent) {
      const ua = userAgent.toLowerCase();
      
      // Apple devices prefer vCard 3.0
      if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('mac')) {
        vcard = await this.generateContactCard();
        version = '3.0';
        filename = 'ReadMyFinePrint.vcf';
      }
      // Modern Android and desktop clients can handle vCard 4.0
      else if (ua.includes('android') || ua.includes('chrome') || ua.includes('firefox')) {
        vcard = await this.generateEnhancedContactCard();
        version = '4.0';
        filename = 'ReadMyFinePrint-Contact-v4.vcf';
      }
    }

    return { vcard, filename, version };
  }
}

export const vCardService = new VCardService();