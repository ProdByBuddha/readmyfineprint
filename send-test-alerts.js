// Send test security alerts for each event type
import * as nodemailer from 'nodemailer';

// Create transporter with your iCloud SMTP settings
const transporter = nodemailer.createTransport({
  host: 'smtp.mail.me.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Test alert templates for each security event type
const testAlerts = [
  {
    id: 'AUTH_TEST_' + Date.now(),
    severity: 'HIGH',
    eventType: 'AUTHENTICATION',
    message: 'Multiple authentication failures detected from same source (Test Alert)',
    eventCount: 5,
    fingerprint: 'a1b2c3d4e5f6g7h8',
    timestamp: new Date().toISOString()
  },
  {
    id: 'RATE_TEST_' + Date.now(),
    severity: 'MEDIUM', 
    eventType: 'RATE_LIMIT',
    message: 'Repeated rate limit violations from client (Test Alert)',
    eventCount: 3,
    fingerprint: 'x9y8z7w6v5u4t3s2',
    timestamp: new Date().toISOString()
  },
  {
    id: 'INPUT_TEST_' + Date.now(),
    severity: 'MEDIUM',
    eventType: 'INPUT_VALIDATION', 
    message: 'Multiple input validation failures detected (Test Alert)',
    eventCount: 10,
    fingerprint: 'm1n2o3p4q5r6s7t8',
    timestamp: new Date().toISOString()
  },
  {
    id: 'SUSPICIOUS_TEST_' + Date.now(),
    severity: 'CRITICAL',
    eventType: 'SUSPICIOUS_ACTIVITY',
    message: 'Suspicious activity pattern detected - potential security threat (Test Alert)',
    eventCount: 1,
    fingerprint: 'z9x8c7v6b5n4m3l2',
    timestamp: new Date().toISOString()
  }
];

function getSeverityColor(severity) {
  switch (severity) {
    case 'CRITICAL': return '#dc3545';
    case 'HIGH': return '#fd7e14';
    case 'MEDIUM': return '#ffc107';
    case 'LOW': return '#28a745';
  }
}

function getSeverityEmoji(severity) {
  switch (severity) {
    case 'CRITICAL': return '🚨';
    case 'HIGH': return '⚠️';
    case 'MEDIUM': return '🔍';
    case 'LOW': return 'ℹ️';
  }
}

async function sendTestAlert(alert) {
  const subject = `🧪 TEST ALERT [${alert.severity}] - ${alert.eventType}`;
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${getSeverityColor(alert.severity)}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">${getSeverityEmoji(alert.severity)} Security Alert TEST</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Alert ID: ${alert.id}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6;">
        <h2 style="color: #495057; margin-top: 0;">Alert Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold;">Severity:</td><td>${alert.severity}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Event Type:</td><td>${alert.eventType}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Timestamp:</td><td>${alert.timestamp}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Event Count:</td><td>${alert.eventCount}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Fingerprint:</td><td><code>${alert.fingerprint}</code></td></tr>
        </table>
      </div>
      
      <div style="background: white; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
        <h3 style="color: #495057; margin-top: 0;">Message</h3>
        <p style="background: #f8f9fa; padding: 15px; border-left: 4px solid ${getSeverityColor(alert.severity)}; margin: 0;">
          ${alert.message}
        </p>
      </div>
      
      <div style="background: #e9ecef; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
        <p style="margin: 0; color: #6c757d; font-size: 12px;">
          ReadMyFinePrint Security System - Test Alert - ${new Date().toISOString()}
        </p>
      </div>
    </div>
  `;

  const textBody = `
SECURITY ALERT TEST [${alert.severity}]
Alert ID: ${alert.id}

Event Type: ${alert.eventType}
Severity: ${alert.severity}
Timestamp: ${alert.timestamp}
Event Count: ${alert.eventCount}
Fingerprint: ${alert.fingerprint}

Message: ${alert.message}

---
ReadMyFinePrint Security System - Test Alert
Generated: ${new Date().toISOString()}
  `;

  try {
    await transporter.sendMail({
      from: process.env.SECURITY_EMAIL_FROM,
      to: process.env.SECURITY_EMAIL_TO,
      subject,
      text: textBody,
      html: htmlBody,
    });

    console.log(`✅ Sent ${alert.severity} test alert: ${alert.eventType}`);
  } catch (error) {
    console.error(`❌ Failed to send ${alert.eventType} alert:`, error.message);
  }
}

async function sendAllTestAlerts() {
  console.log('🧪 Sending test security alerts...\n');
  
  // Verify SMTP connection first
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified\n');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    return;
  }

  // Send each test alert with a 2-second delay between them
  for (const alert of testAlerts) {
    await sendTestAlert(alert);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎯 All test alerts sent! Check your email inbox.');
  console.log(`📧 Emails sent to: ${process.env.SECURITY_EMAIL_TO}`);
}

sendAllTestAlerts().catch(console.error);