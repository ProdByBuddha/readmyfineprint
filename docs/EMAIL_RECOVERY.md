# Email Recovery System

A comprehensive email recovery and change system for users who have lost access to their email accounts.

## Features

### User Features
- **Secure Email Change Requests**: Users can request email changes when locked out
- **Security Questions**: Optional security questions to expedite verification
- **Request Status Tracking**: Check status of submitted requests
- **Email Notifications**: Automatic notifications to both old and new email addresses
- **Rate Limiting**: Protection against abuse (3 requests per 24 hours)

### Admin Features
- **Manual Review Process**: All requests require admin approval for security
- **Detailed Request Information**: Full context including IP, device fingerprint, user history
- **Approve/Reject with Notes**: Admins can approve or reject with explanatory notes
- **Security Audit Trail**: Complete logging of all email change activities

## How It Works

### 1. User Request Process
1. User visits `/email-recovery` page (accessible when locked out)
2. Fills out email change request form with:
   - Current email address
   - New email address  
   - Detailed reason for change
   - Optional security questions
3. System validates and creates request
4. Request expires after 72 hours if not reviewed

### 2. Security Questions
Predefined questions help verify user identity:
- What was the name of your first pet?
- What was the name of the street where you grew up?
- What was the name of your elementary school?
- What is your mother's maiden name?
- What was the make and model of your first car?
- In what city were you born?

### 3. Admin Review Process
1. Admins access pending requests via admin dashboard
2. Review includes:
   - User account details and history
   - Request reason and context
   - IP address and device fingerprint
   - Security question answers (if provided)
3. Admin approves or rejects with optional notes
4. If approved, user's email is automatically updated

### 4. Notification System
- **Request Submitted**: Both emails notified of new request
- **Review Complete**: Both emails notified of approval/rejection
- **Email Changed**: Welcome email sent to new address

## API Endpoints

### Public Endpoints (No Authentication Required)

#### Get Security Questions
```
GET /api/auth/security-questions
```
Returns available security questions for user verification.

#### Submit Email Change Request
```
POST /api/auth/request-email-change
Body: {
  currentEmail: string,
  newEmail: string, 
  reason: string,
  securityAnswers?: Record<string, string>
}
```
Submits a new email change request.

#### Verify Security Answers
```
POST /api/auth/verify-email-change/:requestId
Body: {
  securityAnswers: Record<string, string>
}
```
Verifies security answers for faster processing.

#### Check Request Status
```
GET /api/auth/email-change-status/:requestId
```
Returns current status of an email change request.

### Admin Endpoints (Require Admin Authentication)

#### Get Pending Requests
```
GET /api/admin/email-change-requests?limit=50
```
Returns list of pending email change requests.

#### Get Request Details
```
GET /api/admin/email-change-requests/:requestId
```
Returns detailed information about a specific request.

#### Review Request
```
POST /api/admin/email-change-requests/:requestId/review
Body: {
  action: 'approve' | 'reject',
  adminNotes?: string
}
```
Approve or reject an email change request.

### User Endpoints (Require User Authentication)

#### Get Own Requests
```
GET /api/users/me/email-change-requests
```
Returns user's own email change requests.

## Security Measures

### Rate Limiting
- Maximum 3 requests per IP/email combination per 24 hours
- Prevents abuse and spam

### Request Validation
- Validates email formats
- Checks if new email is already in use
- Requires minimum 10-character reason

### Security Logging
All activities are logged including:
- Request submissions
- Verification attempts
- Admin reviews
- Email changes
- Suspicious activities

### Encryption
- Security answers are encrypted before storage
- Device fingerprinting for additional security
- IP and user agent tracking

### Expiration
- Requests expire after 72 hours
- Automatic cleanup of expired requests
- Limited verification attempts (3 max)

## Database Schema

### Email Change Requests Table
```sql
CREATE TABLE email_change_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  current_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  client_ip TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  security_answers TEXT, -- Encrypted JSON
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, expired
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  verification_code TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Examples

### Frontend Components

#### Email Recovery Form
```tsx
import { EmailRecoveryForm } from '@/components/EmailRecoveryForm';

<EmailRecoveryForm 
  onSuccess={(requestId) => console.log('Request submitted:', requestId)}
/>
```

#### Admin Dashboard
```tsx
import { AdminEmailChangeRequests } from '@/components/AdminEmailChangeRequests';

<AdminEmailChangeRequests />
```

#### Email Recovery Page
```tsx
import { EmailRecoveryPage } from '@/pages/EmailRecovery';

// Full page with request form and status checker
<EmailRecoveryPage />
```

### Backend Service Usage

```typescript
import { emailRecoveryService } from './email-recovery-service';

// Create request
const result = await emailRecoveryService.createEmailChangeRequest(
  userId,
  { currentEmail, newEmail, reason, securityAnswers },
  { ip, userAgent, deviceFingerprint }
);

// Admin review
const reviewResult = await emailRecoveryService.reviewEmailChangeRequest(
  requestId,
  adminUserId,
  'approve',
  'Verified user identity through additional channels'
);
```

## Configuration

### Environment Variables
- `EMAIL_RECOVERY_ENCRYPTION_KEY`: Key for encrypting security answers
- `ADMIN_API_KEY`: Required for internal cleanup operations

### Customization
- Security questions can be modified in `SECURITY_QUESTIONS` array
- Rate limits can be adjusted in route configuration
- Expiration time can be changed in service configuration

## Maintenance

### Cleanup Expired Requests
```bash
# Automated cleanup (can be run as cron job)
curl -X POST http://localhost:5000/api/internal/cleanup-expired-email-requests \
  -H "X-API-Key: YOUR_ADMIN_API_KEY"
```

### Monitoring
- Security events are logged and can be monitored
- Email delivery status should be monitored
- Failed verification attempts are tracked

## Troubleshooting

### Common Issues
1. **Email not delivered**: Check SMTP configuration
2. **Request not found**: Verify request ID format
3. **Rate limit exceeded**: Wait 24 hours or contact admin
4. **Security answers failed**: Ensure exact match (case-insensitive)

### Support Process
1. User contacts support with Request ID
2. Support can look up request in admin dashboard
3. Additional verification can be performed manually
4. Admin can approve requests that fail automated verification