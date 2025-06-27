# Data Processing Register (GDPR Article 30)

## Overview
This register documents all processing activities carried out by ReadMyFinePrint in compliance with GDPR Article 30. It provides a comprehensive overview of personal data processing, legal bases, retention periods, and data protection measures.

---

## 1. User Registration and Account Management

### Processing Activity Details
- **Activity Name**: User Registration and Account Management
- **Controller**: ReadMyFinePrint
- **Legal Basis**: Article 6(1)(b) - Contract performance (Terms of Service)
- **Legitimate Interests Assessment**: N/A (Contract basis)

### Categories of Data Subjects
- Website users creating accounts
- Subscribers to premium services
- Former users (anonymized data only)

### Categories of Personal Data
- **Identity Data**: Email address, display name (optional)
- **Technical Data**: Password hash (Argon2id), account creation timestamp
- **Preference Data**: Subscription tier, consent preferences
- **Security Data**: Login attempts, account recovery requests

### Categories of Recipients
- **Internal**: Application servers, database systems
- **External**: Email service providers (for account verification)
- **No Third Countries**: Data processed within EU/UK jurisdictions primarily

### Retention Periods
- **Active Accounts**: Until account deletion by user
- **Deleted Accounts**: Personal data anonymized immediately, audit logs 90 days
- **Security Logs**: 90 days for monitoring and fraud prevention

### Technical and Organizational Measures
- Argon2id password hashing with salt and pepper
- Database encryption at rest and in transit
- Access controls with role-based permissions
- Regular security audits and vulnerability assessments

---

## 2. Document Analysis Service

### Processing Activity Details
- **Activity Name**: Legal Document Analysis and Summarization
- **Controller**: ReadMyFinePrint
- **Legal Basis**: Article 6(1)(b) - Contract performance (Service provision)
- **Special Categories**: None (PII redacted before processing)

### Categories of Data Subjects
- Users uploading documents for analysis
- Individuals mentioned in uploaded documents (PII redacted)

### Categories of Personal Data
- **Document Content**: Legal documents with PII removed
- **Metadata**: Upload timestamp, document type, file size
- **Session Data**: Temporary session identifiers
- **Processing Results**: AI-generated summaries (de-identified)

### Data Processing Details
- **Collection Method**: User upload via web interface
- **Processing Purpose**: Document analysis and summarization
- **Automated Decision Making**: AI-powered content analysis (not affecting legal rights)
- **Profiling**: None

### Categories of Recipients
- **Internal**: Application servers, document processing services
- **External**: OpenAI (US) - with PII redaction and SCCs
- **Third Countries**: United States (OpenAI) - protected by Standard Contractual Clauses

### Retention Periods
- **Document Content**: 0 seconds (immediate deletion after analysis)
- **Session Data**: 30 minutes (automatic cleanup)
- **Processing Logs**: 30 days for service improvement
- **Error Logs**: 7 days for debugging purposes

### Technical and Organizational Measures
- Comprehensive PII detection and redaction before external processing
- End-to-end encryption for data in transit (TLS 1.3)
- Zero retention by external processors (OpenAI)
- Secure deletion of temporary files
- Session-based processing with automatic cleanup

---

## 3. Payment Processing

### Processing Activity Details
- **Activity Name**: Subscription Payment Processing
- **Controller**: ReadMyFinePrint
- **Joint Controller**: Stripe, Inc. (payment processor)
- **Legal Basis**: Article 6(1)(b) - Contract performance (Subscription services)

### Categories of Data Subjects
- Subscribers to premium services
- Users making one-time payments
- Former subscribers (anonymized financial records)

### Categories of Personal Data
- **Payment Data**: Credit card information (tokenized by Stripe)
- **Billing Data**: Customer ID, subscription status, billing history
- **Transaction Data**: Payment amounts, dates, transaction IDs
- **Tax Data**: Billing address for tax calculation (if required)

### Data Processing Details
- **Collection Method**: Secure payment forms via Stripe Elements
- **Processing Purpose**: Payment processing, subscription management, refunds
- **Automated Decision Making**: Fraud detection by payment processor
- **Retention Basis**: Legal obligation (financial records retention)

### Categories of Recipients
- **Internal**: Billing systems, customer support
- **External**: Stripe (US), tax authorities (if required)
- **Third Countries**: United States (Stripe) - protected by adequacy decision and contractual safeguards

### Retention Periods
- **Payment Data**: Retained by Stripe per their policy
- **Transaction Records**: 7 years (legal requirement for financial records)
- **Customer Data**: Until subscription cancellation + 7 years for tax purposes
- **Audit Logs**: 6 months for dispute resolution

### Technical and Organizational Measures
- PCI DSS Level 1 compliance through Stripe
- No storage of payment card data on ReadMyFinePrint servers
- Tokenization of all payment information
- Encrypted transmission of all financial data
- Regular security assessments and compliance audits

---

## 4. Marketing and Communications

### Processing Activity Details
- **Activity Name**: Service Communications and Updates
- **Controller**: ReadMyFinePrint
- **Legal Basis**: Article 6(1)(b) - Contract performance (Service communications)
- **Opt-out Available**: Yes, for non-essential communications

