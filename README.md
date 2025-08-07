# ReadMyFinePrint

**Privacy-First AI-Powered Contract Analysis**

ReadMyFinePrint is a proprietary legal document analysis platform that uses artificial intelligence to transform complex legal documents into accessible summaries while maintaining enterprise-grade security and privacy protection.

## ⚠️ PROPRIETARY SOFTWARE

**This software is proprietary and confidential.** All rights reserved by **Nexus Integrated Technologies** (DBA ReadMyFinePrint).

- **Unauthorized use, copying, or distribution is strictly prohibited**
- **This software is protected by copyright and trade secret laws**
- **Commercial licensing available for enterprise deployment**

## 🔒 Key Features

- **Privacy-First Architecture**: Session-based processing with automatic PII detection and redaction
- **AI-Powered Analysis**: Advanced document understanding using GPT-4o with privacy protection
- **Enterprise Security**: Military-grade security with complete audit trails
- **Multi-Format Support**: PDF, DOCX, DOC, and TXT document analysis
- **Subscription Management**: Flexible pricing tiers with Stripe integration
- **Multi-Device Access**: Secure authentication across devices

## 🏢 Corporate Structure

- **Service Provider**: Nexus Integrated Technologies (DBA ReadMyFinePrint)
- **Current Jurisdiction**: State of California, United States
- **Service**: AI-Powered Contract Analysis Platform

## 📝 Legal Framework

- **License**: Proprietary Software License (see LICENSE file)
- **Privacy**: GDPR, CCPA, and PIPEDA compliant
- **Security**: SOC 2 Type II controls implemented
- **Terms**: Comprehensive Terms of Service and Privacy Policy

## 🛡️ Security & Privacy

- **PII Protection**: Automatic detection and redaction of sensitive information
- **Data Retention**: Session-based processing with automatic cleanup
- **Encryption**: End-to-end encryption for all data in transit and at rest
- **Access Control**: Role-based access with multi-factor authentication
- **Audit Logging**: Complete audit trail of all system activities

## 📧 Contact

For commercial licensing, enterprise deployment, or technical support:

- **Email**: admin@readmyfineprint.com
- **Website**: https://readmyfineprint.com

---

## 🛠️ Technical Overview

### Styling and Theming

The project uses **Tailwind CSS** for styling. The configuration can be found in `tailwind.config.ts`.

- **Global Styles**: All global styles, including CSS custom properties for theming, are consolidated in `app/globals.css`. The project no longer uses separate CSS files in the `styles` directory.
- **Theming**: Light and dark modes are managed by the `next-themes` package. The `ThemeProvider` is configured in `app/layout.tsx`.
- **Usage**: To implement theme switching (e.g., a light/dark mode toggle), use the `useTheme` hook from `hooks/useTheme.ts`. A practical example can be found in the `components/Header.tsx` component.

### Testing

The project uses Jest for testing. However, due to a persistent environment issue, the test suite is currently not runnable. This should be addressed before any further development.

---

**© 2025 Nexus Integrated Technologies. All Rights Reserved.**

*ReadMyFinePrint is a trademark of Nexus Integrated Technologies.*