### Categories of Data Subjects
- Registered users
- Newsletter subscribers
- Support ticket creators

### Categories of Personal Data
- **Contact Data**: Email addresses
- **Communication Preferences**: Notification settings, communication history
- **Engagement Data**: Email open rates, click-through rates (anonymized)

### Data Processing Details
- **Collection Method**: Registration forms, preference settings
- **Processing Purpose**: Service notifications, updates, support communications
- **Automated Decision Making**: None
- **Personalization**: Basic (name in emails)

### Categories of Recipients
- **Internal**: Customer support, development team
- **External**: Email service providers
- **Third Countries**: May include US-based email services with appropriate safeguards

### Retention Periods
- **Contact Preferences**: Until account deletion or opt-out
- **Communication History**: 2 years for service improvement
- **Support Communications**: 3 years for quality assurance
- **Anonymized Analytics**: 5 years for business intelligence

### Technical and Organizational Measures
- Double opt-in for newsletter subscriptions
- Easy unsubscribe mechanisms in all communications
- Segregated email lists by communication type
- Encryption of email databases
- Regular list hygiene and bounce processing

---

## 5. Website Analytics and Security

### Processing Activity Details
- **Activity Name**: Website Analytics and Security Monitoring
- **Controller**: ReadMyFinePrint
- **Legal Basis**: Article 6(1)(f) - Legitimate interests (Service security and improvement)
- **Legitimate Interests Assessment**: Completed (security and service improvement outweigh privacy risks)

### Categories of Data Subjects
- All website visitors
- Registered users
- Potential security threats

### Categories of Personal Data
- **Technical Data**: IP addresses (hashed), user agents (hashed), session IDs
- **Usage Data**: Page views, click patterns, session duration
- **Security Data**: Failed login attempts, suspicious activity patterns
- **Performance Data**: Page load times, error rates

### Data Processing Details
- **Collection Method**: Automatic collection via web analytics
- **Processing Purpose**: Security monitoring, service improvement, performance optimization
- **Automated Decision Making**: Rate limiting, suspicious activity detection
- **Privacy Protection**: IP and user agent hashing for privacy

### Categories of Recipients
- **Internal**: Security team, development team, system administrators
- **External**: None (all analytics processed internally)
- **Third Countries**: None (EU/UK processing only)

### Retention Periods
- **Security Logs**: 90 days for incident response
- **Analytics Data**: 13 months for trend analysis
- **Performance Metrics**: 6 months for optimization
- **Incident Records**: 2 years for security pattern analysis

### Technical and Organizational Measures
- Privacy-preserving analytics with data minimization
- IP address and user agent hashing for anonymization
- No cross-site tracking or third-party analytics
- Automated log rotation and secure deletion
- Access controls for analytics data

---

## 6. Customer Support

### Processing Activity Details
- **Activity Name**: Customer Support and Issue Resolution
- **Controller**: ReadMyFinePrint
- **Legal Basis**: Article 6(1)(b) - Contract performance (Support services)
- **Special Handling**: May include sensitive support topics

### Categories of Data Subjects
- Users requesting support
- Users mentioned in support tickets
- Technical contacts for business accounts

### Categories of Personal Data
- **Contact Data**: Email addresses, names (if provided)
- **Support Data**: Ticket content, issue descriptions, resolution notes
- **Technical Data**: Error logs, system information, browser details
- **Account Data**: User ID, subscription status, account history

### Data Processing Details
- **Collection Method**: Support forms, email communications
- **Processing Purpose**: Issue resolution, service improvement, quality assurance
- **Automated Decision Making**: Ticket routing and categorization
- **Quality Monitoring**: Support interactions reviewed for training

### Categories of Recipients
- **Internal**: Support team, technical team, management (for escalations)
- **External**: None (unless required for issue resolution with user consent)
- **Third Countries**: None (EU/UK support team only)

### Retention Periods
- **Active Tickets**: Until resolution + 30 days
- **Resolved Tickets**: 3 years for pattern analysis and training
- **Personal Data**: Anonymized after 1 year if no ongoing issues
- **Quality Reviews**: 2 years for training purposes

### Technical and Organizational Measures
- Secure ticketing system with access controls
- Encryption of all support communications
- Staff training on data protection and confidentiality
- Regular review and purging of old support data
- Incident escalation procedures for data breaches

---

## 7. Legal Compliance and Audit

### Processing Activity Details
- **Activity Name**: Legal Compliance Monitoring and Audit
- **Controller**: ReadMyFinePrint
- **Legal Basis**: Article 6(1)(c) - Legal obligation (Regulatory compliance)
- **Additional Basis**: Article 6(1)(f) - Legitimate interests (Business protection)

### Categories of Data Subjects
- All users (for compliance monitoring)
- Data subjects of regulatory inquiries
- Staff and contractors (for internal audits)

### Categories of Personal Data
- **Audit Logs**: User actions, system access, data processing records
- **Compliance Data**: Consent records, data subject rights requests
- **Legal Records**: GDPR compliance documentation, breach reports
- **Investigation Data**: Records related to legal or regulatory inquiries

### Data Processing Details
- **Collection Method**: Automatic logging, compliance monitoring systems
- **Processing Purpose**: Legal compliance, audit trails, regulatory reporting
- **Automated Decision Making**: Compliance alert systems
- **Regulatory Reporting**: As required by law (anonymized where possible)

### Categories of Recipients
- **Internal**: Legal team, compliance officers, senior management
- **External**: Regulators (when legally required), auditors, legal counsel
- **Third Countries**: Only if legally required with appropriate safeguards

### Retention Periods
- **Audit Logs**: 7 years (legal requirement)
- **Compliance Records**: 7 years (regulatory requirement)
- **Breach Documentation**: Permanently (unless data subjects successfully request erasure)
- **Investigation Records**: 10 years or as required by law

### Technical and Organizational Measures
- Immutable audit logging systems
- Role-based access controls for compliance data
- Regular legal and compliance training for staff
- External legal counsel for complex matters
- Secure archival systems for long-term retention

---

## Data Subject Rights Implementation

### Rights Fulfillment Process
- **Right of Access (Article 15)**: Automated data export via user dashboard
- **Right to Rectification (Article 16)**: User profile editing, support ticket system
- **Right to Erasure (Article 17)**: Account deletion with data anonymization
- **Right to Restrict Processing (Article 18)**: Account suspension without deletion
- **Right to Data Portability (Article 20)**: JSON export functionality
- **Right to Object (Article 21)**: Opt-out mechanisms, account deletion

### Response Timeframes
- **Standard Requests**: 30 days (GDPR Article 12)
- **Complex Requests**: 60 days with explanation (if extension needed)
- **Urgent Requests**: 72 hours (security-related)

### Verification Process
- Identity verification required for all data subject rights requests
- Multi-factor authentication for account holders
- Additional verification for non-account holders

---

## International Transfers

### Transfer Mechanisms
- **OpenAI (US)**: Standard Contractual Clauses (2021/914/EU) + technical safeguards
- **Stripe (US)**: Adequacy decision (if applicable) + contractual protections
- **Email Services**: Standard Contractual Clauses where required

### Safeguards Applied
- Data minimization before transfer
- Encryption in transit and at rest
- Regular transfer impact assessments
- Monitoring of third-country legal developments

### Transfer Documentation
- All transfers logged with purpose and safeguards
- Regular review of transfer agreements
- Impact assessments for high-risk transfers

---

## Data Protection Impact Assessments (DPIAs)

### DPIA Triggers
- New high-risk processing activities
- Changes to existing processing with increased risk
- New technologies or AI implementation
- Systematic monitoring activities

### Completed DPIAs
- Document Processing with AI (2024)
- User Analytics and Monitoring (2024)
- International Data Transfers (2024)

### DPIA Review Schedule
- Annual review of all DPIAs
- Ad-hoc review for significant changes
- Stakeholder consultation for high-risk processing

---

## Processor Management

### Key Processors
1. **OpenAI, L.L.C.** - Document analysis services
2. **Stripe, Inc.** - Payment processing
3. **Email Service Providers** - Communication services
4. **Cloud Infrastructure Providers** - Hosting and storage

### Processor Oversight
- Data Processing Agreements (DPAs) with all processors
- Regular processor security assessments
- Incident response coordination procedures
- Audit rights and exercise schedule

---

## Breach Notification Procedures

### Internal Notification
- Immediate notification to Data Protection Officer
- Risk assessment within 24 hours
- Containment measures implemented immediately

### External Notification
- **Supervisory Authority**: Within 72 hours (Article 33)
- **Data Subjects**: Without undue delay if high risk (Article 34)
- **Processors**: Immediate notification requirement

### Documentation Requirements
- Breach incident register maintenance
- Lessons learned and process improvements
- Regular breach response training and testing

---

## Data Protection Officer (DPO)

### Contact Information
- **Email**: admin@readmyfineprint.com
- **Responsibility**: GDPR compliance oversight
- **Reporting**: Independent reporting to senior management
- **Availability**: Standard business hours, emergency contact available

### DPO Responsibilities
- Monitor compliance with GDPR
- Conduct privacy impact assessments
- Serve as contact point for supervisory authority
- Provide data protection training and advice

---

## Review and Updates

### Review Schedule
- **Quarterly**: Data processing activities review
- **Annually**: Complete register review and update
- **Ad-hoc**: When new processing activities are introduced

### Change Management
- Impact assessment for processing changes
- Stakeholder consultation for significant updates
- Version control and change documentation

### Last Updated
- **Date**: 2025-06-26
- **Version**: 1.0
- **Next Review**: 2025-09-26
- **Reviewer**: Data Protection Team

---

## Supervisory Authority Information

### Lead Supervisory Authority
- Determined by main establishment location
- Contact information maintained and updated
- Cooperation procedures established

### Cross-Border Processing
- Consistency mechanism awareness
- One-stop-shop mechanism utilization
- Multi-jurisdiction coordination procedures

---

*This register is maintained in accordance with GDPR Article 30 and is available to supervisory authorities upon request. For questions or clarifications, contact the Data Protection Officer at admin@readmyfineprint.com.*